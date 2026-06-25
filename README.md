# Echo

> **Write once. Publish everywhere.**

A content-repurposing SaaS. A signed-in user pastes long-form content (or a URL) and
gets platform-native copy for X/Twitter, LinkedIn, Instagram, and email newsletters,
in a chosen tone. Two modes: a fast single-shot **Create** flow and an autonomous
**Agent** that can fetch a URL and decide its own steps. Every result is saved to the
user's private history.

The full product spec is in [`spec.md`](./spec.md); repo working rules and guardrails
are in [`CLAUDE.md`](./CLAUDE.md).

## Stack

- **Backend** — Python 3.11+ · FastAPI · SQLModel · Postgres (Neon) · custom JWT auth
  (bcrypt + PyJWT). LLM via the OpenAI SDK pointed at Gemini's OpenAI-compatible
  endpoint. Agent fetch uses httpx + BeautifulSoup. Managed with
  [uv](https://docs.astral.sh/uv/).
- **Frontend** — Next.js 14 (App Router) · TypeScript · Tailwind v3 · shadcn/ui
  (new-york) · Framer Motion · sonner · lucide-react.

## Features

All five features are implemented:

1. **Auth (custom JWT)** — email + password accounts, register / login / me, a
   `get_current_user` dependency gating every data route, and the frontend auth slice
   (login + signup pages, auth context, `RequireAuth`, header).
2. **Create (single-shot)** — paste content, pick platforms + tone, get one LLM call
   per platform with platform-specific prompts; results render as copyable tabs.
3. **Agent** — give a URL or pasted text; a tool-calling loop (SSRF-safe `fetch_url`
   + terminal `submit_outputs`) writes the copy and returns a step-by-step trace.
4. **History** — per-user list of past jobs; open to re-view outputs or delete
   (owner-scoped, 404 on someone else's job).
5. **UI / design system** — dark theme, violet→fuchsia accent, aurora backdrop,
   Framer Motion entrance/trace/copy animations.

## Architecture

```
Next.js (frontend)  --HTTPS/JSON-->  FastAPI (backend)  -->  Postgres (Neon)
                                          |
                                          +-->  Gemini (OpenAI-compatible API)
```

The frontend stores a JWT and sends it as `Authorization: Bearer <token>` on every
protected request. The backend is stateless; all persistence is in Postgres. The LLM
client is created in exactly one place (`llm_client.py`) so the provider/model can be
swapped by changing env vars alone.

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
| `LLM_API_KEY`                 | yes      | API key for the LLM provider. Free Gemini key at https://aistudio.google.com/apikey. |
| `LLM_BASE_URL`                | no       | OpenAI-compatible base URL (default Gemini: `https://generativelanguage.googleapis.com/v1beta/openai/`). |
| `LLM_MODEL`                   | no       | Model name (default `gemini-2.5-flash`).                                    |

> Tables are auto-created on startup for v1 (switch to Alembic before evolving a live
> schema). `.env` is gitignored — never commit it.

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

| Variable              | Required | Description                                            |
| --------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | yes      | Base URL of the backend, e.g. `http://localhost:8000`. |

The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>` on
protected requests; a 401 clears the token and redirects to `/login`.

### Pages

| Route       | Auth | What                                                            |
| ----------- | ---- | -------------------------------------------------------------- |
| `/`         | ✓    | Create — single-shot repurpose (inputs left, output tabs right) |
| `/agent`    | ✓    | Agent — URL or pasted text, with a live trace of the agent run  |
| `/history`  | ✓    | History — list past jobs, open detail, delete                   |
| `/login`    | –    | Sign in                                                        |
| `/signup`   | –    | Create an account                                              |

---

## API reference

| Method | Path                   | Auth | Body / notes                                  |
| ------ | ---------------------- | ---- | --------------------------------------------- |
| POST   | `/api/auth/register`   | –    | JSON `{ email, password }` (password ≥ 8) → token |
| POST   | `/api/auth/login`      | –    | form `username` (email), `password` → token   |
| GET    | `/api/auth/me`         | ✓    | → `{ id, email, created_at }`                  |
| POST   | `/api/repurpose`       | ✓    | `{ source_text, title, tone, platforms[] }` → full job |
| POST   | `/api/agent/repurpose` | ✓    | `{ url?, source_text?, title, tone, platforms[] }` → `{ job, trace[] }` |
| GET    | `/api/history`         | ✓    | → job summaries (newest first)                |
| GET    | `/api/history/{id}`    | ✓    | → full job with outputs (owner only, else 404) |
| DELETE | `/api/history/{id}`    | ✓    | delete job + outputs (owner only, else 404)   |
| GET    | `/`                    | –    | → `{ name, status, docs, health }`            |
| GET    | `/health`              | –    | → `{ "status": "ok" }`                         |

**Platforms:** `twitter`, `linkedin`, `instagram`, `newsletter`.
**Tones:** `professional`, `casual`, `witty`, `bold`.

Emails are normalized to lowercase on store and lookup, so `User@X.com` and
`user@x.com` are the same account.

---

## Security notes

- **SSRF-safe fetch** — the agent's `fetch_url` only allows public `http`/`https`,
  blocks loopback / private / link-local / metadata / reserved hosts, and re-validates
  each redirect hop.
- **No raw error leakage** — endpoints log exceptions server-side and return generic
  messages; no stack traces in HTTP `detail`.
- **Auth scoping** — every content/history route requires `get_current_user` and is
  filtered by `user_id`.
- **CORS** is restricted to the `FRONTEND_ORIGINS` allow-list.
- Passwords are bcrypt-hashed (truncated to 72 bytes) and never returned in plaintext.

Intentionally out of scope for v1: rate limiting on auth routes, httpOnly-cookie token
storage (JWT currently lives in `localStorage`), Alembic migrations, and a token
refresh flow (a 401 simply logs the client out).

---

## Deployment

Designed to run the backend as a container (Render / Railway / Fly) and the frontend on
Vercel:

- **Backend** — serve `app.main:app` with uvicorn, set the backend env vars above, and
  point `FRONTEND_ORIGINS` at your deployed frontend origin.
- **Frontend** — set `NEXT_PUBLIC_API_URL` to the deployed backend URL and `npm run build`.

> Neon scales to zero, so the first request after idle can be slow; the engine uses
> `pool_pre_ping` to recover stale connections.

---

## Project layout

```
echo/
├── backend/        FastAPI + SQLModel
│   └── app/        main, config, database, models, schemas, auth,
│                   llm_client, llm, agent, routers/ (auth, content, agent, history)
├── frontend/       Next.js 14 App Router
│   ├── app/        layout, page (Create), agent/, history/, login/, signup/, not-found
│   ├── components/ ui/ (shadcn primitives) + app/ (forms, tabs, header, trace, …)
│   └── lib/        api.ts, auth.tsx, types.ts, constants.ts, motion.ts, utils.ts
├── spec.md         product spec (what to build)
├── CLAUDE.md       repo working rules / guardrails
└── README.md       this file
```
