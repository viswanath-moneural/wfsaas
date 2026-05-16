# Product Requirements Document

## Product Goal

WFSAAS is a multi-organisation ERP SaaS for small and mid-sized manufacturing and trading businesses. The first target segment is operational businesses such as paper cup business units, distributors, and small manufacturers that need sales, purchases, inventory, production, HR, and reporting in one practical system.

The product should feel simpler than large ERP suites while still preserving ERP discipline: business unit isolation, document numbering, permissions, auditability, transaction status lifecycles, and reliable operational dashboards.

## Target Users

- Platform superadmin: WFSAAS product owner/team, manages organisations and platform setup.
- Organisation owner/admin: customer company owner or administrator, manages business units, users, roles, modules, and master data.
- Manager: handles day-to-day sales, purchases, stock, production, and approvals.
- Accountant: handles invoices, payments, payables, payroll, taxes, and reporting.
- Operator: enters production, attendance, machine, and stock activity.
- Viewer/CEO: reviews dashboards, reports, and status without changing operational data.

## MVP 1 Scope

MVP 1 is the first complete operational vertical:

- Auth and protected app shell.
- Organisation/business unit setup.
- Configuration masters: customers, vendors, products, materials, warehouses, users, roles, modules, and number series.
- Sales: sales order, dispatch, invoice, customer payment.
- Purchases: purchase order, GRN, vendor payment.
- Inventory: stock balances, material/finished-goods movements, adjustments.
- Basic dashboard with sales, purchase, inventory, movement, and payment indicators.
- Mobile web compatibility for core pages.

## Post-MVP Scope

- Manufacturing: BOM, work orders, production runs, material usage, machines, downtime, quality checks.
- CRM depth: parties/accounts, contacts, contact roles, leads, opportunities, quotes, interactions, follow-ups.
- HR depth: employee master, attendance, shifts, salary structure, payroll workflow.
- Reports: saved filters, exports, scheduled reports, dashboards.
- SaaS billing: plans, subscriptions, usage, billing invoices, payment gateway events.
- Support and changelog: tickets, ticket messages, attachments, release notes.
- WhatsApp workflows: structured operational entry, notifications, templates, sessions.

## Success Criteria

MVP 1 is successful when an admin can onboard a company, create a business unit, configure required masters and number series, and complete these flows end to end:

- Sales order -> dispatch -> invoice -> customer payment.
- Purchase order -> GRN -> vendor payment.
- Inventory movement/adjustment -> stock view/dashboard visibility.
- Role/module permissions affect the UI and protected actions.
- Business Unit A data is isolated from Business Unit B data.
- The product is usable on desktop and mobile web for the above flows.

## Acceptance Checklist

- A superadmin can reach platform configuration without business unit deadlock.
- An organisation admin can create business units and assign users.
- Number series exists for all required transaction documents.
- Each transaction page has a clear empty state and prerequisite guidance.
- Dashboard reflects active business unit data.
- Supabase RLS behavior is verified for business unit isolation and superadmin/platform operations.







