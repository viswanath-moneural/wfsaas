-- Page Layout Builder
-- Stores Salesforce-style form layouts per Business Unit and module.

create table if not exists public.page_layouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  module_key text not null,
  layout_name text not null default 'Default Layout',
  is_default boolean not null default false,
  sections jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  last_modified_at timestamptz default now(),
  last_modified_by uuid references public.users(id)
);

alter table public.page_layouts
  add column if not exists business_unit_id uuid references public.business_units(id) on delete cascade;

update public.page_layouts pl
set business_unit_id = bu.id
from (
  select distinct on (org_id) id, org_id
  from public.business_units
  where coalesce(is_active, true) = true
  order by org_id, coalesce(is_default, false) desc, created_at asc
) bu
where pl.business_unit_id is null
  and pl.org_id = bu.org_id;

alter table public.page_layouts
  alter column business_unit_id set not null;

drop index if exists public.idx_page_layouts_org_module;
drop index if exists public.idx_page_layouts_one_default_per_module;

create index if not exists idx_page_layouts_org_business_unit_module
  on public.page_layouts(org_id, business_unit_id, module_key);

create unique index if not exists idx_page_layouts_one_default_per_module
  on public.page_layouts(org_id, business_unit_id, module_key)
  where is_default = true;

alter table public.page_layouts enable row level security;

drop policy if exists page_layouts_superadmin_all on public.page_layouts;
drop policy if exists page_layouts_org_member_select on public.page_layouts;
drop policy if exists page_layouts_org_admin_all on public.page_layouts;

create policy page_layouts_superadmin_all on public.page_layouts
  for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy page_layouts_org_member_select on public.page_layouts
  for select
  using (
    org_id = public.current_org_id()
    and business_unit_id = public.current_business_unit_id()
  );

create policy page_layouts_org_admin_all on public.page_layouts
  for all
  using (
    public.is_org_admin(auth.uid())
    and org_id = public.current_org_id()
    and exists (
      select 1
      from public.business_units bu
      where bu.id = page_layouts.business_unit_id
        and bu.org_id = public.current_org_id()
    )
  )
  with check (
    public.is_org_admin(auth.uid())
    and org_id = public.current_org_id()
    and exists (
      select 1
      from public.business_units bu
      where bu.id = page_layouts.business_unit_id
        and bu.org_id = public.current_org_id()
    )
  );
