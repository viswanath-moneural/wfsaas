# Database Design Document

## Source of Truth Note

This document is based on the latest schema shared from Supabase, the local repository queries, and the migration file `supabase/migrations/2026-05-16_party_customer_vendor_contact_roles.sql`. Live Supabase introspection was not available during this documentation update.

## Core Hierarchy

```text
organisations
  -> org_settings
  -> org_modules
  -> org_subscriptions
  -> roles / users / permissions
  -> tenants
      -> customers / vendors / products / materials / warehouses
      -> sales / purchases / inventory / production / HR / CRM transactions
```

## Module-Wise Table Inventory

### Core Platform and Access

`organisations`, `tenants`, `users`, `roles`, `user_roles`, `role_permissions`, `field_permissions`, `field_permission_templates`, `org_modules`, `org_settings`, `custom_field_definitions`, `custom_field_values`, `audit_log`, `api_keys`, `number_series_config`, `number_series_log`

### Sales and Receivables

`customers`, `sales_orders`, `sales_order_items`, `dispatch_orders`, `dispatch_order_items`, `invoices`, `invoice_items`, `customer_payments`, `sales_returns`, `sales_return_items`, `price_lists`, `price_list_items`, `pricing`, `sales`

### Purchases and Payables

`vendors`, `vendor_products`, `purchase_orders`, `purchase_order_items`, `goods_receipt_notes`, `grn_items`, `purchase_returns`, `purchase_return_items`, `vendor_payments`, `purchases`

### Inventory and Warehousing

`materials`, `material_types`, `stock_levels`, `stock_movements`, `stock_adjustments`, `stock_alerts_config`, `inventory_ledger`, `finished_goods_stock`, `finished_goods_movements`, `warehouses`, `warehouse_locations`

### Manufacturing and Quality

`products`, `product_categories`, `product_variants`, `product_specs`, `product_packaging_options`, `product_images`, `product_bundles`, `product_bundle_items`, `bill_of_materials`, `work_orders`, `production_runs`, `material_usage`, `quality_checks`, `machines`, `machine_downtime_logs`, `operators`

### CRM

`parties`, `contact_persons`, `contact_roles`, `leads`, `lead_sources`, `opportunities`, `quotes`, `quote_items`, `interactions`

### HR and Workforce

`employees`, `attendance`, `shifts_config`, `salary_structure`, `payroll_runs`

### Finance, Tax, and Expenses

`hsn_codes`, `tax_rates`, `expenses`, `expense_categories`

### Reporting and Analytics

`saved_filters`, `saved_reports`, `report_schedules`, `export_jobs`, `export_quota_usage`, `dashboard_layouts`, `alerts`, `tasks`

### SaaS Billing and Subscriptions

`subscription_plans`, `org_subscriptions`, `subscription_plan_changes`, `billing_invoices`, `billing_invoice_items`, `payment_transactions`, `payment_gateway_events`, `org_usage_snapshots`

### Support and Changelog

`support_categories`, `support_tickets`, `support_ticket_messages`, `support_ticket_attachments`, `changelog_entries`, `changelog_reads`, `changelog_tags`

### WhatsApp

`whatsapp_accounts`, `whatsapp_sessions`, `whatsapp_templates`, `messages`, `notification_delivery_log`

## Party, Customer, Vendor, Contact Model

Target Salesforce-style model:

- `parties`: canonical legal/account entity.
- `customers`: customer role profile under a party.
- `vendors`: vendor role profile under a party.
- `contact_persons`: contact identity linked to a party.
- `contact_roles`: context-specific contact assignment for customer, vendor, sales order, invoice, or purchase order.
- `parties.parent_party_id`: parent/child account hierarchy.

This allows one company to be both a customer and a vendor while preserving one legal/account root.

## Transaction Flows

### Sales

```text
customers
  -> sales_orders
      -> sales_order_items
      -> dispatch_orders
      -> invoices
          -> invoice_items
          -> customer_payments
```

### Purchases

```text
vendors
  -> purchase_orders
      -> purchase_order_items
      -> goods_receipt_notes
          -> grn_items
      -> vendor_payments
```

### Inventory

```text
materials/products
  -> stock_movements / finished_goods_movements
  -> stock_adjustments
  -> stock_levels / finished_goods_stock views
```

## RLS Strategy

Tenant-scoped tables should enforce:

```sql
tenant_id = (
  select tenant_id from public.users where id = auth.uid()
)
```

Org-scoped tables should enforce:

```sql
org_id = (
  select org_id from public.users where id = auth.uid()
)
```

Superadmin/platform operations need one of:

- RLS bypass policies using app metadata/JWT role or `public.users.role`.
- Service-role server actions/API routes for privileged writes.

Important: `stock_levels` and `finished_goods_stock` are views, so table RLS commands such as `ALTER TABLE ... ENABLE ROW SECURITY` cannot be applied directly to them.

## Current Risk Areas

- RLS policies may not yet match the desired superadmin behavior.
- Client-side organisation creation cannot bypass RLS.
- User onboarding must coordinate Supabase Auth users and `public.users` rows.
- PO/GRN number-series behavior is not yet consistent with sales-side documents.
