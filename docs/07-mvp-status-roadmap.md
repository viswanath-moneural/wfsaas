# MVP Status and Roadmap

## Current Status

The codebase is ahead of the previous README. The current repository contains implemented routes for configuration, sales, purchases, inventory, CRM basics, HR basics, and dashboard.

MVP 1 is not fully production-complete yet because onboarding, RLS, auto-numbering consistency, route completeness, and UAT still need hardening.

## Implemented In Code

### Foundation

- Auth pages.
- Protected app shell.
- Middleware auth guard.
- Sidebar/topbar/mobile navigation.
- Tenant context and factory switching.
- Permission helper functions.

### Configuration

- Organisation.
- Factories/tenants.
- Users.
- Roles.
- Modules.
- Number series.
- Customers.
- Vendors.
- Products.
- Materials.
- Warehouses.

### Sales

- Sales overview.
- Sales orders list/create/detail.
- Dispatch list/create/detail.
- Invoices list/create/detail.
- Customer payments list/create/detail.

### Purchases

- Purchase overview.
- Purchase orders list/create/detail.
- GRN list/create/detail.
- Vendor payments list/create/detail.

### Inventory

- Stock levels.
- Movements.
- Adjustments.

### Dashboard

- Open sales orders.
- Unpaid invoices.
- Open purchase orders.
- Pending GRNs.
- Low stock indicators.
- Recent movements and payments.

### CRM and HR Basics

- CRM: leads, opportunities, quotes, interactions.
- HR: employees, attendance, payroll.

## Immediate Blockers

- Superadmin RLS: organisation creation and other platform writes still fail if Supabase RLS does not allow them.
- User onboarding: creating a `public.users` row is not the same as creating Supabase Auth login credentials.
- Auto-numbering: PO and GRN still need to use number series consistently.
- Missing routes: module registry includes several routes that do not yet exist.
- Mobile tenant switching: selector is hidden in the top bar on small screens.
- README/docs were stale before this documentation pack.

## MVP 1 Completion Criteria

- Superadmin can create organisation and factory without RLS deadlock.
- Admin can create users with login credentials and app mappings.
- All required documents are auto-numbered from `number_series_config`.
- Sales flow passes UAT.
- Purchase flow passes UAT.
- Inventory flow passes UAT.
- Dashboard reflects active tenant data.
- Tenant isolation and admin permissions are verified.
- Vercel production build is passing.

## MVP 2 Roadmap

- Manufacturing: BOM, work orders, production runs, material usage, machines, downtime, quality.
- CRM: full party/account/contact/contact-role UI, quote line items, opportunity conversion.
- HR: salary structures, attendance workflows, payroll approvals.
- Reports: saved reports, exports, scheduled reports, filters.
- Finance: expenses, tax rates, GST-oriented invoice/report improvements.
- SaaS billing: subscription plans, usage snapshots, billing invoices, gateway events.
- Support: support tickets, ticket messages, attachments, changelog.
- WhatsApp: onboarding, templates, operational entry, notifications, delivery tracking.

## Suggested Next Development Order

1. Fix superadmin DB-side access with RLS policies or service-role actions.
2. Build proper user onboarding that creates Supabase Auth users and app users together.
3. Finish PO/GRN number series.
4. Hide or implement missing module registry routes.
5. Run full MVP1 UAT on deployed Vercel.
6. Start manufacturing or CRM depth based on customer demo priority.
