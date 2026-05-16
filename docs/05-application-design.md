# Application Design Document

## Application Shape

WFSAAS is a protected ERP web application with auth pages outside the shell and all operational pages inside a shared app shell.

## Current Route Map

### Auth and Public

- `/login`
- `/register`
- `/privacy`
- `/api/auth/callback`
- `/api/webhook`

### Protected Core

- `/dashboard`
- `/configuration`
- `/sales`
- `/purchases`
- `/inventory`
- `/crm`
- `/hr`

### Configuration

- `/configuration/organisation`
- `/configuration/tenants`
- `/configuration/users`
- `/configuration/roles`
- `/configuration/modules`
- `/configuration/number-series`
- `/configuration/customers`
- `/configuration/vendors`
- `/configuration/products`
- `/configuration/materials`
- `/configuration/warehouses`

### Sales

- `/sales/orders`
- `/sales/orders/[id]`
- `/sales/dispatch`
- `/sales/dispatch/[id]`
- `/sales/invoices`
- `/sales/invoices/[id]`
- `/sales/payments`
- `/sales/payments/[id]`

### Purchases

- `/purchases/orders`
- `/purchases/orders/[id]`
- `/purchases/grn`
- `/purchases/grn/[id]`
- `/purchases/payments`
- `/purchases/payments/[id]`

### Inventory

- `/inventory/stock`
- `/inventory/movements`
- `/inventory/adjustments`

### CRM

- `/crm/leads`
- `/crm/opportunities`
- `/crm/quotes`
- `/crm/interactions`

### HR

- `/hr/employees`
- `/hr/attendance`
- `/hr/payroll`

## Page Patterns

- Landing pages: module overview cards linking to subflows.
- List/create pages: left-side form and right-side data table on desktop.
- Detail pages: document header, status controls, line-item tables.
- Master pages: create form plus master list.
- Tenant-blocked pages: `TenantSetupNotice` with links to factory setup/select flow.
- Dashboard: KPI cards plus recent movement/payment tables.

## Current UI Foundation

- `AppShell`: layout wrapper with sidebar, top bar, content region, and mobile nav.
- `Sidebar`: desktop module navigation.
- `TopBar`: organisation/factory context, factory switcher, create-first-factory CTA, sign out.
- `MobileNav`: bottom mobile navigation for key modules.
- `PageHeader`: consistent title, description, and actions.
- `DataTable`: reusable table with loading/empty/search behavior.
- `Card`, `Button`, `Input`, `Badge`: base UI primitives.

## Mobile Web Design

The current UI includes responsive grids and a mobile bottom nav. Main expectations:

- Forms collapse to single-column.
- Module grids collapse to one column.
- Bottom navigation exposes dashboard, sales, purchases, inventory, and configuration.
- Top-bar tenant selector is hidden on small screens, which needs follow-up UX for factory switching on mobile.
- Data tables need continued hardening for horizontal overflow and scanability on small screens.

## UX Gaps

- Some registry links point to missing routes.
- Superadmin blocked-by-RLS errors need friendlier handling.
- User creation needs clearer distinction between app user row and Supabase Auth credential.
- Purchase and GRN create forms should use auto-numbering like sales documents.
- CRM/HR pages are basic and need detail/edit flows before they are production-complete.
