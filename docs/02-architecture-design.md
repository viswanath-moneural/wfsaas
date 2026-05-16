# Architecture Design Document

## Architecture Summary

WFSAAS uses a layered SaaS architecture:

```text
Platform
  -> Organisation
      -> Tenant / Factory
          -> Modules
              -> Masters and Transactions
```

The platform layer represents WFSAAS itself. An organisation represents a customer company. A tenant represents a factory, branch, plant, or operating unit. Most operational data is tenant-scoped.

## Core Hierarchy

- `organisations`: customer company/account.
- `org_settings`: GST, currency, timezone, fiscal year, and company-level settings.
- `org_modules`: enabled modules per organisation.
- `org_subscriptions`: SaaS plan and billing state.
- `tenants`: factories/branches under an organisation.
- Transaction tables: almost always carry `tenant_id`.
- Org-level administration tables: carry `org_id`.

## Module Architecture

- Core platform: organisations, tenants, users, roles, permissions, modules, settings, number series, audit.
- Configuration: organisation, factories, users, roles, modules, number series, customers, vendors, products, materials, warehouses.
- Sales: customers, orders, dispatch, invoices, payments, returns, pricing.
- Purchases: vendors, purchase orders, GRNs, returns, vendor payments.
- Inventory: materials, finished goods, warehouses, stock balances, movements, adjustments.
- Manufacturing: products, BOM, work orders, production runs, material usage, quality, machines.
- CRM: parties, contacts, leads, opportunities, quotes, interactions.
- HR: employees, attendance, payroll, shifts, salary structures.
- Reports: saved reports, filters, schedules, exports, dashboard layouts.
- WhatsApp: accounts, sessions, templates, messages, delivery log, webhook route.

## Permission Architecture

Application access is based on:

- `users`: application user profile mapped to Supabase Auth user id.
- `roles`: organisation roles.
- `user_roles`: active role assignments.
- `role_permissions`: module-level create/read/update/delete grants.
- `field_permissions`: table/field-level view/edit grants.
- `org_modules`: whether a module is available to an organisation.

App-side permission helper behavior:

- Admin-like users can bypass module permission checks.
- Non-admin users need both module enablement and role permission.
- Field-level permissions default to view allowed and edit denied when no explicit field rule exists.

## Superadmin Architecture

The desired product behavior is that superadmin can manage all organisations, tenants, and records.

There are two layers to implement this safely:

- App-side bypass: UI and application permission checks treat `superadmin`, `owner`, and `admin` as unrestricted.
- Database-side bypass: Supabase RLS policies or service-role server actions must allow platform operations that normal tenant users cannot perform.

Current code has app-side bypass logic in the auth/permission layer. True database bypass still depends on Supabase RLS policies or moving privileged actions to server-side service-role routes/actions.

## Data Isolation

Operational tables should be tenant-isolated by `tenant_id`. Organisation-level tables should be isolated by `org_id`. Platform superadmin operations need explicit bypass rules or service-role execution.

## Integration Boundaries

- Supabase Auth handles identity and sessions.
- `public.users` handles application profile, role, org, tenant, and active state.
- Supabase Postgres stores ERP data.
- Vercel hosts the Next.js app.
- Meta WhatsApp webhook route remains public and uses server-side Supabase access.
