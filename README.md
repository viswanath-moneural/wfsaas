# WFSAAS ERP

Multi-tenant ERP SaaS for manufacturing and trading businesses, built on Next.js + Supabase + Vercel.

## Current Goal (MVP 1)

1. Auth + protected app shell + configuration
2. Sales (orders + invoices + payments)
3. Purchases (PO + GRN)
4. Inventory (stock + movements)
5. Basic dashboard

WhatsApp ingestion remains available and should not be broken during ERP expansion.

## Stack

1. Frontend: Next.js 16 (App Router), React 19
2. Backend: Supabase Postgres + RLS + Realtime
3. Deploy: Vercel
4. Integration: Meta WhatsApp webhook

## Current App Structure

```text
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  (app)/
    layout.tsx
    dashboard/page.tsx
    configuration/
      page.tsx
      tenants/page.tsx
      products/page.tsx
      materials/page.tsx
      customers/page.tsx
      vendors/page.tsx
      warehouses/page.tsx
    sales/
      page.tsx
      orders/page.tsx
      orders/[id]/page.tsx
  api/
    auth/callback/route.ts
    webhook/route.ts
```

## Environment Variables

Required in `.env.local` and Vercel:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `WHATSAPP_VERIFY_TOKEN`
5. `WHATSAPP_API_TOKEN`
6. `WHATSAPP_PHONE_NUMBER_ID`

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database Migration: Party/Customer/Vendor/Contact Roles

Migration file:

`supabase/migrations/2026-05-16_party_customer_vendor_contact_roles.sql`

### What it does

1. Enhances `parties` as canonical legal-entity root
2. Adds/uses `party_id` links on `customers` and `vendors`
3. Keeps `contact_persons` linked to `parties` and adds `tenant_id` support
4. Creates new `contact_roles` table for Salesforce-style role assignments
5. Adds `customer_id` on `quotes`, `opportunities`, `interactions` for party-to-customer remap
6. Backfills core relationships and adds unique indexes

### How to apply

1. Open Supabase SQL Editor (staging first)
2. Run the migration file
3. Validate TODO checks in the SQL comments before applying stricter constraints
4. Cut over application queries to new model
5. Remove legacy `party_id` references from CRM tables after validation

## Data Model Direction

Canonical root:

1. `parties` (account/legal entity, supports parent-child hierarchy)

Role profiles:

1. `customers` (`party_id` + sales defaults)
2. `vendors` (`party_id` + purchase defaults)

People:

1. `contact_persons` (person identity under party)
2. `contact_roles` (context assignment: customer/vendor/sales order/invoice/PO)

## Notes

1. Middleware currently uses `middleware.ts`. Next.js warns about future `proxy` convention migration.
2. Existing README in older commits references legacy WhatsMFG-only structure; this file reflects current ERP direction.
