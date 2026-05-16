-- Superadmin foundation
-- Date: 2026-05-16
-- Notes:
-- - Current schema uses roles.role_name, not roles.name.
-- - Factories are stored in public.tenants.
-- - This migration adds a separate permissive superadmin policy instead of editing
--   existing tenant/org policies. Supabase/Postgres combines permissive policies with OR.

begin;

-- Ensure every organisation has a system superadmin role.
insert into public.roles (id, org_id, role_name, description, is_system, created_at)
select gen_random_uuid(), o.id, 'superadmin', 'Platform super admin', true, now()
from public.organisations o
where not exists (
  select 1
  from public.roles r
  where r.org_id = o.id
    and lower(r.role_name) = 'superadmin'
);

update public.roles
set is_system = true,
    description = coalesce(description, 'Platform super admin')
where lower(role_name) = 'superadmin';

-- Generic permission table requested for platform-level permission expansion.
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references public.roles(id),
  module_key text not null,
  can_view boolean default false,
  can_create boolean default false,
  can_edit boolean default false,
  can_delete boolean default false,
  can_export boolean default false,
  can_approve boolean default false,
  created_at timestamptz default now()
);

create unique index if not exists uq_permissions_role_module
  on public.permissions(role_id, module_key);

insert into public.permissions (
  role_id,
  module_key,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_export,
  can_approve
)
select
  r.id,
  '*',
  true,
  true,
  true,
  true,
  true,
  true
from public.roles r
where lower(r.role_name) = 'superadmin'
on conflict (role_id, module_key) do update
set can_view = true,
    can_create = true,
    can_edit = true,
    can_delete = true,
    can_export = true,
    can_approve = true;

-- Keep the existing role_permissions table in sync for current app code.
insert into public.role_permissions (
  id,
  role_id,
  module_key,
  can_create,
  can_read,
  can_update,
  can_delete,
  created_at
)
select
  gen_random_uuid(),
  r.id,
  module_key,
  true,
  true,
  true,
  true,
  now()
from public.roles r
cross join (
  values
    ('dashboard'),
    ('sales'),
    ('purchases'),
    ('manufacturing'),
    ('inventory'),
    ('crm'),
    ('hr'),
    ('reports'),
    ('configuration')
) as modules(module_key)
where lower(r.role_name) = 'superadmin'
  and not exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = r.id
      and rp.module_key = modules.module_key
  );

update public.role_permissions rp
set can_create = true,
    can_read = true,
    can_update = true,
    can_delete = true
from public.roles r
where rp.role_id = r.id
  and lower(r.role_name) = 'superadmin';

create or replace function public.is_superadmin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = user_id
      and lower(u.role::text) = 'superadmin'
      and coalesce(u.is_active, true) = true
  )
  or exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = user_id
      and coalesce(ur.is_active, true) = true
      and lower(r.role_name) = 'superadmin'
  );
$$;

-- Add superadmin bypass policies to major real tables.
do $$
declare
  table_name text;
  policy_name text;
  table_names text[] := array[
    'alerts',
    'api_keys',
    'attachments',
    'attendance',
    'audit_log',
    'bill_of_materials',
    'brands',
    'contact_persons',
    'contact_roles',
    'custom_field_definitions',
    'custom_field_values',
    'customer_payments',
    'customers',
    'dashboard_layouts',
    'dispatch_order_items',
    'dispatch_orders',
    'employees',
    'expense_categories',
    'expenses',
    'field_permissions',
    'finished_goods_movements',
    'goods_receipt_notes',
    'grn_items',
    'interactions',
    'inventory_ledger',
    'invoice_items',
    'invoices',
    'leads',
    'machine_downtime_logs',
    'machines',
    'material_types',
    'material_usage',
    'materials',
    'module_field_config',
    'number_series_config',
    'number_series_log',
    'operators',
    'opportunities',
    'org_modules',
    'org_settings',
    'organisations',
    'parties',
    'payroll_runs',
    'permissions',
    'price_list_items',
    'price_lists',
    'pricing',
    'product_bundle_items',
    'product_bundles',
    'product_categories',
    'product_images',
    'product_packaging_options',
    'product_specs',
    'product_variants',
    'production_runs',
    'products',
    'purchase_order_items',
    'purchase_orders',
    'purchase_return_items',
    'purchase_returns',
    'purchases',
    'quality_checks',
    'quote_items',
    'quotes',
    'role_permissions',
    'roles',
    'salary_structure',
    'sales',
    'sales_order_items',
    'sales_orders',
    'sales_return_items',
    'sales_returns',
    'shifts_config',
    'stock_adjustments',
    'stock_alerts_config',
    'stock_movements',
    'tasks',
    'tenants',
    'user_invitations',
    'user_roles',
    'users',
    'vendor_payments',
    'vendor_products',
    'vendors',
    'warehouse_locations',
    'warehouses',
    'whatsapp_accounts',
    'whatsapp_sessions',
    'whatsapp_templates',
    'work_orders'
  ];
begin
  foreach table_name in array table_names loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relkind in ('r', 'p')
    ) then
      execute format('alter table public.%I enable row level security', table_name);

      policy_name := table_name || '_superadmin_all';

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = policy_name
      ) then
        execute format(
          'create policy %I on public.%I for all using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()))',
          policy_name,
          table_name
        );
      end if;
    end if;
  end loop;
end $$;

commit;
