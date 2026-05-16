# Deployment and Operations Document

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Required in `.env.local` and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

## Deployment Flow

Current workflow:

1. Code changes are made locally in VS Code.
2. Changes are committed through Git/GitHub Desktop.
3. GitHub branch pushes trigger Vercel preview/production deployments.
4. Supabase remains the shared backend.

## Supabase Operations

Before production testing:

- Apply required migrations.
- Verify enum values, especially `user_role`.
- Verify RLS policies for all org-scoped and business-unit-scoped tables.
- Verify superadmin bypass strategy.
- Configure initial organisation and superadmin user mapping.
- Configure number series for required transaction documents.

## Required Migration Awareness

Local migration:

```text
supabase/migrations/2026-05-16_party_customer_vendor_contact_roles.sql
```

Purpose:

- Adds Salesforce-style party/customer/vendor/contact-role structure.
- Backfills parties for customers/vendors.
- Adds contact roles.
- Adds CRM customer references.

Run in staging first, verify counts, then apply to production.

## Production Checklist

- Vercel build passes.
- Environment variables are set.
- Supabase RLS policies are applied.
- Superadmin can create organisations and business units.
- Auth user exists for platform superadmin.
- Matching `public.users` row exists.
- Required roles and permissions exist.
- Required modules are enabled.
- Required number series are active.
- At least one business unit, customer, vendor, product, material, and warehouse exists for UAT.
- WhatsApp webhook token is configured.

## Backup and Rollback

- Export Supabase schema before major migrations.
- Take database backup before production migration.
- Apply migrations first to staging.
- Keep Vercel deployment rollback available.
- Avoid destructive schema changes until app cutover is complete.

## Admin Onboarding Checklist

1. Create Supabase Auth user.
2. Create or confirm organisation.
3. Create matching `public.users` row with `org_id`, role, phone, email, and active status.
4. Create role row if missing.
5. Assign role in `user_roles`.
6. Login and verify app context.
7. Create first business unit.
8. Configure modules and number series.
9. Add masters.
10. Run UAT flows.






