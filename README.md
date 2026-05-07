# WhatsMFG 🏭

WhatsApp-native factory floor monitoring for small manufacturers.

## Stack
- **Frontend**: Next.js 15 + Tailwind CSS — deployed on Vercel
- **Database**: Supabase (PostgreSQL + RLS + Realtime)
- **WhatsApp**: Meta Cloud API (direct, no BSP)

## Phase 1 Goal
Prove the workflow with 0 → 50 factories. No queue, no workers — just webhook → DB → dashboard.

---

## Setup

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/whatsmfg.git
cd whatsmfg
npm install
```

### 2. Environment Variables
```bash
cp .env.local.example .env.local
```
Fill in all values in `.env.local` — see comments in the file.

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → Secret key |
| `WHATSAPP_VERIFY_TOKEN` | Make up any string — must match Meta webhook config |
| `WHATSAPP_API_TOKEN` | Meta Developer Console → WhatsApp → API Setup |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Console → WhatsApp → API Setup |

---

## Webhook Setup (Meta)

1. Deploy to Vercel: `npx vercel --prod`
2. Go to Meta Developer Console → WhatsApp → Configuration
3. Set Callback URL: `https://your-app.vercel.app/api/webhook`
4. Set Verify Token: same value as `WHATSAPP_VERIFY_TOKEN`
5. Subscribe to `messages` field

---

## Project Structure

```
whatsmfg/
├── app/
│   ├── api/webhook/route.ts   # WhatsApp webhook (GET verify + POST ingest)
│   ├── dashboard/page.tsx     # Factory owner dashboard
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Redirects to /dashboard
├── lib/
│   ├── parser.ts              # Message classifier + production parser
│   ├── supabase.ts            # Supabase client (anon + admin)
│   ├── types.ts               # TypeScript interfaces
│   └── whatsapp.ts            # Send WhatsApp replies via Meta API
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
├── README.md
└── tsconfig.json
```

## Message Format (Operators)

Operators send messages in this format:
```
MCH-01 Day P001 50pkts 100cups
```

| Part | Example | Meaning |
|---|---|---|
| Machine | `MCH-01` | Machine code |
| Shift | `Day` or `Night` | Shift |
| Product | `P001` | Product code |
| Packets | `50pkts` | Packets produced |
| Cups | `100cups` | Cups per packet |
