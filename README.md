# Goyal Projects — EOI Platform

Production-grade Expression of Interest (EOI) management platform for Goyal Projects with three portals: **Admin**, **Channel Partner (CP)**, and **Customer**.

## Architecture

```
EOI_CP/
├── apps/web/          # Next.js 15 application (3 portals)
├── packages/
│   ├── ui/            # Design system
│   ├── db/            # Prisma schema + seed
│   ├── auth/          # NextAuth v5 + RBAC
│   ├── types/         # Zod schemas + enums
│   ├── email/         # Brevo notification service
│   └── integrations/  # KYC/SMS/CRM adapters (mock)
└── docker-compose.yml # Local PostgreSQL, Redis, MinIO
```

### End-to-end flow

1. CP registers → admin approves + assigns projects → credentials email
2. CP creates customer lead → sends confirmation email
3. Customer accepts/rejects CP association via `/confirm/[token]`
4. Customer Google login → multi-step EOI form → submit with cheque
5. Admin reviews in verification drawer → approve/reject/correction
6. CP + customer notified; EOI reference ID tracked throughout

## Local development

### Prerequisites

- Node.js 20+
- Docker Desktop

### Setup

```bash
# Start infrastructure
docker compose up -d

# Install dependencies
npm install

# Configure environment
cp .env.example apps/web/.env.local
# Set DATABASE_URL to postgresql://goyal:goyal_dev_password@localhost:5433/goyal_eoi?schema=public

# Push schema and seed
cd packages/db
npx prisma db push
npx tsx prisma/seed.ts

# Start dev server
cd ../../apps/web
npm run dev
```

Open http://localhost:3000 — guests are redirected to `/customer/login`; logged-in users go to their portal.

**Portal entry URLs:** `/login` (admin), `/partner/login` (CP), `/customer/login` (customer)

### Demo credentials (seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@goyalprojects.com | Admin@123 |
| CP | partner@goyalprojects.com | Partner@123 |
| Customer invite | /invite/demo-invite-token-123 | Google as amit.patel@example.com |

## Testing

```bash
# Production build
npm run build --workspace=@goyal/web

# E2E tests (requires PostgreSQL on 5433)
cd apps/web
npx playwright test
```

## Production deployment checklist

1. Set all required env vars: `AUTH_SECRET`, `DATABASE_URL`, `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, S3 credentials, `GOOGLE_CLIENT_ID/SECRET`
2. Run Prisma migrations: `npx prisma migrate deploy` in `packages/db`
3. Configure Brevo sender domain (SPF/DKIM) for `EMAIL_FROM`
4. Set Google OAuth redirect URIs for production domain
5. Create MinIO/S3 bucket with private access; use presigned URLs only
6. Do **not** run seed script in production
7. Deploy via Docker (`docker compose -f docker-compose.prod.yml`), **Render** (`render.yaml`), or **Vercel** (see below)
8. Copy [`.env.cloud.example`](.env.cloud.example) for managed Postgres, Redis, and S3 settings

## Deploy on Vercel

Best for serverless; use **Neon** (Postgres), **Upstash** (Redis), and **AWS S3** or **Cloudflare R2** (files).

1. Import the GitHub repo in [Vercel](https://vercel.com)
2. **Root Directory:** `apps/web` (enable *Include source files outside Root Directory*)
3. Framework preset: **Next.js** (uses [`apps/web/vercel.json`](apps/web/vercel.json))
4. Add environment variables from [`.env.cloud.example`](.env.cloud.example)
5. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Vercel URL (e.g. `https://your-app.vercel.app`)
6. Google OAuth redirect: `https://your-app.vercel.app/api/auth/callback/google`
7. Deploy — build runs `prisma generate`, `migrate deploy`, and `next build`
8. Hourly email retry cron is configured in `vercel.json` (requires `CRON_SECRET` env var)

**Vercel env tips:** Use Neon’s **pooled** connection string for `DATABASE_URL`. Set `S3_FORCE_PATH_STYLE=false` for AWS S3.

## Deploy on Render

Best for a always-on Node server; includes Render Postgres in the blueprint.

1. Connect the repo in [Render](https://render.com) → **New Blueprint** → select [`render.yaml`](render.yaml)
2. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Render web URL (e.g. `https://goyal-eoi-web.onrender.com`)
3. Fill secret env vars: `BREVO_API_KEY`, `GOOGLE_CLIENT_*`, `BLOB_READ_WRITE_TOKEN`, `REDIS_URL` (Upstash), `EMAIL_FROM`
4. Google OAuth redirect: `https://goyal-eoi-web.onrender.com/api/auth/callback/google`
5. Blueprint provisions: **Web service** (standalone), **Postgres**, and **hourly cron** for email retry
6. Migrations run automatically via `preDeployCommand` before each deploy

**Render env tips:** Add `REDIS_URL` from Upstash. Add `BLOB_READ_WRITE_TOKEN` from Vercel Blob (free — no Vercel hosting required).

### Health check

```
GET /api/health
→ { status: "ok", checks: { database: true, storage: true, redis: true } }
```

## Security notes

- PII (PAN, Aadhaar) stored in EOI formData JSON — encrypt at rest in production
- Audit log captures CP approvals, lead creation, customer confirmations, EOI transitions
- Rate limiting on registration, confirmation, and check-status endpoints
- Upload presigns scoped by role and user ID; 10MB limit enforced

## Known limitations

- **E2E Google OAuth** — customer login flow is manual; dev/test uses `/api/test/eoi-submit` with `NODE_ENV=test` or `X-Test-Secret` header (never available in production)
- **Live KYC/CRM vendors** — integration hooks are env-driven; mock providers are used by default until vendor contracts are configured
- **Playwright phase specs** — `settings-enforcement`, `project-assets`, and `search` E2E specs are planned but not yet added

## Production checklist

- Set `PII_ENCRYPTION_KEY`, `REDIS_URL`, `CRON_SECRET`, and `TEST_ROUTE_SECRET` (test only) in production
- Run `npx prisma migrate deploy` in `packages/db` before deploy
- Configure Vercel cron (automatic via `vercel.json`) or Render cron (`render.yaml`) for `POST /api/cron/email-retry` with `CRON_SECRET`
- Redis (Upstash) is required in production for distributed rate limiting — see [`.env.cloud.example`](.env.cloud.example)
- Use `npm run start:standalone` when deploying the Docker/standalone build (`output: "standalone"`)
- **Never run `npm run build` while `npm run dev` is active** — this corrupts `.next` and causes MIME type / 404 errors on static assets. If that happens, stop the server and run `npm run dev:clean`

## CI

GitHub Actions workflow at `.github/workflows/ci.yml` runs build + Playwright on push/PR.
# EOI
