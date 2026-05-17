-- Layer 2: Object Engine canonical schema (restart baseline)
-- Terminology aligned:
-- Element Registry, Data Points, Data Bonds, Data Rules, Screen Designs, Metadata Cache

create table if not exists public.element_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  element_key text not null,
  element_name text not null,
  element_name_plural text not null,
  description text,
  icon text,
  color text,
  table_name text not null,
  is_core boolean not null default true,
  is_active boolean not null default true,
  is_searchable boolean not null default true,
  has_activity_log boolean not null default true,
  sort_order integer default 0,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references public.users(id),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id),
  unique (org_id, element_key)
);

create table if not exists public.data_point_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  element_key text not null,
  field_key text not null,
  field_label text not null,
  field_type text not null,
  is_core boolean not null default false,
  is_required boolean not null default false,
  is_unique boolean not null default false,
  is_read_only boolean not null default false,
  is_system boolean not null default false,
  is_searchable boolean not null default true,
  is_sortable boolean not null default true,
  is_filterable boolean not null default true,
  default_value text,
  help_text text,
  description text,
  placeholder text,
  options jsonb default '[]'::jsonb,
  formula text,
  formula_return_type text,
  min_value numeric,
  max_value numeric,
  decimal_places integer default 2,
  max_length integer,
  lookup_element_key text,
  lookup_display_field text,
  lookup_filter jsonb,
  sort_order integer default 0,
  is_active boolean not null default true,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references public.users(id),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id),
  unique (org_id, element_key, field_key)
);

create table if not exists public.data_bond_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  bond_key text not null,
  bond_name text not null,
  bond_type text not null,
  from_element_key text not null,
  from_field_key text not null,
  to_element_key text not null,
  to_field_key text not null default 'id',
  display_field_key text,
  related_list_label text,
  show_related_list boolean not null default true,
  on_delete text not null default 'restrict',
  is_core boolean not null default false,
  is_required boolean not null default false,
  junction_table text,
  created_at timestamptz default now(),
  created_by uuid references public.users(id),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id),
  unique (org_id, bond_key)
);

create table if not exists public.data_rule_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  element_key text not null,
  rule_key text not null,
  rule_name text not null,
  description text,
  trigger_on text[] not null default '{insert,update}',
  condition_formula text not null,
  error_message text not null,
  error_field_key text,
  is_active boolean not null default true,
  sort_order integer default 0,
  created_at timestamptz default now(),
  created_by uuid references public.users(id),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id),
  unique (org_id, element_key, rule_key)
);

create table if not exists public.screen_design_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  element_key text not null,
  design_name text not null default 'Default Layout',
  is_default boolean not null default false,
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references public.users(id),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id),
  unique (org_id, element_key, design_name)
);

create table if not exists public.screen_design_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  screen_design_id uuid not null references public.screen_design_definitions(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  element_key text not null,
  created_at timestamptz default now(),
  created_by uuid references public.users(id)
);

create table if not exists public.metadata_cache (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  cache_key text not null,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  unique (org_id, cache_key)
);

create index if not exists idx_element_def_org on public.element_definitions(org_id, is_active);
create index if not exists idx_dp_def_element on public.data_point_definitions(org_id, element_key);
create index if not exists idx_dp_def_type on public.data_point_definitions(field_type);
create index if not exists idx_bond_def_from on public.data_bond_definitions(org_id, from_element_key);
create index if not exists idx_bond_def_to on public.data_bond_definitions(org_id, to_element_key);
create index if not exists idx_rule_def_element on public.data_rule_definitions(org_id, element_key, is_active);
create index if not exists idx_screen_design_element on public.screen_design_definitions(org_id, element_key, is_default);
create index if not exists idx_metadata_cache_key on public.metadata_cache(org_id, cache_key, expires_at);

alter table public.element_definitions enable row level security;
alter table public.data_point_definitions enable row level security;
alter table public.data_bond_definitions enable row level security;
alter table public.data_rule_definitions enable row level security;
alter table public.screen_design_definitions enable row level security;
alter table public.screen_design_assignments enable row level security;
alter table public.metadata_cache enable row level security;

drop policy if exists element_definitions_org_isolation on public.element_definitions;
create policy element_definitions_org_isolation on public.element_definitions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_point_definitions_org_isolation on public.data_point_definitions;
create policy data_point_definitions_org_isolation on public.data_point_definitions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_bond_definitions_org_isolation on public.data_bond_definitions;
create policy data_bond_definitions_org_isolation on public.data_bond_definitions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists data_rule_definitions_org_isolation on public.data_rule_definitions;
create policy data_rule_definitions_org_isolation on public.data_rule_definitions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists screen_design_definitions_org_isolation on public.screen_design_definitions;
create policy screen_design_definitions_org_isolation on public.screen_design_definitions
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists screen_design_assignments_org_isolation on public.screen_design_assignments;
create policy screen_design_assignments_org_isolation on public.screen_design_assignments
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());

drop policy if exists metadata_cache_org_isolation on public.metadata_cache;
create policy metadata_cache_org_isolation on public.metadata_cache
for all
using (public.is_superadmin(auth.uid()) or org_id = public.current_org_id())
with check (public.is_superadmin(auth.uid()) or org_id = public.current_org_id());
