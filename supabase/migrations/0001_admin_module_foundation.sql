-- WFSAAS Administration Module Foundation
-- Salesforce-style admin structure for organisations, factories, roles,
-- profiles, modules, permissions, users, number series, and audit log.
--
-- Important safety choice:
-- This migration intentionally does NOT use DROP ... CASCADE. If existing
-- non-admin tables still depend on one of these admin tables, Postgres will
-- block the migration instead of silently altering unrelated tables.

begin;

drop table if exists public.audit_log;
drop table if exists public.number_series;
drop table if exists public.user_permission_sets;
drop table if exists public.user_factory_access;
drop table if exists public.users;
drop table if exists public.permission_set_permissions;
drop table if exists public.permission_sets;
drop table if exists public.profile_permissions;
drop table if exists public.org_modules;
drop table if exists public.modules;
drop table if exists public.profiles;
drop table if exists public.roles;
drop table if exists public.factories;
drop table if exists public.organisations;

-- BLOCK 1 - ORGANISATION (Top-Level Tenant)
create table public.organisations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text unique not null,
  logo_url         text,
  plan             text default 'free' check (plan in ('free','pro','enterprise')),
  is_active        boolean default true,
  suspended_at     timestamptz,
  suspension_note  text,
  country          text,
  timezone         text default 'UTC',
  currency         text default 'INR',
  fiscal_year_start int default 4,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- BLOCK 2 - FACTORY / BUSINESS UNIT
create table public.factories (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organisations(id) on delete cascade,
  name             text not null,
  code             text not null,
  address          text,
  city             text,
  state            text,
  country          text,
  pincode          text,
  gstin            text,
  pan              text,
  is_active        boolean default true,
  is_default       boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, code)
);

-- BLOCK 3 - ROLES (Salesforce Role Hierarchy)
create table public.roles (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.organisations(id) on delete cascade,
  name             text not null,
  label            text not null,
  description      text,
  is_system        boolean default false,
  parent_role_id   uuid references public.roles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, name)
);

insert into public.roles (id, org_id, name, label, is_system) values
  ('00000000-0000-0000-0000-000000000001', null, 'superadmin', 'Super Admin', true),
  ('00000000-0000-0000-0000-000000000002', null, 'owner',      'Owner',       true),
  ('00000000-0000-0000-0000-000000000003', null, 'admin',      'Administrator', true),
  ('00000000-0000-0000-0000-000000000004', null, 'manager',    'Manager',     true),
  ('00000000-0000-0000-0000-000000000005', null, 'staff',      'Staff',       true),
  ('00000000-0000-0000-0000-000000000006', null, 'readonly',   'Read Only',   true);

-- BLOCK 4 - PROFILES (Salesforce Profile = Permission Blueprint)
create table public.profiles (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.organisations(id) on delete cascade,
  name             text not null,
  label            text not null,
  description      text,
  is_system        boolean default false,
  cloned_from_id   uuid references public.profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, name)
);

insert into public.profiles (id, org_id, name, label, is_system) values
  ('10000000-0000-0000-0000-000000000001', null, 'system_admin',   'System Administrator', true),
  ('10000000-0000-0000-0000-000000000002', null, 'standard_user',  'Standard User',        true),
  ('10000000-0000-0000-0000-000000000003', null, 'readonly_user',  'Read Only User',       true),
  ('10000000-0000-0000-0000-000000000004', null, 'custom_user',    'Custom User',          true);

-- BLOCK 5 - MODULES REGISTRY
create table public.modules (
  id               uuid primary key default gen_random_uuid(),
  key              text unique not null,
  label            text not null,
  description      text,
  icon             text,
  route            text,
  sort_order       int default 0,
  is_active        boolean default true,
  created_at       timestamptz default now()
);

insert into public.modules (key, label, route, sort_order) values
  ('dashboard',      'Dashboard',       '/dashboard',        1),
  ('sales',          'Sales',           '/sales',            2),
  ('purchases',      'Purchases',       '/purchases',        3),
  ('inventory',      'Inventory',       '/inventory',        4),
  ('crm',            'CRM',             '/crm',              5),
  ('hr',             'HR',              '/hr',               6),
  ('manufacturing',  'Manufacturing',   '/manufacturing',    7),
  ('reports',        'Reports',         '/reports',          8),
  ('administration', 'Administration',  '/administration',   9);

