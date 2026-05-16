-- Salesforce-style ERP entity model migration
-- Date: 2026-05-16
-- Notes:
-- 1) Run on a staging DB first.
-- 2) This script is additive-safe where possible, then backfills, then constraints.
-- 3) Review TODO sections before enforcing NOT NULL constraints in production.

begin;

-- =========================================================
-- A) PARTIES: canonical legal-entity root
-- =========================================================
alter table if exists public.parties
  add column if not exists parent_party_id uuid null references public.parties(id),
  add column if not exists legal_name text null,
  add column if not exists phone text null,
  add column if not exists email text null,
  add column if not exists website text null,
  add column if not exists country text null default 'India';

create index if not exists ix_parties_business_unit_parent
  on public.parties(business_unit_id, parent_party_id);

create index if not exists ix_parties_business_unit_name
  on public.parties(business_unit_id, lower(party_name));

create unique index if not exists uq_parties_business_unit_code
  on public.parties(business_unit_id, lower(party_code));

create unique index if not exists uq_parties_business_unit_gst_nonnull
  on public.parties(business_unit_id, lower(gst_number))
  where gst_number is not null and length(trim(gst_number)) > 0;

-- =========================================================
-- B) CUSTOMERS/VENDORS: role profiles under party
-- =========================================================
alter table if exists public.customers
  add column if not exists party_id uuid null references public.parties(id),
  add column if not exists credit_limit numeric null,
  add column if not exists payment_terms text null;

alter table if exists public.vendors
  add column if not exists party_id uuid null references public.parties(id),
  add column if not exists payment_terms text null;

-- =========================================================
-- C) CONTACTS: keep contact master linked to party
-- =========================================================
alter table if exists public.contact_persons
  add column if not exists business_unit_id uuid null references public.business_units(id),
  add column if not exists is_active boolean not null default true,
  add column if not exists department text null;

create index if not exists ix_contact_persons_business_unit_party
  on public.contact_persons(business_unit_id, party_id);

-- =========================================================
-- D) CONTACT ROLES: context-specific assignment table
-- =========================================================
create table if not exists public.contact_roles (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  contact_person_id uuid not null references public.contact_persons(id),

  customer_id uuid null references public.customers(id),
  vendor_id uuid null references public.vendors(id),
  sales_order_id uuid null references public.sales_orders(id),
  invoice_id uuid null references public.invoices(id),
  purchase_order_id uuid null references public.purchase_orders(id),

  role_type text not null, -- sales|billing|dispatch|accounts|procurement|owner
  is_primary boolean not null default false,
  notes text null,

  created_at timestamptz not null default now(),
  created_by uuid null,
  last_modified_at timestamptz null,
  last_modified_by uuid null,

  constraint chk_contact_roles_one_scope check (
    (case when customer_id is not null then 1 else 0 end) +
    (case when vendor_id is not null then 1 else 0 end) +
    (case when sales_order_id is not null then 1 else 0 end) +
    (case when invoice_id is not null then 1 else 0 end) +
    (case when purchase_order_id is not null then 1 else 0 end) = 1
  )
);

create index if not exists ix_contact_roles_contact
  on public.contact_roles(business_unit_id, contact_person_id);
create index if not exists ix_contact_roles_customer
  on public.contact_roles(business_unit_id, customer_id);
create index if not exists ix_contact_roles_vendor
  on public.contact_roles(business_unit_id, vendor_id);

create unique index if not exists uq_contact_roles_primary_customer
  on public.contact_roles(business_unit_id, customer_id, role_type)
  where customer_id is not null and is_primary = true;

create unique index if not exists uq_contact_roles_primary_vendor
  on public.contact_roles(business_unit_id, vendor_id, role_type)
  where vendor_id is not null and is_primary = true;

-- =========================================================
-- E) CRM relation remap: party_id -> customer_id
-- =========================================================
alter table if exists public.quotes
  add column if not exists customer_id uuid null references public.customers(id);
alter table if exists public.opportunities
  add column if not exists customer_id uuid null references public.customers(id);
