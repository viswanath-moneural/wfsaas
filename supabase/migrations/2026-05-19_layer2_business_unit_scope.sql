-- Layer 2 Step 2: Business Unit scoping for Object Engine metadata

alter table public.element_definitions
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.data_point_definitions
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.data_bond_definitions
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.data_rule_definitions
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.screen_design_definitions
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.screen_design_assignments
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

alter table public.metadata_cache
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

-- Backfill: default all existing metadata rows to the first active business unit in each org.
with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.element_definitions d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.data_point_definitions d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.data_bond_definitions d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.data_rule_definitions d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.screen_design_definitions d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.screen_design_assignments d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

with first_bu as (
  select distinct on (org_id) org_id, id as business_unit_id
  from public.business_units
  where is_active = true
  order by org_id, created_at asc
)
update public.metadata_cache d
set business_unit_id = f.business_unit_id
from first_bu f
where d.business_unit_id is null
  and d.org_id = f.org_id;

-- BU-scoped uniqueness
alter table public.element_definitions drop constraint if exists element_definitions_org_id_element_key_key;
alter table public.element_definitions add constraint element_definitions_org_bu_element_key_key unique (org_id, business_unit_id, element_key);

alter table public.data_point_definitions drop constraint if exists data_point_definitions_org_id_element_key_field_key_key;
alter table public.data_point_definitions add constraint data_point_definitions_org_bu_element_field_key_key unique (org_id, business_unit_id, element_key, field_key);

alter table public.data_bond_definitions drop constraint if exists data_bond_definitions_org_id_bond_key_key;
alter table public.data_bond_definitions add constraint data_bond_definitions_org_bu_bond_key_key unique (org_id, business_unit_id, bond_key);

alter table public.data_rule_definitions drop constraint if exists data_rule_definitions_org_id_element_key_rule_key_key;
alter table public.data_rule_definitions add constraint data_rule_definitions_org_bu_element_rule_key_key unique (org_id, business_unit_id, element_key, rule_key);

alter table public.screen_design_definitions drop constraint if exists screen_design_definitions_org_id_element_key_design_name_key;
alter table public.screen_design_definitions add constraint screen_design_definitions_org_bu_element_design_name_key unique (org_id, business_unit_id, element_key, design_name);

alter table public.metadata_cache drop constraint if exists metadata_cache_org_id_cache_key_key;
alter table public.metadata_cache add constraint metadata_cache_org_bu_cache_key_key unique (org_id, business_unit_id, cache_key);

create index if not exists idx_element_def_org_bu on public.element_definitions(org_id, business_unit_id, is_active);
create index if not exists idx_dp_def_org_bu_element on public.data_point_definitions(org_id, business_unit_id, element_key);
create index if not exists idx_bond_def_org_bu_from on public.data_bond_definitions(org_id, business_unit_id, from_element_key);
create index if not exists idx_rule_def_org_bu_element on public.data_rule_definitions(org_id, business_unit_id, element_key, is_active);
create index if not exists idx_screen_design_org_bu_element on public.screen_design_definitions(org_id, business_unit_id, element_key, is_default);
create index if not exists idx_metadata_cache_org_bu_key on public.metadata_cache(org_id, business_unit_id, cache_key, expires_at);

-- RLS refresh to enforce business unit isolation.
drop policy if exists element_definitions_org_isolation on public.element_definitions;
create policy element_definitions_business_unit_isolation on public.element_definitions
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

drop policy if exists data_point_definitions_org_isolation on public.data_point_definitions;
create policy data_point_definitions_business_unit_isolation on public.data_point_definitions
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

drop policy if exists data_bond_definitions_org_isolation on public.data_bond_definitions;
create policy data_bond_definitions_business_unit_isolation on public.data_bond_definitions
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

drop policy if exists data_rule_definitions_org_isolation on public.data_rule_definitions;
create policy data_rule_definitions_business_unit_isolation on public.data_rule_definitions
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

drop policy if exists screen_design_definitions_org_isolation on public.screen_design_definitions;
create policy screen_design_definitions_business_unit_isolation on public.screen_design_definitions
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

drop policy if exists screen_design_assignments_org_isolation on public.screen_design_assignments;
create policy screen_design_assignments_business_unit_isolation on public.screen_design_assignments
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

drop policy if exists metadata_cache_org_isolation on public.metadata_cache;
create policy metadata_cache_business_unit_isolation on public.metadata_cache
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
