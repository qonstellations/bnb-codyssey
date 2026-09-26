# PLAN.md — Web-Based Experiment Platform

Status of the `integration` branch. `[x]` = built and verified, `[~]` = built but has a known
gap (noted inline), `[ ]` = not started.

**Stack:** Vite 8 + React 19 (JavaScript) · React Router 7 · Mantine 9 · React Flow (@xyflow) ·
Zustand · Zod · Express 4 on Vercel · MongoDB Atlas + Mongoose 8 · JWT auth · Vercel Blob ·
Upstash Redis · Groq (AI generation)

**Golden rule:** During a trial, the browser makes **zero network calls**. Load everything
first, run offline, upload after.

---

## Phase 0 — Setup

### Accounts
- [x] GitHub repo + Vercel connected
- [x] MongoDB Atlas cluster, database user, network access `0.0.0.0/0`
- [x] JWT secrets (access + refresh) in env
- [x] Upstash Redis database (URL + token)
- [x] Vercel Blob token
- [x] Groq API key (`GROQ_API_KEY`)

### Repo skeleton
- [x] `/backend` ESM (`"type": "module"`), `/frontend` Vite React JS
- [x] `.gitignore` (node_modules, .env) in both
- [x] `.env` created in both, never committed
- [x] `vercel.json` in both (`/api/(.*)` → `api/index.js`; `/run/*` → `run.html`)

### Install packages
- [x] Frontend: `react-router-dom @mantine/* @xyflow/react zustand zod @vercel/blob recharts gsap lenis`
- [x] Backend: `express mongoose cors zod jsonwebtoken bcryptjs @vercel/blob @upstash/* groq-sdk dotenv`

### Deploy "hello world" early
- [x] `GET /api/v1/health` live
- [x] Frontend calls it (CORS configured via `CORS_ORIGIN`)

---

## Phase 1 — Timing Engine (the differentiator)

Built in `frontend/src/engine`. Pure JavaScript, **no React, no network during trials**.

- [x] `preloader.js` — `img.decode()` for every image, `decodeAudioData` for audio, progress bar
- [x] `renderer.js` — full-window canvas, DPR-aware text, fixation cross
- [x] `scheduler.js` — single `requestAnimationFrame` loop, ms → whole-frame conversion
- [x] `input.js` — `event.timeStamp` capture, ignores `event.repeat`, only accepts `validKeys`
- [x] RT = response `timeStamp` − stimulus onset frame time
- [x] `audio.js` — shared `AudioContext`, scheduled start, `webkitAudioContext` fallback
- [x] `randomizer.js` — mulberry32 seeded PRNG, Fisher–Yates, max-repeats-in-a-row, block repetition
- [x] `flow.js` — generator walking blocks, following branch/loop edges, 500-step loop guard
- [x] `logger.worker.js` — Web Worker buffer + IndexedDB mirror
- [x] `uploader.js` — batch flush between blocks, 3 retries, `sendBeacon` on `visibilitychange`/`pagehide`
- [x] `calibration.js` — ~120 rAF frames → refresh rate, jitter, dropped frames, **0–100 quality score**
- [x] Per-trial frame log: intended vs actual frames, dropped frames
- [x] `trackEngagement()` — tab-switch / blur counting
- [x] `selfcheck.mjs` — runnable assert-based check of the pure logic: `node src/engine/selfcheck.mjs`
- [x] Cross-browser feature gate (AudioContext / rAF / `indexedDB` / Worker)

---

## Phase 2 — Backend + Database

### Core setup
- [x] `src/db.js` — cached Mongoose connection
- [x] `src/app.js` — JSON + `text/plain` (beacon) parsers, CORS, global error handler
- [x] `src/middleware.js` — `requireAuth`, `ownsExperiment`, `validate(Zod)`, `rateLimit`, `requireObjectId`
- [x] `src/utils/` — `ApiResponse` envelope, `ApiError`, `asyncHandler`

### Models
- [x] `User` (bcrypt via pre-save hook, token helpers), `Experiment`, `Session`, `Trial`, `Stimulus`
- [x] Indexes: `sessionId`, `experimentId`, `owner`, unique `email`, unique `withdrawCode`
- [x] `slug` unique **partial** index (drafts exempt) + 3-retry publish
- [x] `minimize: false` on Experiment so an unsaved `draft: {}` survives a publish

### Participant routes (public) — 7/7
- [x] All of `GET /run/:slug`, `POST /run/:slug/sessions`, `PATCH`, `POST /trials`, `POST /complete`, `POST /beacon`, `DELETE /withdraw/:code`
- [x] Runtime fetches by slug, trial data lands in Atlas

### Hardening found by live testing
- [x] Email normalised on register/login (case-variant duplicate → 409)
- [x] Password length capped (bcrypt DoS), logout verifies the refresh-token hash
- [x] Trials/complete/PATCH refuse any session that isn't `in_progress` (409)
- [x] Beacon payload Zod-validated before insert, first-IP rate-limit key
- [x] Malformed ObjectId params → 404 (never 500)
- [x] Stimulus `url` must be a Blob URL, `size` capped 50 MB
- [x] CSV export neutralises formula injection
- [x] Rate limiting extended to register/login/refresh

