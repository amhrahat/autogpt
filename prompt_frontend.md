# EchoGPT Frontend — Build Prompt

You are a frontend engineer building a **minimal** React client for the already-built EchoGPT backend (NestJS + Prisma — check its Swagger docs at `/api/docs` for exact request/response shapes before wiring each screen). This is a demo/testing UI, not a polished product.

## Stack — fixed
- Vite + React + TypeScript
- React Router — just enough for the screens below
- Plain `fetch` behind one small typed API client. No React Query, no Redux/Zustand.
- Plain CSS, one stylesheet. No component library, no CSS-in-JS.

## Hard constraints
- No state management library. Auth state (tokens, current user) lives in one React Context; everything else is local component state — no global store.
- Function over polish. No design system, no theming, no animation.
- One `.env`: `VITE_API_BASE_URL` pointing at the backend's `/api/v1`.
- Only build screens for what's actually live: **Auth, User, AI Providers, Chat**. Subscriptions, web search, and the admin dashboard aren't implemented in the backend yet — don't build UI for them.
- Keep components flat — one file per screen, plus the API client and the auth context. No atoms/molecules/organisms for a 4-screen app.

## Auth flow
- Access token in memory (the context); refresh token in `localStorage`. This is a deliberate simplification for a demo client, not an oversight — note it in the README rather than silently working around it.
- On a 401, try `/auth/refresh` once, retry the original request, and log out if that also fails.
- Redirect to `/login` when there's no valid session.

## Screens
1. **Login / Register** — one page, toggle between forms. On success: store tokens, fetch `/auth/me`, go to `/chat`.
2. **Providers** — list, add/edit form (name, type, API key, base URL if relevant), delete, set default, a "Test" button per provider hitting its health-check endpoint.
3. **Chat** — conversation list on the left, message thread on the right, an input box that posts a new message. Wire up rename/delete on conversations since the API already supports them. Check the actual `POST /chat/messages` schema in Swagger — if it takes a provider or conversation ID, add a simple dropdown; if it only auto-selects the default provider, don't invent a selector.
4. **Settings** (small) — view/edit profile, change password, logout.

## Deliverables
- `npm install && npm run dev` just works
- `.env.example` with `VITE_API_BASE_URL`
- Short README: how to run it alongside the backend
- (optional) add it as a service in the backend's existing `docker-compose.yml`