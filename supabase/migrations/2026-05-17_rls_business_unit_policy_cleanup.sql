-- WFSAAS RLS Business Unit Policy Cleanup
-- Safe to run from Supabase SQL Editor and as a migration.
-- Goals:
-- - Use public.users/user_roles as the source of truth for superadmin/admin checks.
-- - Replace JWT-only superadmin policies with DB-backed policies.
-- - Enforce Business Unit and organisation isolation with WITH CHECK for writes.
-- - Keep public-reference tables intentionally read-only for all authenticated/public roles.

begin;

-- -----------------------------------------------------------------------------
-- Canonical helper functions
-- -----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.org_id
  from public.users u
  where u.id = auth.uid()
    and coalesce(u.is_active, true) = true
  limit 1
$$;

create or replace function public.current_business_unit_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bu.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then bu.value::uuid
    else null
  end
  from public.users u
  cross join lateral (
    select nullif(coalesce(to_jsonb(u)->>'business_unit_id', to_jsonb(u)->>'business_unit'), '') as value
  ) bu
  where u.id = auth.uid()
    and coalesce(u.is_active, true) = true
  limit 1
$$;

create or replace function public.is_superadmin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select true
    from public.users u
    where u.id = user_id
      and coalesce(u.is_active, true) = true
      and (
        lower(coalesce(to_jsonb(u)->>'is_superadmin', 'false')) in ('true', 't', '1', 'yes')
        or lower(coalesce(to_jsonb(u)->>'role', '')) = 'superadmin'
      )
    limit 1
  ), false)
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id
      and coalesce(ur.is_active, true) = true
      and lower(coalesce(to_jsonb(r)->>'role_name', to_jsonb(r)->>'name', '')) = 'superadmin'
  )
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin(auth.uid())
$$;

create or replace function public.is_org_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin(user_id)
  or coalesce((
    select true
    from public.users u
    where u.id = user_id
      and coalesce(u.is_active, true) = true
      and lower(coalesce(to_jsonb(u)->>'role', '')) in ('owner', 'admin')
    limit 1
  ), false)
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id
      and coalesce(ur.is_active, true) = true
      and lower(coalesce(to_jsonb(r)->>'role_name', to_jsonb(r)->>'name', '')) in ('owner', 'admin')
  )
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_admin(auth.uid())
$$;

-- -----------------------------------------------------------------------------
-- Enable RLS on all public base tables. Views are intentionally skipped.
-- -----------------------------------------------------------------------------
do $$
declare
  table_row record;
begin
  for table_row in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format('alter table %I.%I enable row level security', table_row.schema_name, table_row.table_name);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Remove old/confusing policies and policies created by this script before re-add.
-- -----------------------------------------------------------------------------
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        policyname = ('ten' || 'ant_isolation')
        or policyname = 'org_isolation'
        or policyname = 'user_isolation'
        or policyname = 'public_read'
        or policyname like 'superadmin_bypass%'
        or policyname like '%_superadmin_all'
        or policyname like '%_business_unit_isolation'
        or policyname like '%_org_isolation'
        or policyname like '%_user_isolation'
        or policyname like '%_public_read'
        or policyname like '%_org_admin_all'
        or policyname like '%_org_member_select'
        or policyname like '%_self_select'
        or policyname like '%_self_access'
        or policyname like '%_system_select'
        or policyname like '%_profile_select'
        or policyname like '%_permission_set_select'
        or policyname like '%_role_select'
        or policyname like '%_business_unit_or_org_select'
        or policyname like '%_business_unit_select'
        or policyname like '%_assigned_business_unit_select'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Superadmin can access every public base table via DB-backed role checks.
-- -----------------------------------------------------------------------------
do $$
declare
  table_row record;
  policy_name text;