---

## Phase 3 — Researcher Auth + Experiments — 5/5 auth, 7/7 experiments
- [x] Sign up / sign in pages, `ProtectedRoute`, session restore via `/auth/me`
- [x] `api/client.js` attaches the JWT, retries once through a silent refresh, logs out on 401
- [x] Rotated refresh token persisted (backend invalidates the old one every use)
- [x] Dashboard: cards, status badge, create / open / duplicate / close / delete, copy participant link, Stroop template start
- [x] Demo account is a **real database user** (`demo@codyssey.local` / `demo1234`) — the earlier
      localStorage "demo mode" was revoked because it could never be shared to a phone
- [x] Envelope unwrapped once in `client.js` so no caller has to know about `data`

---

## Phase 4 — Visual Builder
- [x] `shared/experimentSchema.js` (Zod) + ported copy in `backend/src/validators/`
- [x] React Flow canvas: background, zoom, minimap, whiteboard/flow layout
- [x] Nodes: Start, Block, Branch, Loop, End · Zustand store with undo/redo
- [x] Panels: node inspector, block editor (trial table), trial form, randomization, branch rules, settings
- [x] `compile.js` — graph → draft JSON, Zod-validated, node-level error highlighting + warnings for
      blocks not wired into the chain
- [x] Toolbar: editable title, undo/redo, save + 30 s autosave when dirty, preview, publish
- [x] Stimuli: dropzone (direct-to-Blob via `@vercel/blob/client`), library, picker in the node inspector
- [x] Templates: Stroop, Flanker, Simple RT
- [ ] Real React Flow drag-from-palette (nodes are added from the toolbar, not dragged)

---

## Phase 5 — Results Dashboard
- [x] All 5 result routes
- [x] Summary cards, RT / accuracy / quality-score charts by condition
- [x] Participant table with timing score, trial drawer, exclude toggle
- [x] Auto-refresh every 5 s with a live indicator
- [x] CSV + JSON export (formula-injection safe)
- [ ] Empty state copy for "no participants yet" on the builder side

---

## Phase 6 — Privacy + Ethics
- [x] Consent screen with researcher-set text, decline path
- [x] Random UUID `participantId` only — no names, emails or IPs stored
- [x] `scrub.js` strips emails / phone numbers / long digit runs from free-text answers client-side
- [x] 8-char withdraw code on the completion screen + `/run/withdraw` self-service delete
- [x] Ownership enforced on every results/experiment route
- [x] Secrets only in env vars; the Groq key never reaches the browser

---

## Phase 7 — Stretch
- [x] AI experiment generation, backend-side (Groq) + schema-validated
- [~] Client wiring: `src/api/ai.js` still posts to `/ai/generate-experiment` with `{ description }`;
      the real route is `POST /generate` with `{ prompt }` returning `{ draft, valid, errors }`
- [x] Template library (Stroop, Flanker, Simple RT)
- [ ] Bot-detection score
- [ ] Participant simulator
- [ ] Auto-generated IRB summary

---

## Phase 8 — Testing + Polish
- [x] Route-by-route verification against a live backend (80 assertions: happy path, bad body,
      wrong owner, missing resource, state conflict) — all green. ⚠️ The script is throwaway,
      not committed; commit it as `backend/test-routes.mjs` if you want it re-runnable
- [x] Envelope + 404 behaviour re-verified after the refactor
- [x] Loading / error / empty states on dashboard, builder, results
- [x] `npm run build` green for both entry points (`index.html`, `run.html`)
- [x] `vite dev` serves `run.html` for `/run/*` (rewrites only existed on Vercel)
- [x] Dark landing page with an interactive reaction-time demo (GSAP + Lenis)
- [~] `frontend/README.md` exists but is the Vite default — rewrite it with the env var list
      (`VITE_API_URL`, `VITE_DEMO_AUTH`, backend `MONGODB_URI`, `ACCESS_TOKEN_SECRET`,
      `REFRESH_TOKEN_SECRET`, `UPSTASH_*`, `BLOB_READ_WRITE_TOKEN`, `GROQ_API_KEY`) before demo
- [ ] Seeded demo experiment with sample participant data

---

## Known Gaps (fix before the demo)

| # | Gap | Fix |
|---|---|---|
| 1 | AI modal 404s — client calls `/ai/generate-experiment` | point `api/ai.js` at `/generate`, send `{ prompt }` |
| 2 | Production Atlas still has the old non-partial `slug_1` index | drop it once: `db.experiments.dropIndex("slug_1")` |
| 3 | `demo@codyssey.local` has a public password | fine for dev; delete or rotate before deploying |
| 4 | `main` bundle ~1.5 MB (React Flow + Mantine) | code-split builder/results routes if the demo needs it |

---

## Suggested team split (4 people)

| Person | Owns |
|---|---|
| A | Timing engine + participant runtime |
| B | Backend, models, all API routes |
| C | Visual builder + stimuli upload |
| D | Auth, dashboard, results charts, demo prep |
