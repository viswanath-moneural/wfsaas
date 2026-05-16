# WFSAAS ERP

WFSAAS is a multi-organisation ERP SaaS for manufacturing and trading businesses, built with Next.js, Supabase, Vercel, and a Meta WhatsApp webhook integration.

This README is now the short project index. The detailed product, architecture, database, application, security, QA, and operations documentation lives in `docs/`.

## Documentation

1. [Product Requirements](docs/01-product-requirements.md)
2. [Architecture Design](docs/02-architecture-design.md)
3. [Technical Design](docs/03-technical-design.md)
4. [Database Design](docs/04-database-design.md)
5. [Application Design](docs/05-application-design.md)
6. [Security and Access Control](docs/06-security-access-control.md)
7. [MVP Status and Roadmap](docs/07-mvp-status-roadmap.md)
8. [QA and UAT Test Plan](docs/08-qa-uat-test-plan.md)
9. [Deployment and Operations](docs/09-deployment-operations.md)

## Current Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth, Postgres, RLS, and storage-ready data model
- Vercel deployment
- Meta WhatsApp webhook route

## Current Product State

The repository currently contains working foundations for:

- Auth and protected app shell
- Organisation, business unit, user, role, module, number-series, and master configuration pages
- Sales orders, dispatch, invoices, and customer payments
- Purchase orders, GRNs, and vendor payments
- Inventory stock, movements, and adjustments
- Basic dashboard KPIs
- Basic CRM and HR pages
- WhatsApp webhook route retained

Important current gaps are documented in the roadmap and security docs, especially Supabase RLS behavior for superadmin operations and incomplete auto-numbering consistency for PO/GRN.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Set these in `.env.local` and Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_API_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`



