-- Superadmin audit log v2
-- Keeps existing WFSAAS audit_log columns and adds Salesforce-style audit fields.

begin;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  table_name text,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz default now(),
  created_at timestamptz default now(),
  created_by uuid,
  last_modified_at timestamptz,
  last_modified_by uuid
);

alter table public.audit_log add column if not exists actor_id uuid references public.users(id);
alter table public.audit_log add column if not exists actor_email text;
alter table public.audit_log add column if not exists entity_type text;
alter table public.audit_log add column if not exists entity_id uuid;
alter table public.audit_log add column if not exists entity_name text;
alter table public.audit_log add column if not exists changes jsonb;
alter table public.audit_log add column if not exists ip_address text;
alter table public.audit_log add column if not exists user_agent text;

update public.audit_log
set actor_id = coalesce(actor_id, changed_by),
    entity_type = coalesce(entity_type, table_name, 'unknown'),
    entity_id = coalesce(entity_id, record_id),
    changes = coalesce(changes, jsonb_build_object('before', old_data, 'after', new_data))
where actor_id is null
   or entity_type is null
   or entity_id is null
   or changes is null;

alter table public.audit_log alter column action set not null;
alter table public.audit_log alter column entity_type set default 'unknown';
alter table public.audit_log alter column entity_type set not null;

create index if not exists idx_audit_log_org_created_at on public.audit_log(org_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_actor on public.audit_log(actor_id);
create index if not exists idx_audit_log_action on public.audit_log(action);

alter table public.audit_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_log'
      and policyname = 'audit_log_superadmin_read'
  ) then
    create policy audit_log_superadmin_read
      on public.audit_log
      for select
      using (public.is_superadmin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_log'
      and policyname = 'audit_log_superadmin_all'
  ) then
    create policy audit_log_superadmin_all
      on public.audit_log
      for all
      using (public.is_superadmin(auth.uid()))
      with check (public.is_superadmin(auth.uid()));
  end if;
end $$;

commit;
