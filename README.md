# WFSAAS ERP

Multi-tenant ERP SaaS for manufacturing and trading businesses.  
Stack: Next.js 16 + Supabase + Vercel + Meta WhatsApp webhook.

## Current Vercel Build Status

From current codebase state:

1. Auth routes are implemented and protected via middleware.
2. App shell is implemented (`Sidebar`, `TopBar`, protected `(app)` layout).
3. Dashboard is tenant-aware and reading live operational data.
4. Configuration masters are implemented:
   - Tenants
   - Products
   - Materials
   - Customers
   - Vendors
   - Warehouses
5. Sales foundation is implemented:
   - Sales overview
   - Sales orders list/create
   - Sales order detail with item entry and status update
6. Build has been passing in recent runs.

## Implemented vs Pending (MVP 1)

### Implemented

1. Auth + shell + tenant context
2. Basic dashboard foundation
3. Configuration master pages listed above
4. Sales order flow foundation (header + line items)
5. WhatsApp webhook route retained

### Pending

1. Sales invoices + customer payments module pages
2. Purchases (PO + GRN flows)
3. Inventory stock/movements pages
4. Full dashboard KPIs across sales/purchases/inventory
5. Party/contact full app-level cutover (after DB migration and query refactor)

## Full Supabase Table Inventory (Latest Shared Schema)

`alerts`  
`api_keys`  
`attachments`  
`attendance`  
`audit_log`  
`bill_of_materials`  
`billing_invoice_items`  
`billing_invoices`  
`brands`  
`changelog_entries`  
`changelog_reads`  
`changelog_tags`  
`contact_persons`  
`custom_field_definitions`  
`custom_field_values`  
`customer_payments`  
`customers`  
`dashboard_layouts`  
`dispatch_order_items`  
`dispatch_orders`  
`employees`  
`expense_categories`  
`expenses`  
`export_jobs`  
`export_quota_usage`  
`field_permission_templates`  
`field_permissions`  
`finished_goods_movements`  
`finished_goods_stock`  
`goods_receipt_notes`  
`grn_items`  
`hsn_codes`  
`interactions`  
`inventory_ledger`  
`invoice_items`  
`invoices`  
`lead_sources`  
`leads`  
`machine_downtime_logs`  
`machines`  
`material_types`  
`material_usage`  
`materials`  
`messages`  
`module_field_config`  
`notification_delivery_log`  
`number_series_config`  
`number_series_log`  
`onboarding_progress`  
`operators`  
`opportunities`  
`org_modules`  
`org_settings`  
`org_subscriptions`  
`org_usage_snapshots`  
`organisations`  
`parties`  
`payment_gateway_events`  
`payment_transactions`  
`payroll_runs`  
`price_list_items`  
`price_lists`  
`pricing`  
`product_bundle_items`  
`product_bundles`  
`product_categories`  
`product_images`  
`product_packaging_options`  
`product_specs`  
`product_variants`  
`production_runs`  
`products`  
`purchase_order_items`  
`purchase_orders`  
`purchase_return_items`  
`purchase_returns`  
`purchases`  
`quality_checks`  
`quote_items`  
`quotes`  
`report_schedules`  
`role_permissions`  
`roles`  
`salary_structure`  
`sales`  
`sales_order_items`  
`sales_orders`  
`sales_return_items`  
`sales_returns`  
`saved_filters`  
`saved_reports`  
`shifts_config`  
`stock_adjustments`  
`stock_alerts_config`  
`stock_levels`  
`stock_movements`  
`subscription_plan_changes`  
`subscription_plans`  
`support_categories`  
`support_ticket_attachments`  
`support_ticket_messages`  
`support_tickets`  
`tasks`  
`tax_rates`  
`tenants`  
`user_invitations`  
`user_roles`  
`users`  
`vendor_payments`  
`vendor_products`  
`vendors`  
`warehouse_locations`  
`warehouses`  
`whatsapp_accounts`  
`whatsapp_sessions`  
`whatsapp_templates`  
`work_orders`

## Module-wise Grouping

### Core platform and access

`organisations`, `tenants`, `users`, `roles`, `user_roles`, `role_permissions`, `field_permissions`, `field_permission_templates`, `org_modules`, `org_settings`, `custom_field_definitions`, `custom_field_values`, `audit_log`, `api_keys`, `number_series_config`, `number_series_log`

### Sales and receivables

`customers`, `sales_orders`, `sales_order_items`, `dispatch_orders`, `dispatch_order_items`, `invoices`, `invoice_items`, `customer_payments`, `sales_returns`, `sales_return_items`, `price_lists`, `price_list_items`, `pricing`, `sales`

### Purchases and payables

`vendors`, `vendor_products`, `purchase_orders`, `purchase_order_items`, `goods_receipt_notes`, `grn_items`, `purchase_returns`, `purchase_return_items`, `vendor_payments`, `purchases`

### Inventory and warehousing

`materials`, `material_types`, `stock_levels`, `stock_movements`, `stock_adjustments`, `stock_alerts_config`, `inventory_ledger`, `finished_goods_stock`, `finished_goods_movements`, `warehouses`, `warehouse_locations`

### Manufacturing and quality

`products`, `product_categories`, `product_variants`, `product_specs`, `product_packaging_options`, `product_images`, `product_bundles`, `product_bundle_items`, `bill_of_materials`, `work_orders`, `production_runs`, `material_usage`, `quality_checks`, `machines`, `machine_downtime_logs`, `operators`

### CRM

`parties`, `contact_persons`, `leads`, `lead_sources`, `opportunities`, `quotes`, `quote_items`, `interactions`

### HR and workforce

`employees`, `attendance`, `shifts_config`, `salary_structure`, `payroll_runs`

### Finance, tax, expenses

`hsn_codes`, `tax_rates`, `expenses`, `expense_categories`

### Reporting and analytics

`saved_filters`, `saved_reports`, `report_schedules`, `export_jobs`, `export_quota_usage`, `dashboard_layouts`, `alerts`, `tasks`

### SaaS billing and subscriptions

`subscription_plans`, `org_subscriptions`, `subscription_plan_changes`, `billing_invoices`, `billing_invoice_items`, `payment_transactions`, `payment_gateway_events`, `org_usage_snapshots`

### Support and changelog

`support_categories`, `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `changelog_entries`, `changelog_reads`, `changelog_tags`

### WhatsApp integration

`whatsapp_accounts`, `whatsapp_sessions`, `whatsapp_templates`, `messages`, `notification_delivery_log`, plus API route `app/api/webhook/route.ts`

### Onboarding

`onboarding_progress`

## New Party/Customer/Vendor/Contact Model and Migration Status

Target design (Salesforce-style):

1. `parties` = canonical account/legal entity root
2. `customers` and `vendors` = role profiles under party (`party_id`)
3. `contact_persons` = person identity under party
4. `contact_roles` = context assignment (customer/vendor/sales_order/invoice/purchase_order)
5. Optional hierarchy: `parties.parent_party_id`

Migration file added in repo:

`supabase/migrations/2026-05-16_party_customer_vendor_contact_roles.sql`

Migration status:

1. Script is prepared in repository.
2. It has not been executed by this agent on live Supabase.
3. Run in staging first, verify backfill counts and constraints, then apply to production.

## Environment Variables

Set in `.env.local` and Vercel:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `WHATSAPP_VERIFY_TOKEN`
5. `WHATSAPP_API_TOKEN`
6. `WHATSAPP_PHONE_NUMBER_ID`

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
