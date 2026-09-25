# EchoGPT — Submission

Backend REST API + minimal React client for **EchoGPT**, a multi-AI-chat application.
Users register, configure their own AI providers (OpenAI / Anthropic / any
OpenAI-compatible endpoint), and chat through them with full conversation history.

---

## Deliverables checklist

| Deliverable | Location | Status |
|---|---|---|
| **GitHub repository** | https://github.com/amhrahat/autogpt | ✅ |
| **README with setup instructions** | [`README.md`](./README.md) | ✅ |
| **Database migration files** | [`prisma/migrations/`](./prisma/migrations/) | ✅ |
| **API documentation (Swagger)** | http://localhost:3001/api/docs (live when running) | ✅ |
| **Sample `.env.example`** | [`.env.example`](./.env.example) | ✅ |
| **Postman collection** (optional) | [`postman/EchoGPT.postman_collection.json`](./postman/EchoGPT.postman_collection.json) | ✅ |

---

## 1. GitHub repository

```
https://github.com/amhrahat/autogpt
```

Clone and run the entire stack with Docker:

```bash
git clone https://github.com/amhrahat/autogpt.git
cd autogpt

cp .env.example .env          # placeholders work for local dev
docker compose up --build -d
```

On first start the API container automatically applies migrations and seeds the first
admin user. Nothing else to configure.

| Service | URL |
|---|---|
| API | http://localhost:3001/api |
| **Swagger docs** | **http://localhost:3001/api/docs** |
| PostgreSQL | host port `5433` |

**Tech stack:** NestJS (TypeScript strict) · Prisma · PostgreSQL 16 · JWT access+refresh
with rotation · bcrypt · `@nestjs/swagger` · helmet · CORS allowlist · rate limiting
(`@nestjs/throttler`) · AES-256-GCM encryption for provider API keys.

**Test accounts** (seeded / created on this instance):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@echogpt.local` | `ChangeMe123!` |
| User | `test@example.com` | `Passw0rd123` |

(Admin credentials come from `.env`; you can also register a fresh account.)

---

## 2. README with setup instructions

Full setup lives in [`README.md`](./README.md). It covers:

- Requirements (Docker, or Node 18 + Postgres for no-Docker dev)
- Clone → `.env` → `docker compose up --build` (headline flow)
- Frontend setup (`cd frontend && npm install && npm run dev`)
- Stop / restart / logs commands
- Environment variables table
- API overview and project layout

**Quick start (backend only):**

```bash
cp .env.example .env
docker compose up --build -d
# API:     http://localhost:3001/api
# Swagger: http://localhost:3001/api/docs
```

**Run without Docker:**

```bash
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```

**Frontend (optional demo client):**

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## 3. Database migration files

Committed Prisma migrations under [`prisma/migrations/`](./prisma/migrations/):

```
prisma/migrations/
  20260925055411_init/
    migration.sql        # full initial schema — 8 tables + 3 enums
  migration_lock.toml
```

**Schema** ([`prisma/schema.prisma`](./prisma/schema.prisma)) — normalized, with foreign
keys and indexes on lookup columns (`userId`, `providerId`, etc.):

| Table | Purpose |
|---|---|
| `User` | accounts, roles (USER/ADMIN), bcrypt password hash |
| `Session` | refresh tokens for rotation + revocation |
| `Subscription` | plan, status, monthly quota, usage |
| `AiProvider` | provider config; API key stored AES-256-GCM encrypted |
| `Conversation` | chat threads |
| `ChatMessage` | user/assistant messages + token counts |
| `WebSearch` | search query history |
| `ApiUsageLog` | per-request audit log |

Migrations run automatically in Docker on container start
(`npx prisma migrate deploy`). Manually:

```bash
npx prisma migrate deploy      # apply
npx prisma migrate dev         # create + apply in dev
```

---

## 4. API documentation (Swagger)

Interactive OpenAPI docs are served by the running app at:

```
http://localhost:3001/api/docs
```

Every endpoint is documented with request/response DTOs, auth requirements, and error
shapes. Use the **Authorize** button (paste an access token from login) to call
protected routes.

All routes are versioned under `/api/v1`. Summary:

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` (rotation) ·
`POST /auth/logout` · `POST /auth/logout-all` · `GET /auth/me`

**User** — `GET|PATCH /user/me` · `POST /user/me/password` · `DELETE /user/me` ·
admin: `GET /admin/users`, `PATCH|DELETE /admin/users/:id`

**AI Providers** — `GET|POST /providers` · `GET|PATCH|DELETE /providers/:id` ·
`POST /providers/:id/health` (keys encrypted at rest, never returned)

**Chat** — `POST /chat/messages` · `GET /chat/conversations` ·
`GET /chat/conversations/:id/messages` · `PATCH|DELETE /chat/conversations/:id`

**Subscription** — `GET /subscription/me` · `POST /subscription/me/plan`
(FREE 100 / PRO 1000 / TEAM unlimited req/mo)

**Web Search** — `POST /search` · `GET /search/history` · `GET /search/recent` ·
`GET /search/suggestions`

**Admin** — `GET /admin/dashboard` · `GET /admin/analytics/usage` ·
`GET /admin/analytics/top-users` · `GET /admin/logs` · `GET /admin/health` ·
`GET /admin/subscriptions`

---

## 5. Sample `.env.example`

Committed at [`.env.example`](./.env.example) — every variable the app needs, placeholder
values only:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://echogpt:echogpt_password@localhost:5432/echogpt?schema=public

# JWT — replace with long random strings in production
JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption key for AI provider API keys at rest (AES-256) — 32-byte hex (64 chars)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS — comma-separated origins
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,chrome-extension://<extension-id>

# First admin seed (used by `npm run seed`)
ADMIN_EMAIL=admin@echogpt.local
ADMIN_PASSWORD=ChangeMe123!
ADMIN_NAME=Admin
```

The frontend has its own [`frontend/.env.example`](./frontend/.env.example) with a single
`VITE_API_BASE_URL`.

---

## 6. Postman collection (optional)

Committed at
[`postman/EchoGPT.postman_collection.json`](./postman/EchoGPT.postman_collection.json).

Import into Postman, then:

1. Set the `baseUrl` variable (default `http://localhost:3001/api/v1`).
2. Run **Auth → Login** (or Register) — the collection **auto-stores the access token**
   for every subsequent request via a test script.
3. All other requests (Providers, Chat, Subscription, Search, Admin) are ready to send.

Collection variables (`accessToken`, `refreshToken`, `providerId`, `conversationId`) are
populated automatically as you go.

---

## Beyond the core spec

- **Frontend** — a minimal Vite + React + TypeScript client
  ([`frontend/`](./frontend/)) covering Login/Register, Providers, Chat, and Settings.
- **Tests** — unit tests for auth token rotation and chat quota/ownership: `npm test`.

---

## Notes

- Host ports are `3001` (API) and `5433` (Postgres) to avoid clashing with any local
  services on `3000`/`5432`. Both are configurable in `docker-compose.yml`.
- Provider API keys are encrypted with AES-256-GCM and are never returned in any response
  or written to logs.
