# EchoGPT Backend

REST API for **EchoGPT**, a multi-AI-chat Chrome extension. Users register, configure
their own AI providers (OpenAI / Anthropic / any OpenAI-compatible endpoint), and chat
through them with full conversation history.

## Stack

- NestJS (TypeScript strict) + Prisma + PostgreSQL 16
- JWT access + refresh tokens with rotation, bcrypt password hashing
- `@nestjs/swagger` docs, `helmet`, CORS allowlist, rate limiting, `RolesGuard`
- Provider API keys encrypted at rest with AES-256-GCM

## Quick start

```bash
cp .env.example .env       # adjust values if you like; placeholders work for local dev
docker compose up --build
```

That brings up:

- **API** on http://localhost:3001/api (Swagger UI: http://localhost:3001/api/docs)
- **PostgreSQL 16** exposed on host port **5433** (5432 is left free for any local Postgres)

On startup the API container automatically runs `prisma migrate deploy` and seeds the
first admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Environment variables

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

## First admin

Seeded automatically on container start from `.env`. To create it manually instead:

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api node dist/prisma/seed.js
```

## Local development (without Docker)

```bash
npm install
npx prisma migrate dev
npm run seed
npm run start:dev
```

## Project layout

```
src/
  auth/        JWT strategy, guards, register/login/refresh/logout
  user/        profile + admin user management
  ai-provider/ provider CRUD, AES-256 key encryption, health checks
  chat/        conversations, messages, provider clients (openai-compatible, anthropic)
  common/      global exception filter, crypto service, pagination DTO
  prisma/      PrismaService
prisma/        schema.prisma, migrations, seed.ts
```