alter table if exists public.interactions
  add column if not exists customer_id uuid null references public.customers(id);

-- =========================================================
-- F) Backfill helpers
-- =========================================================
-- 1) Backfill business_unit_id on contact_persons from party
update public.contact_persons cp
set business_unit_id = p.business_unit_id
from public.parties p
where cp.party_id = p.id
  and cp.business_unit_id is null;

-- 2) Create missing party rows for customers using customer identity
insert into public.parties (
  id, business_unit_id, party_code, party_name, legal_name,
  gst_number, phone, address, city, state, is_active,
  created_at, created_by, last_modified_at, last_modified_by
)
select
  gen_random_uuid(), c.business_unit_id,
  c.customer_code, c.customer_name, c.company_name,
  c.gst_number, c.mobile, c.address, c.city, c.state, c.is_active,
  c.created_at, c.created_by, c.last_modified_at, c.last_modified_by
from public.customers c
where c.party_id is null;

-- 3) Link customers to party by strongest available key
update public.customers c
set party_id = p.id
from public.parties p
where c.party_id is null
  and c.business_unit_id = p.business_unit_id
  and (
    (c.gst_number is not null and p.gst_number is not null and lower(trim(c.gst_number)) = lower(trim(p.gst_number)))
    or (lower(trim(c.customer_code)) = lower(trim(p.party_code)))
  );

-- 4) Create missing party rows for vendors
insert into public.parties (
  id, business_unit_id, party_code, party_name, legal_name,
  gst_number, phone, is_active,
  created_at, created_by, last_modified_at, last_modified_by
)
select
  gen_random_uuid(), v.business_unit_id,
  v.vendor_code, v.vendor_name, v.vendor_name,
  v.gst_number, v.phone_number, v.is_active,
  v.created_at, v.created_by, v.last_modified_at, v.last_modified_by
from public.vendors v
where v.party_id is null;

-- 5) Link vendors to party by key
update public.vendors v
set party_id = p.id
from public.parties p
where v.party_id is null
  and v.business_unit_id = p.business_unit_id
  and (
    (v.gst_number is not null and p.gst_number is not null and lower(trim(v.gst_number)) = lower(trim(p.gst_number)))
    or (lower(trim(v.vendor_code)) = lower(trim(p.party_code)))
  );

-- 6) Backfill CRM customer_id from party_id where customer exists for the same party
update public.quotes q
set customer_id = c.id
from public.customers c
where q.customer_id is null
  and q.party_id = c.party_id
  and q.business_unit_id = c.business_unit_id;

update public.opportunities o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and o.party_id = c.party_id
  and o.business_unit_id = c.business_unit_id;

update public.interactions i
set customer_id = c.id
from public.customers c
where i.customer_id is null
  and i.party_id = c.party_id
  and i.business_unit_id = c.business_unit_id;

-- =========================================================
-- G) Constraints after backfill
-- =========================================================
-- TODO: verify these counts are 0 before enabling NOT NULL:
-- select count(*) from public.customers where party_id is null;
-- select count(*) from public.vendors where party_id is null;
-- select count(*) from public.contact_persons where business_unit_id is null;

create unique index if not exists uq_customers_business_unit_code
  on public.customers(business_unit_id, lower(customer_code));
create unique index if not exists uq_customers_business_unit_party
  on public.customers(business_unit_id, party_id)
  where party_id is not null;

create unique index if not exists uq_vendors_business_unit_code
  on public.vendors(business_unit_id, lower(vendor_code));
create unique index if not exists uq_vendors_business_unit_party
  on public.vendors(business_unit_id, party_id)
  where party_id is not null;

commit;

-- =========================================================
-- Post-migration follow-up (manual after app cutover)
-- =========================================================
-- 1) Update app to use:
--    - parties as canonical legal entity root
--    - customers/vendors as role profiles
--    - contact_roles for context-specific contact assignment
-- 2) After app cutover + validation:
--    - drop quotes.party_id, opportunities.party_id, interactions.party_id
--    - optionally add NOT NULL on customers.party_id, vendors.party_id, contact_persons.business_unit_id



