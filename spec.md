# Echo — Product Specification (spec.md)

> A content repurposing SaaS. A signed-in user pastes long-form content (or a URL)
> and gets platform-native copy for X/Twitter, LinkedIn, Instagram, and email
> newsletters, in a chosen tone. Two generation modes: a fast single-shot mode and
> an autonomous **agent** mode. Every result is saved to the user's private history.
>
> Tagline: **Write once. Publish everywhere.**

This document is the source of truth for *what* to build, organized feature by
feature. For *how* to work in the repo (commands, conventions, guardrails), see
`CLAUDE.md`.

---

## 1. Tech stack (required)

**Backend**
- Python 3.11+, managed with **uv**
- **FastAPI** (web framework)
- **SQLModel** (ORM)
- **Neon** serverless Postgres (any Postgres works locally)
- LLM via the **OpenAI SDK pointed at Google Gemini's OpenAI-compatible endpoint**
  (free tier). Base URL `https://generativelanguage.googleapis.com/v1beta/openai/`,
  default model `gemini-2.5-flash`.
- Auth: **custom JWT** — `bcrypt` for password hashing, `PyJWT` for tokens.
- Agent tools use `httpx` + `beautifulsoup4`.

**Frontend**
- **Next.js 14** (App Router), **TypeScript**
- **Tailwind CSS v3** + **shadcn/ui** (new-york style) components
- **Framer Motion** for animation
- **sonner** for toasts, **lucide-react** for icons

**Deploy**
- Backend → Docker image → Render (or Railway/Fly). Frontend → Vercel.

---

## 2. Architecture

```
Next.js (Vercel)  --HTTPS/JSON-->  FastAPI (Render, Docker)  -->  Neon Postgres
                                          |
                                          +-->  Gemini (OpenAI-compatible API)
```

- Frontend is a SPA-style App Router app. It stores a JWT and sends it as
  `Authorization: Bearer <token>` on every protected request.
- Backend is stateless; all persistence is in Postgres.
- The LLM client is created in ONE place so the provider/model can be swapped by
  changing env vars only.

---

## 3. Data model

**User**
- `id` (PK), `email` (unique, indexed, stored lowercased), `hashed_password`,
  `created_at`.
- One user has many jobs (cascade delete).

**RepurposeJob**
- `id` (PK), `user_id` (FK → User, indexed), `title` (default "Untitled"),
  `source_text`, `tone` (enum), `created_at`.
- One job has many outputs (cascade delete).

**RepurposeOutput**
- `id` (PK), `job_id` (FK → RepurposeJob, indexed), `platform` (enum), `content`,
  `created_at`.

**Enums**
- `Platform`: `twitter`, `linkedin`, `instagram`, `newsletter`.
- `Tone`: `professional`, `casual`, `witty`, `bold`.

---

## 4. Features

### Feature 1 — Authentication (custom JWT)

**What**
Email + password accounts. Registering or logging in returns a JWT. All content
routes require a valid token, and each user only ever sees their own jobs.

**Backend**
- `POST /api/auth/register` — body `{ email, password }` (password ≥ 8 chars).
  Normalize email to lowercase. 409 if email already exists. Returns
  `{ access_token, token_type: "bearer" }`.
- `POST /api/auth/login` — OAuth2 password flow (form fields `username` =email,
  `password`). 401 on bad credentials. Returns a token.
- `GET /api/auth/me` — requires token; returns `{ id, email, created_at }`.
- Passwords hashed with bcrypt (truncate to 72 bytes). JWT payload `{ sub: user_id,
  exp }`, signed HS256 with `JWT_SECRET`. A `get_current_user` dependency decodes
  the token and loads the user, raising 401 on any failure.

**Frontend**
- A single `/login` page with a "Sign in / Sign up" toggle (email + password).
- An auth context (`AuthProvider`) exposing `{ user, loading, login, register,
  logout }`. On mount, if a token exists, call `/me` to hydrate the user.
- Token stored in `localStorage` (SSR-safe access). Logout clears it.
- A `RequireAuth` wrapper gates protected pages: show a loader while checking,
  redirect to `/login` if unauthenticated, else render children.
- Header shows the user's email + a logout button when signed in; "Sign in" link
  otherwise.

