# QA and UAT Test Plan

## Test Environment

- Vercel preview or production deployment.
- Supabase project with latest migrations applied.
- At least one platform superadmin.
- At least one organisation.
- At least one business unit/business unit.
- Required number series configured.
- Seed masters: customer, vendor, product, material, warehouse.

## Superadmin Onboarding

1. Login as platform superadmin.
2. Open Configuration -> Organisation.
3. Create a new organisation.
4. Open Configuration -> Business Units.
5. Create first business unit.
6. Confirm business unit selector shows the business unit.
7. Confirm configuration pages are no longer blocked by missing business unit context.

Expected result: superadmin can create and manage platform records without RLS errors.

## Organisation and Business Unit Setup

1. Create organisation settings.
2. Create business unit.
3. Create warehouse.
4. Create customer, vendor, product, and material.
5. Configure number series for:
   - sales order
   - dispatch order
   - invoice
   - customer payment
   - vendor payment
   - purchase order
   - GRN

Expected result: all transaction prerequisites are available.

## User, Role, and Module Setup

1. Create role.
2. Enable modules.
3. Create user and assign role/business unit.
4. Login as user.
5. Verify allowed modules show and restricted modules/actions are hidden or disabled.

Expected result: user access follows module and role permissions.

## Sales E2E

1. Create sales order.
2. Add order lines in detail page.
3. Confirm order.
4. Create dispatch from order.
5. Create invoice from order.
6. Record customer payment against invoice.
7. Verify invoice status updates to partial or paid as applicable.
8. Verify dashboard KPI changes.

Expected result: sales order -> dispatch -> invoice -> payment flow completes without manual codes.

## Purchase E2E

1. Create purchase order.
2. Add purchase order material lines.
3. Approve order.
4. Create GRN against PO.
5. Add GRN received/rejected quantities.
6. Record vendor payment.
7. Verify purchase order received/closed display state.
8. Verify dashboard KPI changes.

Expected result: PO -> GRN -> vendor payment flow completes and respects statuses.

## Inventory E2E

1. Open stock balances.
2. Create raw-material movement.
3. Create finished-goods movement.
4. Create stock adjustment.
5. Verify movement and adjustment lists.
6. Verify stock views and dashboard indicators.

Expected result: stock activity is visible and business-unit-scoped.

## Multi-Business Unit Isolation

1. Create two business units under one organisation.
2. Create different customer/vendor/product/material data in each.
3. Switch business unit.
4. Verify each business unit sees only its own data.
5. Login as a business-unit-scoped non-admin user.
6. Attempt direct navigation to records from another business unit.

Expected result: cross-business unit data is not readable or writable.

## Mobile Web Smoke Test

1. Open app on mobile viewport.
2. Verify login.
3. Verify bottom nav.
4. Verify configuration list/create pages stack cleanly.
5. Verify sales order creation.
6. Verify purchase order creation.
7. Verify inventory movement creation.

Expected result: core flows are usable without layout overlap.

## Regression Checks

- Auth callback still works.
- Sign out works.
- Public WhatsApp webhook remains reachable.
- Middleware protects app pages.
- Vercel build passes.
- Empty states render when no business unit or no data exists.







