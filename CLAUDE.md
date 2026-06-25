# CLAUDE.md

Project context and working rules for Claude Code. Read this before making changes.
The full product spec is in `spec.md` — this file is about *how* to work in the repo.

## What this is

**Echo** — a content repurposing SaaS. A signed-in user pastes long-form content (or
a URL) and gets platform-native copy for X/Twitter, LinkedIn, Instagram, and email
newsletters. Two modes: single-shot ("Create") and an autonomous **agent**. Per-user
history. Custom JWT auth.

## Repo layout

```
echo/
├── backend/                 FastAPI + SQLModel + Neon
│   ├── app/
│   │   ├── main.py          app entrypoint, CORS, router wiring, lifespan
│   │   ├── config.py        env settings (pydantic-settings)
│   │   ├── database.py      engine + get_session dependency
│   │   ├── models.py        SQLModel tables + enums
│   │   ├── schemas.py       request/response Pydantic models
│   │   ├── auth.py          hashing, JWT, get_current_user
│   │   ├── llm_client.py    the ONE place the LLM client is created
│   │   ├── llm.py           single-shot repurpose prompts + call
│   │   ├── agent.py         agent tools (incl. SSRF-safe fetch) + loop
│   │   └── routers/         auth.py, content.py, agent.py
│   ├── Dockerfile, render.yaml, pyproject.toml, uv.lock
│   └── .env.example
├── frontend/                Next.js 14 (App Router) + TS + Tailwind + shadcn
│   ├── app/                 layout, page (Create), agent/, history/, login/
│   ├── components/ui/       shadcn primitives
│   ├── components/app/      app components (forms, tabs, header, require-auth)
│   ├── lib/                 api.ts, auth.tsx, types.ts, constants.ts, utils.ts
│   └── .env.local.example
├── spec.md, README.md, DEPLOYMENT.md
```

## Commands

**Backend** (run from `backend/`)
```bash
uv sync                                   # install deps
cp .env.example .env                      # then fill in values
uv run uvicorn app.main:app --reload      # dev server :8000  (docs at /docs)
```

**Frontend** (run from `frontend/`)
```bash
npm install
cp .env.local.example .env.local          # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                               # :3000
npx tsc --noEmit                          # typecheck — must pass before done
npm run build                             # production build — must pass before done
```

There is no separate lint gate required, but keep `tsc --noEmit` and `npm run build`
green. For backend, a quick import check is `uv run python -c "import app.main"`.

## Tech + version notes

- Python 3.11+, **uv** (not pip/poetry). Add deps to `pyproject.toml`, then `uv sync`.
- FastAPI, SQLModel, `psycopg[binary]` for Postgres (`postgresql+psycopg://...`).
- Next.js 14 App Router, React 18, **Tailwind v3** (not v4), shadcn "new-york".
- Use the `@/*` import alias (configured in tsconfig).

## Critical guardrails — do NOT regress these

1. **LLM provider**: we use the **OpenAI SDK pointed at Gemini's OpenAI-compatible
   endpoint**. The client is created only in `llm_client.py`. To change model/provider,
   change env vars (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`) — not code. Use
   `chat.completions` (Gemini supports that, NOT the `/responses` API).
2. **SSRF**: `agent.py::fetch_url` must stay SSRF-safe — only public http/https,
   block loopback/private/link-local/metadata, re-validate each redirect hop. Never
   loosen this.
3. **No raw error leakage**: API endpoints log exceptions server-side and return
   generic messages. Don't put `{exc}` / stack traces in HTTP `detail`.
4. **Auth scoping**: every content/history route requires `get_current_user` and is
   filtered by `user_id`. New data routes must be user-scoped the same way.
5. **Email normalization**: always lowercase emails on store and lookup.
6. **Secrets**: never commit `.env`. It's gitignored — keep it that way. Never hardcode
   keys or `JWT_SECRET`.
7. **max_tokens headroom**: keep generous limits (≈2500 single-shot, ≈4000 agent) so
   Gemini 2.5 thinking tokens don't truncate output.

## Conventions

**Python**
- Type hints everywhere. Keep modules small and single-purpose.
- DB models in `models.py`; API contracts in `schemas.py` — keep them separate.
- Routers stay thin; put real logic in `llm.py` / `agent.py` / `auth.py`.
- Raise `HTTPException` with clear, user-safe `detail` strings.

**TypeScript / React**
- Server components by default; add `"use client"` only when needed (state, hooks,
  browser APIs). Pages that need auth wrap content in `<RequireAuth>`.
- All API calls go through `lib/api.ts`. Protected calls use `authedFetch` (handles
  401 → clear token + redirect). Don't call `fetch` to the backend directly elsewhere.
- Types live in `lib/types.ts` and must match backend schemas.
- Styling: Tailwind utility classes + shadcn components + CSS variables from
  `globals.css`. Keep the dark theme + violet/fuchsia accent. Don't introduce a
  component library other than shadcn/Radix.
- Don't use `localStorage`/`sessionStorage` except the existing token store in
  `lib/api.ts`.

## Gotchas (things that have bitten us)

- `OAuth2PasswordRequestForm` needs **python-multipart** installed.
- `next/font/google` (Inter) fetches fonts at build time — needs network during
  `npm run build`. If building offline, that step fails (app code is fine).
- bcrypt has a 72-byte password limit; we truncate defensively.
- `app.include_router` may show as a nested `_IncludedRouter` in `app.routes`; verify
  endpoints via `app.openapi()["paths"]`, not by scanning `app.routes`.
- Neon scales to zero → first request can be slow; engine uses `pool_pre_ping`.

## Definition of done (any change)

- Backend imports cleanly; affected endpoints work (test via `/docs` or curl).
- `npx tsc --noEmit` passes and `npm run build` succeeds.
- Guardrails above still hold (auth scoping, SSRF, no error leakage, secrets safe).
- New env vars are added to `.env.example` / `.env.local.example` and documented in
  `README.md`.