**Acceptance criteria**
- Registering with `User@X.com` then logging in with `user@x.com` works (email
  case-insensitive) and never creates a duplicate account.
- Hitting any content route without a token returns 401.
- A token that expires mid-session causes the frontend to clear it and redirect to
  `/login` automatically.
- Passwords are never stored or returned in plaintext.

---

### Feature 2 — Single-shot Repurpose ("Create")

**What**
The fast path: user pastes content, picks platforms + tone, and gets copy for each
selected platform via one LLM call per platform.

**Backend**
- `POST /api/repurpose` (auth required) — body
  `{ source_text (30–20000 chars), title, tone, platforms[] }`.
  Creates a `RepurposeJob` owned by the user, then for each platform calls the LLM
  with a platform-specific prompt + tone guide, saves a `RepurposeOutput`, and
  returns the full job with outputs.
- On LLM failure: roll back, log server-side, return a generic 502 (no raw
  exception text to the client).
- Platform prompt rules (bake into the prompt):
  - **twitter**: 5–8 tweet thread, hook first, numbered `1/`, each < 280 chars.
  - **linkedin**: hook line + blank line, short paragraphs, ends with a question +
    3–5 hashtags.
  - **instagram**: punchy caption, emojis where natural, CTA + 8–12 hashtags.
  - **newsletter**: `Subject: ...` first line, then 2–3 paragraphs + a takeaway.

**Frontend** (`/`, protected)
- Two-column layout: inputs left, output right.
- Inputs: optional title, source textarea with a live char counter, platform
  multi-select cards (toggle), tone chips. Default platforms: twitter, linkedin,
  instagram.
- "Repurpose content" button shows a loading state; the output column shows skeleton
  placeholders (one per selected platform) while waiting.
- Results render as tabs (one per platform) with a copy-to-clipboard button per tab
  (animated check on copy). Empty state before first run.

**Acceptance criteria**
- Submitting with < 30 chars or zero platforms is blocked with a clear message.
- Each selected platform produces one output tab; copy works.

---

### Feature 3 — Agent Repurpose

**What**
An autonomous agent that can take a **URL or pasted text**, decide its own steps
(fetch the URL if given), write copy for each platform, and deliver results — while
exposing a trace of what it did.

**Backend**
- `POST /api/agent/repurpose` (auth required) — body
  `{ url?, source_text?, title, tone, platforms[] }`. At least one of `url` /
  `source_text` required, else 400.
- Implemented as a tool-calling loop using the OpenAI SDK (Gemini). Two tools:
  - `fetch_url(url)` — fetches a page and returns readable text (truncated ~8000
    chars). **MUST be SSRF-safe** (see §5).
  - `submit_outputs(outputs[])` — terminal tool; the agent calls it once with the
    final `{ platform, content }[]`.
- Loop: system prompt explains the task + target platforms + tone. Up to ~8 steps.
  If the model returns text without a tool call, nudge it to use `submit_outputs`.
  When `submit_outputs` is called, filter to requested platforms and finish.
- Returns `{ job, trace[] }` where `trace` is a list of `{ type, detail }` steps
  (`tool` | `note` | `finish` | `error`). The job is saved like a normal job (for
  URL input, store `source_text = "(from URL) <url>"`).
- On failure: log server-side, return generic 502. If the agent produced nothing,
  return 502.

**Frontend** (`/agent`, protected)
- Input mode toggle: **From URL** (single URL field) or **Paste text** (textarea).
- Platform multi-select + tone chips (default platforms: twitter, linkedin).
- "Run agent" button. While running, show a "thinking" indicator; after the response
  resolves, reveal the trace steps one-by-one (staggered) for an agentic feel, then
  render the output tabs.
- Each trace step shows an icon by type (tool/finish/error/working).

**Acceptance criteria**
- Giving only a URL makes the agent fetch it (a `tool` step appears) before writing.
- The final output has a tab per requested platform with working copy buttons.
- The saved run appears in History.

---

### Feature 4 — History

**What**
A per-user list of past jobs; open one to view its outputs again, or delete it.

**Backend**
- `GET /api/history` (auth) — user's jobs, newest first, as lightweight summaries
  `{ id, title, tone, created_at, platform_count }`.
- `GET /api/history/{id}` (auth) — full job with outputs; 404 if not found OR not
  owned by the user.
