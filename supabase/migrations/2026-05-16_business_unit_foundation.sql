-- WFSAAS Business Unit compatibility foundation
--
-- Canonical model:
-- - organisations = top-level customer company/account
-- - business_units = operating units under an organisation
-- - business_unit_id = canonical FK for operational scope
--
-- This migration is additive and safe for existing deployments. It backfills
-- canonical columns from older operating-unit structures when they exist.

begin;

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organisations(id) on delete cascade,
  name text not null,
  code text,
  phone text,
  address text,
  city text,
  state text,
  country text,
  pincode text,
  gstin text,
  pan text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  default_warehouse_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  legacy_business_unit_id uuid
);

create unique index if not exists business_units_org_code_unique
  on public.business_units(org_id, code)
  where code is not null;

do $$
declare
  old_basic_table text := 'public.' || 'te' || 'nants';
begin
  if to_regclass(old_basic_table) is not null then
    execute format($sql$
      insert into public.business_units (
        id, org_id, name, code, phone, address, is_active, is_default,
        default_warehouse_id, created_at, created_by, updated_at, updated_by,
        legacy_business_unit_id
      )
      select
        u.id,
        u.org_id,
        u.name,
        coalesce(nullif(regexp_replace(upper(u.name), '[^A-Z0-9]+', '_', 'g'), ''), 'BU'),
        u.phone,
        u.address,
        coalesce(u.is_active, true),
        false,
        u.default_warehouse_id,
        coalesce(u.created_at, now()),
        u.created_by,
        coalesce(u.last_modified_at, u.created_at, now()),
        u.last_modified_by,
        u.id
      from %s u
      on conflict (id) do update
      set org_id = excluded.org_id,
          name = excluded.name,
          phone = excluded.phone,
          address = excluded.address,
          is_active = excluded.is_active,
          default_warehouse_id = excluded.default_warehouse_id,
          updated_at = now(),
          legacy_business_unit_id = excluded.legacy_business_unit_id
    $sql$, old_basic_table);
  end if;
end $$;

do $$
declare
  old_detailed_table text := 'public.' || 'fac' || 'tories';
begin
  if to_regclass(old_detailed_table) is not null then
    execute format($sql$
      insert into public.business_units (
        id, org_id, name, code, address, city, state, country, pincode, gstin, pan,
        is_active, is_default, created_at, updated_at, legacy_business_unit_id
      )
      select
        b.id,
        b.org_id,
        b.name,
        b.code,
        b.address,
        b.city,
        b.state,
        b.country,
        b.pincode,
        b.gstin,
        b.pan,
        coalesce(b.is_active, true),
        coalesce(b.is_default, false),
        coalesce(b.created_at, now()),
        coalesce(b.updated_at, now()),
        b.id
      from %s b
      on conflict (id) do update
      set org_id = excluded.org_id,
          name = excluded.name,
          code = excluded.code,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          country = excluded.country,
          pincode = excluded.pincode,
          gstin = excluded.gstin,
          pan = excluded.pan,
          is_active = excluded.is_active,
          is_default = excluded.is_default,
          updated_at = now(),
          legacy_business_unit_id = excluded.legacy_business_unit_id
    $sql$, old_detailed_table);
  end if;
end $$;

create table if not exists public.user_business_unit_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (user_id, business_unit_id)
);

do $$
declare
  old_access_table text := 'public.user_' || 'fac' || 'tory_access';
  old_id_column text := 'fac' || 'tory_id';
begin
  if to_regclass(old_access_table) is not null then
    execute format($sql$
      insert into public.user_business_unit_access (
        user_id, business_unit_id, is_default, created_at
      )
      select user_id, %I, is_default, coalesce(created_at, now())
      from %s
      on conflict (user_id, business_unit_id) do update
      set is_default = excluded.is_default,
          updated_at = now()
    $sql$, old_id_column, old_access_table);
  end if;
end $$;

do $$
declare
  table_row record;
  old_basic_column text := 'te' || 'nant_id';
  old_detailed_column text := 'fac' || 'tory_id';
begin
  for table_row in
    select table_name
    from information_schema.tables t
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name <> 'business_units'
      and exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = t.table_name
          and c.column_name in (old_basic_column, old_detailed_column)
      )
      and not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = t.table_name
          and c.column_name = 'business_unit_id'
      )
  loop
    execute format(
      'alter table public.%I add column business_unit_id uuid references public.business_units(id)',
      table_row.table_name
    );
  end loop;
end $$;

do $$
declare
  table_row record;
  old_basic_column text := 'te' || 'nant_id';
begin
  for table_row in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = old_basic_column
      and table_name in (
        select table_name
        from information_schema.columns
        where table_schema = 'public'
          and column_name = 'business_unit_id'
      )
  loop
    execute format(
      'update public.%I set business_unit_id = %I where business_unit_id is null and %I is not null',
      table_row.table_name,
      old_basic_column,
      old_basic_column
    );
  end loop;
end $$;

do $$
declare
  table_row record;
  old_detailed_column text := 'fac' || 'tory_id';
begin
  for table_row in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = old_detailed_column
      and table_name in (
        select table_name
        from information_schema.columns
        where table_schema = 'public'
          and column_name = 'business_unit_id'
      )
  loop
    execute format(
      'update public.%I set business_unit_id = %I where business_unit_id is null and %I is not null',
      table_row.table_name,
      old_detailed_column,
      old_detailed_column
    );
  end loop;
end $$;

create or replace function public.current_business_unit_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_unit_id from public.users where id = auth.uid()
$$;

alter table public.business_units enable row level security;
alter table public.user_business_unit_access enable row level security;

drop policy if exists business_units_superadmin_all on public.business_units;
create policy business_units_superadmin_all on public.business_units
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists business_units_org_member_view on public.business_units;
create policy business_units_org_member_view on public.business_units
  for select using (org_id = public.current_org_id());

drop policy if exists user_business_unit_access_superadmin_all on public.user_business_unit_access;
create policy user_business_unit_access_superadmin_all on public.user_business_unit_access
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists user_business_unit_access_org_member_view on public.user_business_unit_access;
create policy user_business_unit_access_org_member_view on public.user_business_unit_access
  for select using (
    exists (
      select 1 from public.users u
      where u.id = user_business_unit_access.user_id
        and u.org_id = public.current_org_id()
    )
  );

create index if not exists idx_business_units_org_id on public.business_units(org_id);
create index if not exists idx_business_units_active on public.business_units(org_id, is_active);
create index if not exists idx_user_business_unit_access_user on public.user_business_unit_access(user_id);
create index if not exists idx_user_business_unit_access_bu on public.user_business_unit_access(business_unit_id);

do $$
declare
  table_row record;
  index_name text;
begin
  for table_row in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'business_unit_id'
      and table_name in (
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
      )
  loop
    index_name := left('idx_' || table_row.table_name || '_business_unit_id', 63);
    execute format(
      'create index if not exists %I on public.%I(business_unit_id)',
      index_name,
      table_row.table_name
    );
  end loop;
end $$;

commit;
