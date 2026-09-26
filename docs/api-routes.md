# API Routes — one-page table (as built)

All routes live under `/api/v1`. Base URL: `http://localhost:3001/api/v1` (local dev — no deployed backend).

**Auth legend**
- 🌐 **Public** — no login, rate-limited (Upstash, 10 req / 10 s / IP)
- 🔒 **Auth** — needs JWT access token (`Authorization: Bearer <token>`)
- 🔑 **Session** — needs the per-session `token` returned by `startSession`, in the request body
- 👤 **Owner** — Auth + researcher must own the experiment

**Envelope** — every success response is `{ statusCode, data, message, success }`; the payload
lives under `data`. Errors are `{ statusCode, success, message, errors, error: { code, message } }`.
The frontend unwraps `.data` once in `src/api/client.js`, so app code always sees the raw payload.
`GET .../export?format=json` is the one raw-array exception.

For request and response bodies, data models and error semantics, see
[api-reference.md](api-reference.md). For setup see the [root README](../README.md).

**Sections** — [Health](#health) · [Auth](#auth) · [Participant](#participant-runtime) ·
[Experiments](#experiments) · [Stimuli](#stimuli) · [AI](#ai) · [Templates](#templates) ·
[Results](#results)

---

## Health

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/health` | 🌐 | Check the server is alive |

---

## Auth

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 🌐 | Create a researcher account (email lowercased) |
| POST | `/api/v1/auth/login` | 🌐 | Log in → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | 🌐 | Swap refresh token for a new rotated pair |
| POST | `/api/v1/auth/logout` | 🔒 | Invalidate the refresh token (must match) |
| GET | `/api/v1/auth/me` | 🔒 | Get current user profile |
| DELETE | `/api/v1/auth/me` | 🔒 | Erase the account and everything derived from it (password re-confirm) |

> All three public auth routes are rate-limited (added after a brute-force review).

---

## Participant (runtime)

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/run/:slug` | 🌐 | Get the published experiment JSON (410 if closed) |
| POST | `/api/v1/run/:slug/sessions` | 🌐 | Start a session → returns `sessionId`, `withdrawCode`, a write `token`, and the `seed` for this run |
| PATCH | `/api/v1/run/sessions/:sessionId` | 🔑 | Update session (calibration, mark abandoned) |
| POST | `/api/v1/run/sessions/:sessionId/trials` | 🔑 | Upload a batch of trials (max 500) |
| POST | `/api/v1/run/sessions/:sessionId/complete` | 🔑 | Mark session as finished, with engagement counts |
| POST | `/api/v1/run/sessions/:sessionId/beacon` | 🔑 | Last-chance save on tab close (`text/plain` body) |
| DELETE | `/api/v1/run/withdraw/:withdrawCode` | 🌐 | Delete the session + all its trials |

> `:sessionId` is validated as an ObjectId → malformed ids get `404`, never `500`.
> Trials/complete/PATCH only act while a session is `in_progress`; anything else is `409`.
> 🔑 routes require the per-session `token` from `startSession` in the request **body** —
> possession of the session's ObjectId is not sufficient. Stored only as a SHA-256 hash.

---

## Experiments

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/experiments` | 🔒 | List my experiments (no draft/versions in list) |
| POST | `/api/v1/experiments` | 🔒 | Create a new experiment |
| GET | `/api/v1/experiments/:id` | 👤 | Get one experiment (draft + versions) |
| PUT | `/api/v1/experiments/:id` | 👤 | Save the draft / title / status |
| DELETE | `/api/v1/experiments/:id` | 👤 | Delete experiment + its sessions + trials |
| POST | `/api/v1/experiments/:id/duplicate` | 👤 | Copy an experiment (fresh draft, no slug) |
| POST | `/api/v1/experiments/:id/publish` | 👤 | Freeze a version, create 8-char slug, return participant link |

> Closing = `PUT /:id` with `{"status":"closed"}`; there is no `/close` route.
> `slug` is a **partial** unique index, so any number of unpublished drafts can coexist.

---

## Stimuli

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/v1/stimuli/upload-url` | 🔒 | Vercel Blob client token (`handleUploadUrl` for the SDK) |
| POST | `/api/v1/stimuli` | 🔒 | Save stimulus record after upload |
| GET | `/api/v1/stimuli` | 🔒 | List my stimuli |
| DELETE | `/api/v1/stimuli/:id` | 🔒 | Delete a stimulus (owner only) |

---

## AI

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/v1/generate` | 🔒 | Groq asks 1–3 questions (`step: "questions"`), then builds a recipe from the 6 coded templates with tunable trial count, timing and feedback (`step: "draft"`) |

> Body: `{ "prompt": "…" }` (10–2000 chars). Returns `{ recipe, title, notes, valid, errors }`.
> The recipe only references template-library blocks (checked server-side); the client copies
> their trials verbatim via `composeFromTemplates`.

---

## Templates

Saved experiment drafts, reusable across experiments. Owner-scoped.

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/templates` | 🔒 | List my templates (metadata only, newest first) |
| GET | `/api/v1/templates/:id` | 🔒 | Get one template including its draft |
| POST | `/api/v1/templates` | 🔒 | Save a draft as a template (`draft` is fully schema-validated) |
| DELETE | `/api/v1/templates/:id` | 🔒 | Delete a template |

> Capped at 50 templates per researcher → `409` past that.
> Another researcher's (or a malformed) id is a plain `404`.

---

## Results

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/results/:experimentId/summary` | 👤 | Participants, completion rate, mean RT, accuracy |
| GET | `/api/v1/results/:experimentId/sessions` | 👤 | List sessions with timing quality score |
| GET | `/api/v1/results/:experimentId/sessions/:sessionId` | 👤 | One session + its trials |
| PATCH | `/api/v1/results/:experimentId/sessions/:sessionId` | 👤 | Exclude / include a session |
| GET | `/api/v1/results/:experimentId/export?format=csv\|json&kind=trials\|sessions&scope=all\|clean` | 👤 | Download trial rows or a per-session/block summary (CSV is formula-injection safe) |

---

**Total: 35 routes** (34 on routers + `GET /api/v1/health`)