- `DELETE /api/history/{id}` (auth) — delete job + outputs (cascade); 404 if not
  owned.

**Frontend** (`/history`, protected)
- List of cards (title, relative date, platform count, tone badge). Hover reveals a
  delete button. Clicking a card opens a detail view with the output tabs and a
  back button. Loading skeletons; empty state when there are no jobs.

**Acceptance criteria**
- User A cannot fetch or delete User B's job (404).
- Deleting removes it from the list immediately (optimistic) and on the server.

---

### Feature 5 — UI / Design system

- Dark theme by default. Near-black background with a subtle "aurora" gradient
  backdrop (blurred primary + accent blobs).
- Accent: a violet→fuchsia gradient used on the logo, headings highlight, and
  primary buttons.
- shadcn/ui components (new-york), Tailwind design tokens via CSS variables.
- Sticky translucent header with logo + nav (Create / Agent / History) + user menu.
- Minimal, consistent spacing; rounded-xl cards; thin custom scrollbars in output
  panels. Framer Motion for entrance animations, copy feedback, trace reveal, and
  list transitions.

---

## 5. Non-functional requirements

**Security (must-haves)**
- `fetch_url` is **SSRF-safe**: only `http`/`https`, and the resolved host must be a
  public IP. Block loopback, private ranges, link-local (`169.254.x.x` metadata),
  reserved, multicast, unspecified. Re-validate on each redirect hop (follow
  redirects manually, max ~4).
- API errors are logged server-side; clients get generic messages (never raw
  exceptions / stack traces).
- Emails normalized to lowercase everywhere (store + lookup).
- `.env` files gitignored at root and backend.
- CORS restricted to an allow-list of origins from `FRONTEND_ORIGINS` (comma-sep).

**Config (env vars)**
- Backend: `DATABASE_URL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `JWT_SECRET`,
  `ACCESS_TOKEN_EXPIRE_MINUTES`, `FRONTEND_ORIGINS`.
- Frontend: `NEXT_PUBLIC_API_URL`.

**Reliability**
- Use a generous `max_tokens` (≈2500 single-shot, ≈4000 agent) so Gemini 2.5's
  thinking tokens don't truncate the visible output.
- DB engine uses `pool_pre_ping` (Neon scales to zero).

**Known limitations (intentionally out of scope for v1)**
- No rate limiting on auth routes (add slowapi/gateway before real traffic).
- JWT in `localStorage` (XSS-readable); httpOnly cookies are the hardening path.
- Tables auto-created on startup; switch to Alembic before evolving a live schema.
- No token refresh flow; 401 → client logs out.

---

## 6. Consolidated API reference

| Method | Path                   | Auth | Body / notes                                  |
| ------ | ---------------------- | ---- | --------------------------------------------- |
| POST   | `/api/auth/register`   | –    | `{ email, password }` → token                 |
| POST   | `/api/auth/login`      | –    | form `username`,`password` → token            |
| GET    | `/api/auth/me`         | ✓    | → `{ id, email, created_at }`                  |
| POST   | `/api/repurpose`       | ✓    | `{ source_text, title, tone, platforms[] }`   |
| POST   | `/api/agent/repurpose` | ✓    | `{ url?, source_text?, title, tone, platforms[] }` → `{ job, trace[] }` |
| GET    | `/api/history`         | ✓    | → summaries (newest first)                    |
| GET    | `/api/history/{id}`    | ✓    | → full job (owner only)                       |
| DELETE | `/api/history/{id}`    | ✓    | owner only                                    |
| GET    | `/health`              | –    | `{ status: "ok" }`                            |

---

## 7. Build order (suggested)

1. Backend scaffold (uv, FastAPI app, config, DB engine, models).
2. Auth (hashing, JWT, register/login/me, `get_current_user`).
3. Single-shot repurpose (LLM client + prompts + endpoint, scoped to user).
4. History endpoints.
5. Agent (tools incl. SSRF-safe fetch, loop, endpoint).
6. Frontend scaffold (Next.js, Tailwind, shadcn, theme).
7. Auth UI (context, login page, RequireAuth, header).
8. Create page → Agent page → History page.
9. Security hardening pass (SSRF, error sanitizing, CORS, gitignore).
10. Dockerfile + deploy config + READMEs.