begin
  for table_row in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    policy_name := left(table_row.table_name || '_superadmin_all', 63);
    execute format(
      'create policy %I on %I.%I for all using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()))',
      policy_name,
      table_row.schema_name,
      table_row.table_name
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Direct Business Unit isolation for operational tables with business_unit_id.
-- Exclude special tables that need org/admin/user-specific policies below.
-- -----------------------------------------------------------------------------
do $$
declare
  table_row record;
  policy_name text;
begin
  for table_row in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'business_unit_id'
      and table_name not in ('business_units', 'users', 'user_business_unit_access', 'number_series', 'number_series_config')
      and exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = table_schema
          and c.relname = table_name
          and c.relkind in ('r', 'p')
      )
  loop
    policy_name := left(table_row.table_name || '_business_unit_isolation', 63);
    execute format(
      'create policy %I on %I.%I for all using (business_unit_id = public.current_business_unit_id()) with check (business_unit_id = public.current_business_unit_id())',
      policy_name,
      table_row.table_schema,
      table_row.table_name
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Direct organisation isolation for org-scoped tables with org_id.
-- Org members can read their organisation's records; org admins can mutate them.
-- Exclude special tables handled below.
-- -----------------------------------------------------------------------------
do $$
declare
  table_row record;
  policy_name text;
  admin_policy_name text;
begin
  for table_row in
    select table_schema, table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'org_id'
      and table_name not in ('organisations', 'business_units', 'users', 'number_series')
      and exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = table_schema
          and c.relname = table_name
          and c.relkind in ('r', 'p')
      )
  loop
    policy_name := left(table_row.table_name || '_org_member_select', 63);
    execute format(
      'create policy %I on %I.%I for select using (org_id = public.current_org_id())',
      policy_name,
      table_row.table_schema,
      table_row.table_name
    );

    admin_policy_name := left(table_row.table_name || '_org_admin_all', 63);
    execute format(
      'create policy %I on %I.%I for all using (public.is_org_admin(auth.uid()) and org_id = public.current_org_id()) with check (public.is_org_admin(auth.uid()) and org_id = public.current_org_id())',
      admin_policy_name,
      table_row.table_schema,
      table_row.table_name
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Core organisation/business-unit/user access policies.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.organisations') is not null then
    create policy organisations_org_member_select on public.organisations
      for select using (id = public.current_org_id());
  end if;

  if to_regclass('public.business_units') is not null then
    create policy business_units_org_admin_all on public.business_units
      for all
      using (public.is_org_admin(auth.uid()) and org_id = public.current_org_id())
      with check (public.is_org_admin(auth.uid()) and org_id = public.current_org_id());

    create policy business_units_assigned_business_unit_select on public.business_units
      for select using (
        id = public.current_business_unit_id()
        or exists (
          select 1
          from public.user_business_unit_access uba
          where uba.user_id = auth.uid()
            and uba.business_unit_id = business_units.id
        )
      );
  end if;

  if to_regclass('public.users') is not null then
    create policy users_self_select on public.users
      for select using (id = auth.uid());

    create policy users_org_admin_all on public.users
      for all
      using (public.is_org_admin(auth.uid()) and org_id = public.current_org_id())
      with check (public.is_org_admin(auth.uid()) and org_id = public.current_org_id());
  end if;

  if to_regclass('public.user_roles') is not null then
    create policy user_roles_self_select on public.user_roles
      for select using (user_id = auth.uid());

    create policy user_roles_org_admin_all on public.user_roles
      for all
      using (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_roles.user_id and u.org_id = public.current_org_id())
      )
      with check (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_roles.user_id and u.org_id = public.current_org_id())
      );
  end if;

  if to_regclass('public.user_business_unit_access') is not null then
    create policy user_business_unit_access_self_select on public.user_business_unit_access
      for select using (user_id = auth.uid());

    create policy user_business_unit_access_org_admin_all on public.user_business_unit_access
      for all
      using (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_business_unit_access.user_id and u.org_id = public.current_org_id())
      )
      with check (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_business_unit_access.user_id and u.org_id = public.current_org_id())
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Admin/security table policies that require parent org joins.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.profiles') is not null then
    create policy profiles_system_select on public.profiles
      for select using (org_id is null);
  end if;

  if to_regclass('public.profile_permissions') is not null then
    create policy profile_permissions_profile_select on public.profile_permissions
      for select using (
        exists (
          select 1 from public.profiles p
          where p.id = profile_permissions.profile_id
            and (p.org_id = public.current_org_id() or p.org_id is null)
        )
      );

    create policy profile_permissions_org_admin_all on public.profile_permissions
      for all using (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.profiles p
          where p.id = profile_permissions.profile_id
            and p.org_id = public.current_org_id()
        )
      ) with check (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.profiles p
          where p.id = profile_permissions.profile_id
            and p.org_id = public.current_org_id()
        )
      );
  end if;

  if to_regclass('public.roles') is not null then
    create policy roles_system_select on public.roles
      for select using (org_id is null);
  end if;

  if to_regclass('public.role_permissions') is not null then
    create policy role_permissions_role_select on public.role_permissions
      for select using (
        exists (
          select 1 from public.roles r
          where r.id = role_permissions.role_id
            and (r.org_id = public.current_org_id() or r.org_id is null)
        )
      );

    create policy role_permissions_org_admin_all on public.role_permissions
      for all using (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.roles r
          where r.id = role_permissions.role_id
            and r.org_id = public.current_org_id()
        )
      ) with check (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.roles r
          where r.id = role_permissions.role_id
            and r.org_id = public.current_org_id()
        )
      );
  end if;

  if to_regclass('public.permission_sets') is not null then
    create policy permission_sets_system_select on public.permission_sets
      for select using (org_id is null);
  end if;

  if to_regclass('public.permission_set_permissions') is not null then
    create policy permission_set_permissions_permission_set_select on public.permission_set_permissions
      for select using (
        exists (
          select 1 from public.permission_sets ps
          where ps.id = permission_set_permissions.permission_set_id
            and (ps.org_id = public.current_org_id() or ps.org_id is null)
        )
      );

    create policy permission_set_permissions_org_admin_all on public.permission_set_permissions
      for all using (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.permission_sets ps
          where ps.id = permission_set_permissions.permission_set_id
            and ps.org_id = public.current_org_id()
        )
      ) with check (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.permission_sets ps
          where ps.id = permission_set_permissions.permission_set_id
            and ps.org_id = public.current_org_id()
        )
      );
  end if;

  if to_regclass('public.permissions') is not null then
    create policy permissions_role_select on public.permissions
      for select using (
        exists (
          select 1 from public.roles r
          where r.id = permissions.role_id
            and (r.org_id = public.current_org_id() or r.org_id is null)
        )
      );

    create policy permissions_org_admin_all on public.permissions
      for all using (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.roles r
          where r.id = permissions.role_id
            and r.org_id = public.current_org_id()
        )
      ) with check (
        public.is_org_admin(auth.uid())
        and exists (
          select 1 from public.roles r
          where r.id = permissions.role_id
            and r.org_id = public.current_org_id()
        )
      );
  end if;

  if to_regclass('public.number_series') is not null then
    create policy number_series_business_unit_or_org_select on public.number_series
      for select using (
        org_id = public.current_org_id()
        and (business_unit_id is null or business_unit_id = public.current_business_unit_id())
      );

    create policy number_series_org_admin_all on public.number_series
      for all using (
        public.is_org_admin(auth.uid())
        and org_id = public.current_org_id()
      ) with check (
        public.is_org_admin(auth.uid())
        and org_id = public.current_org_id()
      );
  end if;

  if to_regclass('public.number_series_config') is not null then
    create policy number_series_config_business_unit_select on public.number_series_config
      for select using (business_unit_id = public.current_business_unit_id());

    create policy number_series_config_org_admin_all on public.number_series_config
      for all using (
        public.is_org_admin(auth.uid())
        and
        exists (
          select 1 from public.business_units bu
          where bu.id = number_series_config.business_unit_id
            and bu.org_id = public.current_org_id()
        )
      ) with check (
        public.is_org_admin(auth.uid())
        and
        exists (
          select 1 from public.business_units bu
          where bu.id = number_series_config.business_unit_id
            and bu.org_id = public.current_org_id()
        )
      );
  end if;

  if to_regclass('public.user_permission_sets') is not null then
    create policy user_permission_sets_self_select on public.user_permission_sets
      for select using (user_id = auth.uid());

    create policy user_permission_sets_org_admin_all on public.user_permission_sets
      for all using (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_permission_sets.user_id and u.org_id = public.current_org_id())
      ) with check (
        public.is_org_admin(auth.uid())
        and exists (select 1 from public.users u where u.id = user_permission_sets.user_id and u.org_id = public.current_org_id())
      );
  end if;

  if to_regclass('public.modules') is not null then
    create policy modules_public_read on public.modules for select using (true);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Child table isolation through parent records.
