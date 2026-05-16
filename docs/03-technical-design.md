# Technical Design Document

## Stack

- Next.js 16 App Router.
- React 19.
- TypeScript.
- Supabase SSR/browser clients.
- Supabase Auth and Postgres.
- Vercel deployment.
- Tailwind CSS 4 plus custom CSS tokens.
- Meta WhatsApp webhook integration.

## Routing Model

The app uses route groups:

- `app/(auth)`: login and registration pages without the protected app shell.
- `app/(app)`: protected application routes wrapped by `AuthProvider` and `AppShell`.
- `app/api/auth/callback`: Supabase auth callback.
- `app/api/webhook`: public WhatsApp webhook route.

Middleware protects non-public routes and redirects unauthenticated users to `/login`.

## Client Access Model

Most current application pages use the browser Supabase client from `lib/supabase.ts`. This means inserts and updates run as the authenticated user and are subject to Supabase RLS.

Server-side Supabase helpers exist in `lib/supabase.server.ts`, but most business pages are currently client components.

## Auth Context

`lib/AuthContext.tsx` loads:

- Supabase Auth user.
- Matching `public.users` row.
- Organisation context.
- Available business units.
- Active business unit from local storage or fallback business unit.
- Enabled organisation modules.
- Active role and module permissions.
- Field permissions.

The context exposes:

- `user`
- `org`
- `business unit`
- `business units`
- `permissions`
- `switchBusiness Unit`
- `refreshAuth`
- `signOut`

## Number Series

`lib/numberSeries.ts` provides `generateNextCode(business unitId, entityType)`. It reads active `number_series_config`, increments `current_value`, and builds the next document code using prefix, suffix, separator, financial year, month, and digit padding.

Currently used for:

- `sales_order`
- `dispatch_order`
- `invoice`
- `customer_payment`
- `vendor_payment`

Current gap:

- Purchase order and GRN pages still appear to accept manual `po_code` and `grn_code`.

## Transaction Helpers

`lib/transactions.ts` centralizes:

- Sales statuses.
- Purchase statuses.
- Allowed status transitions.
- Invoice total calculations.
- Money formatting.
- Editability checks for sales and purchase statuses.

## Known Technical Gaps

- Superadmin app bypass exists, but database writes can still fail when RLS blocks client-side inserts.
- Organisation creation currently runs from the browser client and is therefore RLS-dependent.
- Some `MODULE_REGISTRY` links point to routes not yet implemented, such as manufacturing routes, reports routes, some sales subroutes, CRM parties, HR salary, and configuration custom fields/WhatsApp.
- User creation currently inserts into `public.users`; it does not create Supabase Auth credentials by itself.
- PO/GRN auto-numbering should be aligned with the number-series generator.
- Live Supabase schema was not introspected by this documentation pass; database details are based on the latest shared schema and local migration files.







