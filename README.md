# Echo

> **Write once. Publish everywhere.**

A content-repurposing SaaS. A signed-in user pastes long-form content (or a URL) and
gets platform-native copy for X/Twitter, LinkedIn, Instagram, and email newsletters,
in a chosen tone. Two modes: a fast single-shot **Create** flow and an autonomous
**Agent**. Every result is saved to the user's private history.

The full product spec is in [`spec.md`](./spec.md); repo working rules are in
[`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Backend** — Python 3.11+ · FastAPI · SQLModel · Postgres (Neon) · custom JWT auth
  (bcrypt + PyJWT). Managed with [uv](https://docs.astral.sh/uv/).
- **Frontend** — Next.js 14 (App Router) · TypeScript · Tailwind v3 · shadcn/ui
  (new-york) · sonner · lucide-react.

## Status

**Feature 1 — Authentication (custom JWT)** is implemented: email + password accounts,
register/login/me, a `get_current_user` dependency that gates protected routes, and the
frontend auth slice (login page, auth context, `RequireAuth`, header). Features 2–4
(Create, Agent, History) are not built yet.

---

## Backend — `backend/`

```bash
cd backend
uv sync                                # install dependencies
cp .env.example .env                   # then fill in values (see below)
uv run uvicorn app.main:app --reload   # dev server on :8000  (docs at /docs)
```

Quick import sanity check: `uv run python -c "import app.main"`.

### Backend environment variables (`backend/.env`)

| Variable                      | Required | Description                                                                 |
| ----------------------------- | -------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                | yes      | Postgres connection string. Plain `postgresql://…` is fine — the app rewrites it to the `psycopg` driver. For Neon, include `?sslmode=require`. |
| `JWT_SECRET`                  | yes      | Secret used to sign JWTs. Use a long random value, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no       | Access-token lifetime in minutes (default `1440` = 24h).                    |
| `FRONTEND_ORIGINS`            | no       | Comma-separated CORS allow-list, e.g. `http://localhost:3000`.              |

> Tables are auto-created on startup for v1 (switch to Alembic before evolving a live
> schema). `.env` is gitignored — never commit it.

### Auth API

| Method | Path                 | Auth | Body / notes                                       |
| ------ | -------------------- | ---- | -------------------------------------------------- |
| POST   | `/api/auth/register` | –    | JSON `{ email, password }` (password ≥ 8) → token  |
| POST   | `/api/auth/login`    | –    | form `username` (email), `password` → token        |
| GET    | `/api/auth/me`       | ✓    | → `{ id, email, created_at }`                       |
| GET    | `/health`            | –    | → `{ "status": "ok" }`                              |

Emails are normalized to lowercase on store and lookup, so `User@X.com` and
`user@x.com` are the same account.

---

## Frontend — `frontend/`

```bash
cd frontend
npm install
cp .env.local.example .env.local       # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                            # :3000

npx tsc --noEmit                       # typecheck (must pass)
npm run build                          # production build (must pass)
```

### Frontend environment variables (`frontend/.env.local`)

| Variable              | Required | Description                                  |
| --------------------- | -------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | yes      | Base URL of the backend, e.g. `http://localhost:8000`. |

The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>` on
protected requests; a 401 clears the token and redirects to `/login`.

---

## Project layout

```
echo/
├── backend/        FastAPI + SQLModel (config, database, models, schemas, auth, routers)
├── frontend/       Next.js 14 App Router (app/, components/, lib/)
├── spec.md         product spec (what to build)
├── CLAUDE.md       repo working rules / guardrails
└── README.md       this file
```
