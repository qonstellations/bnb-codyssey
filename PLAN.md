# PLAN.md — Web-Based Experiment Platform

Status of the `integration` branch. `[x]` = built and verified, `[~]` = built but has a known
gap (noted inline), `[ ]` = not started.

**Deployment: localhost only.** Vercel deployment is cancelled — no `vercel.json` in play, no
public URLs. Everything runs on one machine (see [Running locally](#running-locally)). Vercel
Blob is still used for stimulus files because it is a separate storage service, not a deploy.

**Stack:** Vite 8 + React 19 (JavaScript) · React Router 7 · Mantine 9 · React Flow (@xyflow) ·
Zustand · Zod · Express 4 (localhost) · MongoDB Atlas + Mongoose 8 · JWT auth · Vercel Blob ·
Upstash Redis · Groq (AI generation)

**Golden rule:** During a trial, the browser makes **zero network calls**. Load everything
first, run offline, upload after.

---

## Running locally

```bash
# 1. backend → http://localhost:3001
cd backend && npm ci && npm run dev

# 2. frontend → http://localhost:5173
cd frontend && npm ci && npm run dev
```

`backend/.env` and `frontend/.env` (both gitignored) hold every secret and URL:

| Var | Where | Value for local |
|---|---|---|
| `MONGODB_URI` | backend | Atlas SRV string |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | backend | any long random string |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | backend | optional — rate limiting is skipped if unset |
| `BLOB_READ_WRITE_TOKEN` | backend | needed for stimulus uploads only |
| `GROQ_API_KEY` | backend | needed for AI generation only |
| `CORS_ORIGIN` | backend | `http://localhost:5173` (add your LAN IP origin too, see Phase 9) |
| `FRONTEND_URL` | backend | `http://localhost:5173` — used to build the participant link |
| `VITE_API_URL` | frontend | `http://localhost:3001` |

**Routes:** the participant runtime is a second Vite entry point (`run.html` →
`src/runtime/main.js`), so `/run/<slug>` and `/dashboard` are two different bundles from one
dev server. A dev-only Vite plugin serves `run.html` for `/run/*`, since the old `vercel.json`
rewrite that used to do this is no longer applied.

**Sanity check:** `curl http://localhost:3001/api/v1/health` → `{ status: "ok" }`.

---

## Phase 0 — Setup

### Accounts
- [x] GitHub repo created, teammates added
- [x] MongoDB Atlas cluster, database user, network access `0.0.0.0/0`
- [x] JWT secrets (access + refresh) in env
- [x] Upstash Redis database (URL + token)
- [x] Vercel Blob token
- [x] Groq API key (`GROQ_API_KEY`)

### Repo skeleton
- [x] `/backend` ESM (`"type": "module"`), `/frontend` Vite React JS
- [x] `.gitignore` (node_modules, .env) in both
- [x] `.env` created in both, never committed
- [ ] `vercel.json` in both folders — dead config now that deployment is cancelled (P1 #8)

### Install packages
- [x] Frontend: `react-router-dom @mantine/* @xyflow/react zustand zod @vercel/blob recharts gsap lenis`
- [x] Backend: `express mongoose cors zod jsonwebtoken bcryptjs @vercel/blob @upstash/* groq-sdk dotenv`

### Run "hello world" locally
- [x] `GET /api/v1/health` responds on `:3001`
- [x] Frontend calls it (CORS via `CORS_ORIGIN`)
- [x] Both entry points build (`npm run build` emits `index.html` + `run.html`)

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
- [x] `vite dev` serves `run.html` for `/run/*` (the rewrite plugin replaced the Vercel-only rewrite)
- [x] Dark landing page with an interactive reaction-time demo (GSAP + Lenis)
- [~] `frontend/README.md` exists but is the Vite default — rewrite it with the env var list
      (`VITE_API_URL`, `VITE_DEMO_AUTH`, backend `MONGODB_URI`, `ACCESS_TOKEN_SECRET`,
      `REFRESH_TOKEN_SECRET`, `UPSTASH_*`, `BLOB_READ_WRITE_TOKEN`, `GROQ_API_KEY`) before demo
- [ ] Seeded demo experiment with sample participant data

---

## Bug Fix Plan

Prioritised for the demo. P0 = the demo breaks without it.

### P0 — blocks the demo

| # | Bug | Root cause | Fix | Size |
|---|---|---|---|---|
| 1 | AI modal 404s | client `POST /ai/generate-experiment {description}` vs server `POST /generate {prompt}` | point `api/ai.js` at `/generate`, send `{ prompt }`, read `data.draft` + `data.valid` | 3 lines |
| 2 | Judge's phone can't open the participant link on localhost | a phone's `localhost` is the phone, not your laptop | see [Demo on a phone](#demo-on-a-phone) — `vite --host`, LAN IP in `FRONTEND_URL`/`CORS_ORIGIN`, or a tunnel | 5 min setup |
| 3 | Copy buttons silently fail on a LAN phone | `navigator.clipboard` needs a secure context; `http://10.0.x.x` isn't one | wrap the three `navigator.clipboard` calls in `try/catch` and select the code text instead (the code is already on screen) | ~10 lines |
| 4 | Any fresh Atlas cluster breaks on the 2nd experiment | old non-partial `slug_1` index rejects duplicate `null` slugs | already fixed on the current cluster; run `db.experiments.dropIndex("slug_1")` once on any new one | 1 command |

### P1 — credibility before judges look closely

| # | Item | Why it matters | Size |
|---|---|---|---|
| 5 | Rewrite `frontend/README.md` (still the Vite template) | judges will look for setup instructions; the env var table already exists in this plan, just move it | 15 min |
| 6 | Commit the route test script as `backend/test-routes.mjs` | turns "it works" into a re-runnable claim; it caught 5 real bugs | 10 min |
| 7 | Verify on Firefox + Safari + a phone | the participant runtime is the differentiator and has only been run in Chromium | 30 min |
| 8 | Delete the two `vercel.json` files | dead config that contradicts the "localhost only" decision | 1 min |
| 9 | Seed a demo experiment with sample participants | results dashboard is empty on first open, which reads as "unfinished" | 20 min |

### P2 — only if there's time

| # | Item | Note |
|---|---|---|
| 10 | Code-split builder + results routes | `main` bundle is ~1.5 MB (React Flow + Mantine). Fine on localhost, no need unless you want the number to look good |
| 11 | Idempotency key on trial upload | a retried batch double-inserts trials; add a unique `(sessionId, trialIndex)` index if that ever shows up |
| 12 | Aggregated summary/export queries | both load whole tables into memory; fine for a demo, matters at 10k+ trials |

---

## Phase 9 — Demo Prep (localhost)

- [ ] Bug Fix Plan P0 complete
- [ ] Demo script (< 5 min):
  1. Problem in one sentence
  2. Build a Stroop task live in the builder (or generate it with AI, once #1 is fixed)
  3. Judge takes it on their phone via the link
  4. Show their timing-quality score + results updating live
  5. Show privacy features (anonymous ID, withdraw code)
- [ ] Pitch slides
- [ ] Backup screen recording (Wi-Fi in the room is not guaranteed)
- [ ] `demo@codyssey.local` password memorised, or swap in your own account

### Demo on a phone

`localhost` only works on the host machine. To put the study in a judge's hand you need the
laptop reachable from their phone — three options, cheapest first:

1. **LAN (recommended, no extra software).** Start the frontend with
   `npm run dev -- --host`, find the laptop's IP (`ipconfig getifaddr en0` → currently
   `10.0.43.237`), then set `CORS_ORIGIN=http://10.0.43.237:5173` and
   `FRONTEND_URL=http://10.0.43.237:5173` in `backend/.env` and restart it. Both servers already
   bind all interfaces, so the only blockers are CORS and the firewall. Judge opens
   `http://10.0.43.237:5173/run/<slug>`.
2. **Tunnel (one command, works from any network).** `cloudflared tunnel --url http://localhost:5173`
   or `ngrok http 5173`, then put that origin in `CORS_ORIGIN` + `FRONTEND_URL`. Note this *is*
   public exposure — the withdraw code is the only thing protecting participant data, which is
   exactly the point of the demo.
3. **Same-device demo.** Hand the laptop over / screen-share. The phone step becomes optional.

---

## Suggested team split (4 people)

| Person | Owns |
|---|---|
| A | Timing engine + participant runtime |
| B | Backend, models, all API routes |
| C | Visual builder + stimuli upload |
| D | Auth, dashboard, results charts, demo prep |
