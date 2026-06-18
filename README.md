# Sitara — WhatsApp-First Restaurant Reputation Platform

A web-based SaaS platform that helps Indian restaurants manage their online reputation through WhatsApp surveys, review aggregation, and AI-powered reply drafting.

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm 9+

### Setup

```bash
# Install all dependencies
cd frontend && npm install
cd ../backend && npm install

# Run database migration and seed
cd backend
npx prisma migrate dev --name init --schema prisma/schema.prisma
npx ts-node prisma/seed.ts

# Start both servers (from project root)
cd ..
npm run dev
```

Or start them separately:

```bash
# Terminal 1: Backend (port 3001)
cd backend && npm run start:dev

# Terminal 2: Frontend (port 3000)
cd frontend && npm run dev
```

### Demo Login
- **Email:** owner@spicegarden.in
- **Password:** sitara123

## Project Structure

```
sitara/
├── frontend/          # Next.js 16 (App Router, TypeScript, Tailwind CSS)
│   └── src/
│       ├── app/       # Pages (login, dashboard, reviews, alerts, settings)
│       └── lib/       # API client
├── backend/           # NestJS (TypeScript)
│   ├── src/
│   │   ├── auth/      # JWT authentication
│   │   ├── prisma/    # Database service
│   │   ├── reviews/   # Reviews CRUD + stats
│   │   └── alerts/    # Manager alerts
│   └── prisma/
│       ├── schema.prisma  # Database schema
│       └── seed.ts        # Demo data
└── docker-compose.yml     # PostgreSQL + Redis (for production)
```

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, Recharts, Lucide icons
- **Backend:** NestJS, Prisma ORM, JWT auth
- **Database:** SQLite (dev) / PostgreSQL (production)
- **Cache/Queue:** Redis (production, via Docker)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login with email/password |
| POST | /api/auth/logout | Clear auth cookie |
| GET | /api/auth/me | Get current user |
| GET | /api/reviews | List reviews (filterable) |
| GET | /api/reviews/stats | Dashboard statistics |
| POST | /api/reviews/:id/reply | Reply to a review |
| GET | /api/alerts | List alerts |
| GET | /api/alerts/count | Get open alert count |
| POST | /api/alerts/:id/resolve | Resolve an alert |
