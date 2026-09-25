# EchoGPT Frontend

Minimal React demo/testing client for the [EchoGPT backend](../README.md). Four screens: Login/Register, Providers, Chat, Settings.

## Run

```bash
cd frontend
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173). The backend must be running — from the repo root: `docker compose up -d`.

`.env` / `.env.example` has one variable: `VITE_API_BASE_URL` (default `http://localhost:3001/api/v1`, matching the backend's docker-compose port mapping).

## Screens

- **Login/Register** — one page, toggle between forms
- **Chat** — conversation list (rename/delete included) on the left, thread on the right, provider dropdown (default provider used when unset)
- **Providers** — CRUD, enable/disable, set default, per-provider "Test" health check
- **Settings** — edit profile, change password (revokes all sessions), delete account

## Deliberate simplifications (demo client)

- **Access token is kept in `sessionStorage`, refresh token in `localStorage`.** Storing a refresh token in localStorage is XSS-exposed; fine for a local demo, not a production pattern.
- On any 401 the client tries `/auth/refresh` exactly once, retries the original request, and logs out if that fails too.
- No state library: auth lives in one React Context, everything else is component-local state.
- No component library, one plain CSS file (`src/index.css`).