create table public.org_modules (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organisations(id) on delete cascade,
  module_id        uuid not null references public.modules(id),
  is_enabled       boolean default true,
  enabled_at       timestamptz default now(),
  unique (org_id, module_id)
);

-- BLOCK 6 - PROFILE PERMISSIONS
create table public.profile_permissions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  can_view         boolean default false,
  can_create       boolean default false,
  can_edit         boolean default false,
  can_delete       boolean default false,
  can_export       boolean default false,
  can_approve      boolean default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (profile_id, module_id)
);

insert into public.profile_permissions (
  profile_id, module_id, can_view, can_create, can_edit, can_delete, can_export, can_approve
)
select '10000000-0000-0000-0000-000000000001', id, true, true, true, true, true, true
from public.modules;

insert into public.profile_permissions (
  profile_id, module_id, can_view, can_create, can_edit, can_delete, can_export, can_approve
)
select '10000000-0000-0000-0000-000000000002', id, true, true, true, false, true, false
from public.modules;

insert into public.profile_permissions (
  profile_id, module_id, can_view, can_create, can_edit, can_delete, can_export, can_approve
)
select '10000000-0000-0000-0000-000000000003', id, true, false, false, false, false, false
from public.modules;

-- BLOCK 7 - PERMISSION SETS
create table public.permission_sets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.organisations(id) on delete cascade,
  name             text not null,
  label            text not null,
  description      text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, name)
);

create table public.permission_set_permissions (
  id               uuid primary key default gen_random_uuid(),
  permission_set_id uuid not null references public.permission_sets(id) on delete cascade,
  module_id        uuid not null references public.modules(id) on delete cascade,
  can_view         boolean default false,
  can_create       boolean default false,
  can_edit         boolean default false,
  can_delete       boolean default false,
  can_export       boolean default false,
  can_approve      boolean default false,
  unique (permission_set_id, module_id)
);

-- BLOCK 8 - USERS
create table public.users (
  id               uuid primary key references auth.users(id) on delete cascade,
  org_id           uuid references public.organisations(id) on delete set null,
  factory_id       uuid references public.factories(id) on delete set null,
  role_id          uuid references public.roles(id),
  profile_id       uuid references public.profiles(id),
  employee_code    text,
  first_name       text not null,
  last_name        text,
  email            text not null,
  phone            text,
  avatar_url       text,
  designation      text,
  department       text,
  is_active        boolean default true,
  is_superadmin    boolean default false,
  last_login_at    timestamptz,
  password_reset_required boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, email)
);

-- BLOCK 9 - USER FACTORY ACCESS
create table public.user_factory_access (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  factory_id       uuid not null references public.factories(id) on delete cascade,
  is_default       boolean default false,
  created_at       timestamptz default now(),
  unique (user_id, factory_id)
);

-- BLOCK 10 - USER PERMISSION SET ASSIGNMENTS
create table public.user_permission_sets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  permission_set_id uuid not null references public.permission_sets(id) on delete cascade,
  assigned_at      timestamptz default now(),
  assigned_by      uuid references public.users(id),
  unique (user_id, permission_set_id)
);

-- BLOCK 11 - NUMBER SERIES
create table public.number_series (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organisations(id) on delete cascade,
  factory_id       uuid references public.factories(id) on delete cascade,
  module_key       text not null,
  document_type    text not null,
  prefix           text not null,
  suffix           text default '',
  separator        text default '-',
  padding_digits   int default 5,
  current_value    int default 0,
  start_value      int default 1,
  reset_frequency  text default 'never' check (reset_frequency in ('never','yearly','monthly')),
  last_reset_at    timestamptz,
  fiscal_year      text,
  is_active        boolean default true,
  preview          text generated always as (
                     prefix || separator ||
                     lpad((current_value + 1)::text, padding_digits, '0') || suffix
                   ) stored,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (org_id, factory_id, document_type, fiscal_year)
);

create or replace function public.get_next_number(p_series_id uuid)
returns text
language plpgsql
as $$
declare
  v_series public.number_series;
  v_next   int;
  v_result text;
begin
  select * into v_series
  from public.number_series
  where id = p_series_id
  for update;

  if not found then
    raise exception 'number_series % not found', p_series_id;
  end if;

  v_next := v_series.current_value + 1;

  update public.number_series
  set current_value = v_next,
      updated_at = now()
  where id = p_series_id;

  v_result := v_series.prefix || v_series.separator ||
              lpad(v_next::text, v_series.padding_digits, '0') ||
              v_series.suffix;

  return v_result;
