-- Layer 2: Element Engine foundation
-- Canonical terminology:
-- elements, data_points, data_bonds, data_rules, screen_designs

create table if not exists public.elements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  api_name text not null,
  label text not null,
  description text,
  element_type text not null default 'adaptive' check (element_type in ('core', 'adaptive')),
  is_core boolean not null default false,
  storage_strategy text not null default 'physical_table' check (storage_strategy in ('physical_table', 'adaptive_json')),
  physical_table_name text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (org_id, api_name)
);

create table if not exists public.record_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  element_id uuid not null references public.elements(id) on delete cascade,
  api_name text not null,
  label text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (element_id, api_name)
);

create table if not exists public.data_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  element_id uuid not null references public.elements(id) on delete cascade,
  api_name text not null,
  label text not null,
  description text,
  data_point_type text not null default 'adaptive' check (data_point_type in ('core', 'adaptive')),
  field_type text not null check (field_type in ('text', 'number', 'date', 'datetime', 'boolean', 'picklist', 'lookup', 'formula', 'currency', 'email', 'phone', 'textarea', 'json')),
  is_required boolean not null default false,
  is_unique boolean not null default false,
  is_readonly boolean not null default false,
  default_value jsonb,
  options jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (element_id, api_name)
);

create table if not exists public.data_bonds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  source_element_id uuid not null references public.elements(id) on delete cascade,
  source_data_point_id uuid references public.data_points(id) on delete set null,
  target_element_id uuid not null references public.elements(id) on delete cascade,
  bond_type text not null check (bond_type in ('lookup', 'required_lookup', 'master_detail', 'many_to_many')),
  api_name text not null,
  label text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (org_id, source_element_id, api_name)
);

create table if not exists public.data_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  element_id uuid not null references public.elements(id) on delete cascade,
  api_name text not null,
  label text not null,
  description text,
  expression jsonb not null default '{}'::jsonb,
  error_message text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (element_id, api_name)
);

create table if not exists public.screen_designs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  element_id uuid not null references public.elements(id) on delete cascade,
  record_type_id uuid references public.record_types(id) on delete set null,
  actor_role_id uuid references public.profiles(id) on delete set null,
  layout_name text not null default 'Default Screen',
  is_default boolean not null default false,
  sections jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create table if not exists public.element_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  element_id uuid not null references public.elements(id) on delete cascade,
  record_type_id uuid references public.record_types(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

create index if not exists idx_elements_org_bu on public.elements(org_id, business_unit_id);
create index if not exists idx_elements_api on public.elements(org_id, api_name);
create index if not exists idx_record_types_element on public.record_types(element_id);
create index if not exists idx_data_points_element on public.data_points(element_id, sort_order);
create index if not exists idx_data_bonds_source on public.data_bonds(source_element_id);
create index if not exists idx_data_bonds_target on public.data_bonds(target_element_id);
create index if not exists idx_data_rules_element on public.data_rules(element_id);
create index if not exists idx_screen_designs_element on public.screen_designs(element_id, business_unit_id, record_type_id, actor_role_id);
create index if not exists idx_element_records_element on public.element_records(element_id, business_unit_id);

alter table public.elements enable row level security;
alter table public.record_types enable row level security;
alter table public.data_points enable row level security;
alter table public.data_bonds enable row level security;
alter table public.data_rules enable row level security;
alter table public.screen_designs enable row level security;
alter table public.element_records enable row level security;

drop policy if exists elements_org_scope on public.elements;
create policy elements_org_scope on public.elements
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists record_types_org_scope on public.record_types;
create policy record_types_org_scope on public.record_types
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_points_org_scope on public.data_points;
create policy data_points_org_scope on public.data_points
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_bonds_org_scope on public.data_bonds;
create policy data_bonds_org_scope on public.data_bonds
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_rules_org_scope on public.data_rules;
create policy data_rules_org_scope on public.data_rules
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists screen_designs_org_scope on public.screen_designs;
create policy screen_designs_org_scope on public.screen_designs
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists element_records_business_unit_scope on public.element_records;
create policy element_records_business_unit_scope on public.element_records
for all
using (
  public.is_superadmin(auth.uid())
  or (
    org_id = public.current_org_id()
    and business_unit_id = public.current_business_unit_id()
  )
)
with check (
  public.is_superadmin(auth.uid())
  or (
    org_id = public.current_org_id()
    and business_unit_id = public.current_business_unit_id()
  )
);
