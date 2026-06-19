# Sitara — WhatsApp-First Restaurant Reputation Platform

A web-based SaaS platform that helps Indian restaurants manage their online reputation through WhatsApp surveys, review aggregation, and AI-powered reply drafting.

## Quick Start (for anyone cloning this repo)

### Prerequisites
- **Node.js 18+** (recommended: 20+) — [download here](https://nodejs.org/)
- **npm 9+** (comes with Node.js)

That's it. No Docker, no PostgreSQL, no external accounts needed. Everything runs locally with SQLite.

### Step-by-step Setup

```bash
# 1. Clone the repo
git clone https://github.com/bhawneetkaur09-eng/Sitara.git
cd Sitara

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ..

# 3. Create the .env file for the backend
cat > backend/.env << 'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="sitara-dev-secret-change-in-production"
JWT_EXPIRATION="7d"
PORT=3001

# AI (Google Gemini) — leave empty for simulated template-based replies
GEMINI_API_KEY=

# WhatsApp (Meta Cloud API) — leave empty for simulated mode
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=sitara-dev-verify
EOF

# 4. Create the database and fill it with demo data
cd backend
npx prisma db push
npx ts-node prisma/seed.ts
cd ..

# 5. Start both servers
# Terminal 1: Backend (runs on http://localhost:3001)
cd backend && npm run start:dev

# Terminal 2: Frontend (runs on http://localhost:3000)
cd frontend && npm run dev
```

### Demo Login
- **Email:** owner@spicegarden.in
- **Password:** sitara123

Or create a new account at `/register`.

## What happens at each step?

| Step | What it does |
|------|-------------|
| `npm install` | Downloads all JavaScript packages (node_modules/) |
| `cat > .env` | Creates the config file with database path and secrets |
| `prisma db push` | Creates a local `dev.db` SQLite file with all tables |
| `ts-node prisma/seed.ts` | Fills the database with 2 demo restaurants, reviews, surveys, and alerts |
| `npm run start:dev` | Starts the backend API server with hot-reload |
| `npm run dev` | Starts the frontend Next.js server with hot-reload |

## Project Structure

```
Sitara/
├── frontend/                # Next.js (App Router, TypeScript, Tailwind CSS)
│   └── src/
│       ├── app/
│       │   ├── login/       # Login page
│       │   ├── register/    # Signup page
│       │   └── dashboard/
│       │       ├── page.tsx        # KPI dashboard
│       │       ├── reviews/        # Unified review inbox
│       │       ├── surveys/        # WhatsApp surveys
│       │       ├── alerts/         # Manager alerts
│       │       ├── billing/        # Plan management + checkout
│       │       ├── compliance/     # DPDP Act compliance
│       │       └── settings/       # QR code, gating, voice settings
│       ├── hooks/           # usePlanFeatures hook
│       └── lib/api.ts       # API client + TypeScript types
├── backend/                 # NestJS (TypeScript)
│   ├── src/
│   │   ├── auth/            # JWT login, register, guards
│   │   ├── reviews/         # Reviews CRUD + AI reply + sync
│   │   ├── surveys/         # WhatsApp surveys + QR scan handling
│   │   ├── alerts/          # Manager alerts + recovery loop
│   │   ├── billing/         # Plan tiers + feature gating
│   │   ├── compliance/      # DPDP consent, data retention, export
│   │   ├── restaurants/     # Multi-location + settings
│   │   ├── whatsapp/        # Meta Cloud API (simulated in dev)
│   │   ├── ai/              # Gemini / simulated AI replies
│   │   ├── qr/              # QR code generation
│   │   └── prisma/          # Database service
│   └── prisma/
│       ├── schema.prisma    # Database schema (all tables)
│       └── seed.ts          # Demo data
└── docker-compose.yml       # PostgreSQL + Redis (for production only)
```

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, Recharts, Lucide icons
- **Backend:** NestJS, Prisma ORM, JWT auth, bcrypt
- **Database:** SQLite (dev) / PostgreSQL (production)
- **AI:** Google Gemini API (optional, runs in simulated mode without API key)
- **WhatsApp:** Meta Cloud API (optional, runs in simulated mode without token)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create new account + restaurant |
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/logout | Clear auth cookie |
| GET | /api/auth/me | Get current user |
| GET | /api/reviews | List reviews (filterable by source, sort) |
| GET | /api/reviews/stats | Dashboard statistics |
| POST | /api/reviews/:id/reply | Reply to a review |
| POST | /api/reviews/:id/draft-reply | AI-generated reply draft |
| POST | /api/reviews/sync | Simulate fetching new reviews |
| POST | /api/surveys/send | Send WhatsApp survey |
| GET | /api/surveys | List surveys |
| GET | /api/surveys/stats | Survey analytics |
| POST | /api/surveys/simulate-scan | Test QR code scan flow |
| GET | /api/alerts | List alerts |
| POST | /api/alerts/:id/resolve | Resolve alert (optional review nudge) |
| GET | /api/billing/plans | Get plan tiers |
| GET | /api/billing | Current plan + usage |
| POST | /api/billing/change-plan | Switch plan |
| GET | /api/billing/features | Feature flags for current plan |
| GET | /api/restaurant/locations | List all locations |
| POST | /api/restaurant/switch/:id | Switch location (new JWT) |
| POST | /api/restaurant/add-location | Add new location |
| GET | /api/restaurant/settings | Get restaurant settings |
| PATCH | /api/restaurant/settings | Update settings |
| GET | /api/compliance/consent-stats | Customer consent stats |
| POST | /api/compliance/purge-stale | Purge data older than 12 months |
| GET | /api/compliance/export | Export customer data (JSON) |
| GET | /api/qr | Get QR code data URL |
| GET | /api/qr/download | Download QR code as SVG |

## Switching to PostgreSQL (for production)

1. Change `provider` in `backend/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
2. Update `DATABASE_URL` in `backend/.env`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/sitara"
   ```
3. Run: `cd backend && npx prisma db push && npx ts-node prisma/seed.ts`