end;
$$;

-- BLOCK 12 - AUDIT LOG
create table public.audit_log (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references public.organisations(id),
  actor_id         uuid references public.users(id),
  actor_email      text,
  actor_role       text,
  action           text not null,
  entity_type      text not null,
  entity_id        uuid,
  entity_name      text,
  changes          jsonb,
  ip_address       text,
  user_agent       text,
  status           text default 'success' check (status in ('success','failed')),
  created_at       timestamptz default now()
);

create index idx_audit_log_org_id    on public.audit_log(org_id);
create index idx_audit_log_actor_id  on public.audit_log(actor_id);
create index idx_audit_log_action    on public.audit_log(action);
create index idx_audit_log_created   on public.audit_log(created_at desc);

-- BLOCK 13 - DB HELPER FUNCTIONS & RLS
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.users where id = auth.uid()
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(is_superadmin, false) from public.users where id = auth.uid()
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and r.name in ('superadmin', 'owner', 'admin')
  )
$$;

alter table public.organisations enable row level security;
alter table public.factories enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.org_modules enable row level security;
alter table public.profile_permissions enable row level security;
alter table public.permission_sets enable row level security;
alter table public.permission_set_permissions enable row level security;
alter table public.users enable row level security;
alter table public.user_factory_access enable row level security;
alter table public.user_permission_sets enable row level security;
alter table public.number_series enable row level security;
alter table public.audit_log enable row level security;

create policy organisations_superadmin_all on public.organisations
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy organisations_org_member_view on public.organisations
  for select using (id = public.current_org_id());

create policy users_superadmin_all on public.users
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy users_org_member_view on public.users
  for select using (org_id = public.current_org_id());

create policy factories_superadmin_all on public.factories
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy factories_org_member_view on public.factories
  for select using (org_id = public.current_org_id());

create policy roles_superadmin_all on public.roles
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy roles_org_member_view on public.roles
  for select using (org_id = public.current_org_id() or org_id is null);

create policy profiles_superadmin_all on public.profiles
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy profiles_org_member_view on public.profiles
  for select using (org_id = public.current_org_id() or org_id is null);

create policy org_modules_superadmin_all on public.org_modules
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy org_modules_org_member_view on public.org_modules
  for select using (org_id = public.current_org_id());

create policy profile_permissions_superadmin_all on public.profile_permissions
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy profile_permissions_org_member_view on public.profile_permissions
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = profile_permissions.profile_id
        and (p.org_id = public.current_org_id() or p.org_id is null)
    )
  );

create policy permission_sets_superadmin_all on public.permission_sets
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy permission_sets_org_member_view on public.permission_sets
  for select using (org_id = public.current_org_id() or org_id is null);

create policy permission_set_permissions_superadmin_all on public.permission_set_permissions
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy permission_set_permissions_org_member_view on public.permission_set_permissions
  for select using (
    exists (
      select 1 from public.permission_sets ps
      where ps.id = permission_set_permissions.permission_set_id
        and (ps.org_id = public.current_org_id() or ps.org_id is null)
    )
  );

create policy user_factory_access_superadmin_all on public.user_factory_access
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy user_factory_access_org_member_view on public.user_factory_access
  for select using (
    exists (
      select 1 from public.users u
      where u.id = user_factory_access.user_id
        and u.org_id = public.current_org_id()
    )
  );

create policy user_permission_sets_superadmin_all on public.user_permission_sets
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy user_permission_sets_org_member_view on public.user_permission_sets
  for select using (
    exists (
      select 1 from public.users u
      where u.id = user_permission_sets.user_id
        and u.org_id = public.current_org_id()
    )
  );

create policy number_series_superadmin_all on public.number_series
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy number_series_org_member_view on public.number_series
  for select using (org_id = public.current_org_id());

create policy audit_log_superadmin_all on public.audit_log
  for all using (public.is_superadmin()) with check (public.is_superadmin());
create policy audit_log_org_member_view on public.audit_log
  for select using (org_id = public.current_org_id());

create policy modules_all_read on public.modules
  for select using (true);
create policy modules_superadmin_all on public.modules
  for all using (public.is_superadmin()) with check (public.is_superadmin());

commit;

-- Confirmation query to run after migration:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
