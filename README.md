# EchoGPT

REST API + minimal web client for **EchoGPT**, a multi-AI-chat app. Users register,
configure their own AI providers (OpenAI / Anthropic / any OpenAI-compatible endpoint),
and chat through them with full conversation history.

- `backend/` is **not** — the NestJS API lives in this repo root (`src/`, `prisma/`, `docker-compose.yml`)
- `frontend/` — Vite + React + TypeScript demo client

## Requirements

- **Docker + Docker Compose** (only thing needed to run the whole project), or
- Node.js 18+ and a local PostgreSQL 16 if you prefer running without Docker

## Run from GitHub (Docker — recommended)

```bash
git clone https://github.com/<your-username>/echogpt.git
cd echogpt

cp .env.example .env       # placeholders work for local dev; change secrets for anything real
docker compose up --build -d
```

That's it. On first start the API container automatically:

1. applies all Prisma migrations,
2. seeds the first admin user (from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`),
3. starts listening.

| Service | URL |
|---|---|
| API | http://localhost:3001/api |
| Swagger docs | http://localhost:3001/api/docs |
| Frontend (optional, see below) | http://localhost:5173 |
| PostgreSQL | host port **5433** (5432 left free for any local Postgres) |

### Run the frontend too

The frontend is a separate Vite app:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and log in (register a new account, or use the seeded admin
from your `.env`). It talks to the API on `:3001` via `VITE_API_BASE_URL` in
`frontend/.env` (copy `frontend/.env.example` if it doesn't exist).

### Stopping / restarting

```bash
docker compose down          # stop (database data persists)
docker compose up -d         # start again
docker compose down -v       # stop AND wipe the database
docker compose logs api -f   # follow API logs
```

### First thing to try

1. Open http://localhost:3001/api/docs — Swagger UI for every endpoint
2. Register via the frontend, or `POST /api/v1/auth/register` in Swagger
3. Add an AI provider (needs a real API key from OpenAI/Anthropic to actually chat)
4. Send a chat message and watch it appear in the conversation history

## Backend stack

- NestJS (TypeScript strict) + Prisma + PostgreSQL 16
- JWT access + refresh tokens with rotation, bcrypt password hashing
- `@nestjs/swagger` docs, `helmet`, CORS allowlist, rate limiting, `RolesGuard`
- Provider API keys encrypted at rest with AES-256-GCM

## Environment variables (backend `.env`)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port inside the container (default 3000) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets — use long random strings |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Token lifetimes (default `15m` / `7d`) |
| `ENCRYPTION_KEY` | 32-byte hex (64 chars) key for AES-256 provider-key encryption |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | First admin seed credentials |

## API overview

All routes are under `/api/v1`. Bearer-token auth except where noted.

### Auth
- `POST /auth/register` — create account (also creates a FREE subscription)
- `POST /auth/login` — returns access + refresh tokens
- `POST /auth/refresh` — rotates the refresh token; reuse of an old token is rejected
- `POST /auth/logout` — revoke one refresh token (idempotent)
- `POST /auth/logout-all` — revoke all sessions
- `GET /auth/me`

### User
- `GET /user/me`, `PATCH /user/me`
- `POST /user/me/password` — change password (revokes all sessions)
- `DELETE /user/me` — delete account and all data
- Admin: `GET /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id`

### AI providers
- `GET /providers`, `GET /providers/:id`, `POST /providers`, `PATCH /providers/:id`, `DELETE /providers/:id`
- `POST /providers/:id/health` — live health check against the provider
- API keys are encrypted at rest and never returned in any response

### Chat
- `POST /chat/messages` — send a prompt, get the assistant reply (auto-selects the default provider)
- `GET /chat/conversations`, `GET /chat/conversations/:id/messages`
- `PATCH /chat/conversations/:id`, `DELETE /chat/conversations/:id`

### Subscription & web search
- `GET /subscription/me`, `POST /subscription/me/plan` — plans: FREE (100 req/mo), PRO (1000), TEAM (unlimited)
- `POST /search`, `GET /search/history`, `GET /search/recent`, `GET /search/suggestions`

### Admin (ADMIN role)
- `GET /admin/dashboard`, `GET /admin/analytics/usage`, `GET /admin/analytics/top-users`
- `GET /admin/logs`, `GET /admin/health`, `GET /admin/users`, `GET /admin/subscriptions`

### Postman
`postman/EchoGPT.postman_collection.json` — import into Postman; login/register requests
auto-store the token for the rest of the collection.

## First admin

Seeded automatically on container start from `.env`. To create it manually instead:

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api node dist/prisma/seed.js
```

## Local development (without Docker)

Backend (needs a local PostgreSQL — point `DATABASE_URL` at it):

```bash
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
npm test   # unit tests for auth (token rotation) and chat (quota, ownership)
```

## Project layout

```
src/           NestJS backend
  auth/        JWT strategy, guards, register/login/refresh/logout
  user/        profile + admin user management
  ai-provider/ provider CRUD, AES-256 key encryption, health checks
  chat/        conversations, messages, provider clients (openai-compatible, anthropic)
  subscription/ plans, quotas, remaining-requests
  web-search/  DuckDuckGo search, history, suggestions
  admin/       dashboard, analytics, logs, system health
  common/      global exception filter, crypto service, pagination DTO
  prisma/      PrismaService
prisma/        schema.prisma, migrations, seed.ts
frontend/      Vite + React demo client (see frontend/README.md)
postman/       Postman collection
```
