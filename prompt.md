# EchoGPT Backend — Build Prompt

You are a senior backend engineer building a production-ready REST API for **EchoGPT**, a multi-AI-chat Chrome extension. This is a timed technical assignment — deadline **29 September 2026**. Prioritize a fully working core system over a half-finished full feature list.

## Stack — fixed, don't deviate
- NestJS, TypeScript strict mode
- PostgreSQL 16
- **Prisma** (not TypeORM — less boilerplate, simpler migrations, faster to ship solo)
- `@nestjs/swagger` for OpenAPI docs
- `@nestjs/jwt` + `passport-jwt` — access + refresh tokens
- `class-validator` / `class-transformer` for every DTO
- `bcrypt` for password hashing
- Docker + docker-compose (multi-stage Dockerfile, app + postgres)

## Hard constraints
- One modular monolith. No microservices, no CQRS, no event sourcing.
- No repository-pattern wrapper around Prisma — Prisma *is* the data layer.
- Every domain module = `module / controller / service / dto`. Nothing extra without a concrete reason — the one place an interface earns its keep is AI providers (shared interface, one class per provider).
- No generic "plugin system." No premature caching or queues — Redis only if you reach the search-caching bonus, and only after core features work.
- Boring, readable code over clever code. Before adding an abstraction, ask: "does this have 2+ real implementations today?" If not, skip it.
- Whole app runs with `docker-compose up` and a single `.env` file.
- If a requirement is ambiguous, make the simplest reasonable call and note it in your summary — don't stop to ask.

## Build order — commit after each phase; don't leave phases half-done

**Phase 1 — core, must be fully solid**
1. Auth: register, login, logout, JWT + refresh rotation, bcrypt hashing
2. User: profile, update, change password, delete account, roles (admin/user) — include a way to create the first admin (seed script or a documented manual step)
3. AI provider management: CRUD, enable/disable, default provider, health check; API keys encrypted at rest (AES-256), never returned in responses or logged
4. Chat API: send prompt → call selected provider → persist + return response, conversation history
5. Prisma schema + migrations for everything above
6. Swagger docs on every endpoint above — DTOs, auth requirements, error responses
7. Docker + docker-compose + `.env.example` + README

*Phase 1 is done when:* `docker-compose up` brings up API + DB, Swagger loads, and register → login → add provider → send chat prompt → see it in history all work end to end.

**Phase 2 — once Phase 1 actually works**
8. Subscriptions: plans, status, upgrade/downgrade, usage limits, remaining-requests endpoint
9. Web search API: query, history, recent, suggestions
10. Admin APIs: dashboard stats, user/subscription/provider management, usage analytics, request logs, system health

**Phase 3 — only if time remains**
11. Email verification, streaming chat responses (SSE), search-result caching, Postman collection, a handful of tests around auth + chat

## Database
Users, Sessions (refresh tokens), Roles, Subscriptions, AiProviders, Conversations, ChatMessages, WebSearches, ApiUsageLogs — normalized, foreign keys + indexes on lookup columns (`userId`, `providerId`, etc.).

## Security checklist
- Global `ValidationPipe`: `whitelist: true`, `forbidNonWhitelisted: true`
- Global exception filter → one consistent error response shape
- `helmet`, CORS allowlist, rate limiting on auth + chat endpoints (`@nestjs/throttler`)
- `RolesGuard` on all `/admin/*` routes
- Provider API keys: encrypted column, decrypted only in memory when calling the provider

## Deliverables
- GitHub repo with small, logical commits — not one mega-commit at the end
- README: setup, `docker-compose up` instructions, env vars, Swagger URL
- `.env.example` with every variable the app needs, placeholder values only
- Committed Prisma migration files
- (Optional) Postman collection

After each phase, give a short status — what's done, what's stubbed, what's next — then continue to the next phase.