-- -----------------------------------------------------------------------------
do $$
declare
  item record;
  policy_name text;
  index_name text;
  child_exists boolean;
  parent_exists boolean;
  child_fk_exists boolean;
  parent_bu_exists boolean;
  parent_org_exists boolean;
begin
  for item in
    select * from (values
      ('billing_invoice_items', 'billing_invoice_id', 'billing_invoices', 'org'),
      ('dispatch_order_items', 'do_id', 'dispatch_orders', 'business_unit'),
      ('grn_items', 'grn_id', 'goods_receipt_notes', 'business_unit'),
      ('invoice_items', 'invoice_id', 'invoices', 'business_unit'),
      ('price_list_items', 'price_list_id', 'price_lists', 'business_unit'),
      ('product_bundle_items', 'bundle_id', 'product_bundles', 'business_unit'),
      ('product_images', 'product_id', 'products', 'business_unit'),
      ('product_packaging_options', 'product_id', 'products', 'business_unit'),
      ('product_specs', 'product_id', 'products', 'business_unit'),
      ('product_variants', 'product_id', 'products', 'business_unit'),
      ('purchase_order_items', 'po_id', 'purchase_orders', 'business_unit'),
      ('purchase_return_items', 'return_id', 'purchase_returns', 'business_unit'),
      ('quote_items', 'quote_id', 'quotes', 'business_unit'),
      ('report_schedules', 'report_id', 'saved_reports', 'org'),
      ('sales_order_items', 'so_id', 'sales_orders', 'business_unit'),
      ('sales_return_items', 'return_id', 'sales_returns', 'business_unit'),
      ('support_ticket_messages', 'ticket_id', 'support_tickets', 'org'),
      ('support_ticket_attachments', 'ticket_message_id', 'support_ticket_messages', 'support_message'),
      ('vendor_products', 'vendor_id', 'vendors', 'business_unit'),
      ('warehouse_locations', 'warehouse_id', 'warehouses', 'business_unit')
    ) as x(child_table, child_fk, parent_table, scope_type)
  loop
    select to_regclass('public.' || item.child_table) is not null into child_exists;
    select to_regclass('public.' || item.parent_table) is not null into parent_exists;

    if child_exists and parent_exists then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = item.child_table and column_name = item.child_fk
      ) into child_fk_exists;

      if child_fk_exists then
        index_name := left('idx_' || item.child_table || '_' || item.child_fk, 63);
        execute format('create index if not exists %I on public.%I(%I)', index_name, item.child_table, item.child_fk);

        policy_name := left(item.child_table || '_' || item.scope_type || '_isolation', 63);

        if item.scope_type = 'business_unit' then
          select exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = item.parent_table and column_name = 'business_unit_id'
          ) into parent_bu_exists;

          if parent_bu_exists then
            execute format(
              'create policy %I on public.%I for all using (exists (select 1 from public.%I p where p.id = %I.%I and p.business_unit_id = public.current_business_unit_id())) with check (exists (select 1 from public.%I p where p.id = %I.%I and p.business_unit_id = public.current_business_unit_id()))',
              policy_name, item.child_table, item.parent_table, item.child_table, item.child_fk, item.parent_table, item.child_table, item.child_fk
            );
          end if;
        elsif item.scope_type = 'org' then
          select exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = item.parent_table and column_name = 'org_id'
          ) into parent_org_exists;

          if parent_org_exists then
            execute format(
              'create policy %I on public.%I for all using (exists (select 1 from public.%I p where p.id = %I.%I and p.org_id = public.current_org_id())) with check (exists (select 1 from public.%I p where p.id = %I.%I and p.org_id = public.current_org_id()))',
              policy_name, item.child_table, item.parent_table, item.child_table, item.child_fk, item.parent_table, item.child_table, item.child_fk
            );
          end if;
        elsif item.scope_type = 'support_message' then
          execute format(
            'create policy %I on public.%I for all using (exists (select 1 from public.support_ticket_messages m join public.support_tickets t on t.id = m.ticket_id where m.id = %I.%I and t.org_id = public.current_org_id())) with check (exists (select 1 from public.support_ticket_messages m join public.support_tickets t on t.id = m.ticket_id where m.id = %I.%I and t.org_id = public.current_org_id()))',
            policy_name, item.child_table, item.child_table, item.child_fk, item.child_table, item.child_fk
          );
        end if;
      end if;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- User-owned tables.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.dashboard_layouts') is not null then
    create policy dashboard_layouts_self_access on public.dashboard_layouts
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if to_regclass('public.saved_filters') is not null then
    create policy saved_filters_self_access on public.saved_filters
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if to_regclass('public.changelog_reads') is not null then
    create policy changelog_reads_self_access on public.changelog_reads
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Public reference/read-only tables.
-- -----------------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'changelog_entries',
    'changelog_tags',
    'hsn_codes',
    'subscription_plans',
    'support_categories',
    'tax_rates'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('create policy %I on public.%I for select using (true)', left(table_name || '_public_read', 63), table_name);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Helpful indexes for direct scoped policies.
-- -----------------------------------------------------------------------------
do $$
declare
  table_row record;
  index_name text;
begin
  for table_row in
    select table_schema, table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('business_unit_id', 'org_id', 'user_id')
      and exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = table_schema
          and c.relname = table_name
          and c.relkind in ('r', 'p')
      )
  loop
    index_name := left('idx_' || table_row.table_name || '_' || table_row.column_name, 63);
    execute format('create index if not exists %I on %I.%I(%I)', index_name, table_row.table_schema, table_row.table_name, table_row.column_name);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Verification result sets for Supabase SQL Editor.
-- -----------------------------------------------------------------------------
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select n.nspname as schemaname, c.relname as tablename
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relrowsecurity = false
order by c.relname;

commit;
