# Security and Access Control Document

## Identity Model

WFSAAS uses two related user concepts:

- Supabase Auth user: controls login credentials, password, email auth, session cookies, and `auth.uid()`.
- `public.users` row: controls application profile, organisation, tenant, role, active state, phone, and app-level permissions.

A user must have a Supabase Auth identity to log in. After login, the app loads `public.users` using the auth user id.

## App Access Model

Application access is determined by:

- `users.is_active`
- `users.org_id`
- `users.tenant_id`
- `users.role`
- active `user_roles`
- `role_permissions`
- `field_permissions`
- `org_modules`

## Role Model

Current expected role family:

- `superadmin`: platform owner/team.
- `owner`: organisation owner.
- `admin`: organisation administrator.
- `manager`: operational manager.
- `accountant`: finance/payables/receivables.
- `operator`: floor-level entry.
- `viewer`: read-only user.

The actual database enum must include any role used by the app. If the enum does not contain `superadmin` or `admin`, inserts will fail.

## Superadmin Bypass

Desired product behavior: superadmin can create, read, update, and delete all records across all organisations and tenants.

Current app-side behavior:

- Auth/permission logic treats `superadmin`, `owner`, and `admin` as admin-like.
- UI controls are enabled for admin-like users.

Required DB-side behavior:

- RLS policies must explicitly allow superadmin operations, or privileged writes must move to service-role server actions/API routes.

Without DB-side support, browser-client inserts will still fail with RLS errors.

## RLS Templates

Tenant table policy pattern:

```sql
create policy "tenant isolation"
on public.some_tenant_table
for all
using (
  tenant_id = (select tenant_id from public.users where id = auth.uid())
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) in ('superadmin', 'owner', 'admin')
  )
)
with check (
  tenant_id = (select tenant_id from public.users where id = auth.uid())
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) in ('superadmin', 'owner', 'admin')
  )
);
```

Org table policy pattern:

```sql
create policy "org isolation"
on public.some_org_table
for all
using (
  org_id = (select org_id from public.users where id = auth.uid())
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) in ('superadmin', 'owner', 'admin')
  )
)
with check (
  org_id = (select org_id from public.users where id = auth.uid())
  or exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) in ('superadmin', 'owner', 'admin')
  )
);
```

Platform table policy pattern:

```sql
create policy "superadmin platform access"
on public.organisations
for all
using (
  exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) = 'superadmin'
  )
)
with check (
  exists (
    select 1 from public.users
    where id = auth.uid()
      and lower(role::text) = 'superadmin'
  )
);
```

## Current Failure Modes

- `new row violates row-level security policy`: app-side permission allowed the click, but Supabase RLS blocked the write.
- `invalid input value for enum user_role`: app is trying to store a role not present in the enum.
- Missing `public.users` row: login succeeds in Supabase Auth but application context fails.
- Missing `org_id`: tenant and org-scoped configuration cannot load correctly.
- Creating `public.users` without a matching Supabase Auth user causes foreign key failures if `users.id` references auth users.

## Recommended Direction

For production, use service-role server actions/API routes for platform administration:

- create organisation
- create first factory
- create Supabase Auth user
- create matching `public.users` row
- assign roles

Continue using user-session client queries for normal tenant-scoped operational data, protected by RLS.
