# Roadmap & Engineering Status

What is built, what is deliberately not built, and what is next in priority order. Kept honest:
items marked done were verified against the code, and items that look done but are not are
called out explicitly.

**Legend:** `[x]` built and verified · `[~]` built with a known gap noted inline · `[ ]` not started

- [Deployment status](#deployment-status)
- [Stack](#stack)
- [Build phases](#build-phases)
  - [Phase 1 — Timing engine](#phase-1--timing-engine-the-differentiator)
  - [Phase 2 — Backend and data](#phase-2--backend-and-data)
  - [Phase 3 — Auth and experiments](#phase-3--auth-and-experiments)
  - [Phase 4 — Visual builder](#phase-4--visual-builder)
  - [Phase 5 — Results](#phase-5--results)
  - [Phase 6 — Privacy and ethics](#phase-6--privacy-and-ethics)
  - [Phase 7 — AI generation](#phase-7--ai-generation)
  - [Phase 8 — Testing](#phase-8--testing)
- [Prioritised work](#prioritised-work)
  - [P0 — demo blockers](#p0--demo-blockers)
  - [P1 — credibility](#p1--credibility-before-a-reviewer-looks-closely)
  - [P2 — engineering debt](#p2--engineering-debt-worth-fixing)
- [Demo runbook](#demo-runbook)
- [Claims that need checking](#claims-that-need-checking)

---

## Deployment status

**Localhost only, by decision.** There is no `vercel.json`, no Dockerfile, no CI configuration
and no public URL. Two processes on one machine:

- API on `:3001`
- web app on `:5173`, serving both the researcher app and the participant app

Vercel Blob is still used for stimulus files, because that is a separate storage service rather
than a deployment of this app. Upstash Redis is used for rate limiting.

This is the largest single gap between the project and its stated goal, which describes a SaaS
platform. [P0 item 2](#p0--demo-blockers) is the workaround; a real deployment is the fix.

## Stack

**Frontend** — Vite 8 · React 19 (JavaScript, no TypeScript) · React Router 7 · Mantine 9 ·
React Flow (`@xyflow/react`) · Zustand · Zod 4 · GSAP + Lenis (landing page only)
**Backend** — Node ESM · Express 4 · Mongoose 8 · MongoDB Atlas · Zod 3 · JWT auth ·
Vercel Blob · Upstash Redis · Groq (AI generation)

Note the Zod major split: the frontend is on 4, the backend on 3. It works because the shared
schema is hand-ported rather than shared, but it is a real constraint on schema edits — see
[P2 item 4](#p2--engineering-debt-worth-fixing).

**Invariant:** during a trial the browser makes zero network calls. Everything loads first, the
run happens offline, data uploads between blocks and on tab close.

## Build phases

### Phase 1 — Timing engine (the differentiator)

Pure JavaScript in `frontend/src/engine/`, no React, no network. See
[architecture.md](architecture.md#the-timing-engine) for how it works.

- [x] `scheduler.js` — single rAF loop, ms → whole-frame conversion, dropped-frame accounting
- [x] `renderer.js` — full-window canvas, DPR-aware text, fixation cross
- [x] `input.js` — `event.timeStamp` capture, `event.repeat` ignored, `validKeys` filtering
- [x] RT = response `timeStamp` − stimulus onset frame timestamp
- [x] Safari epoch-timestamp normalisation against `performance.timeOrigin`
- [x] `calibration.js` — ~120 rAF frames → refresh rate, jitter, dropped frames, 0–100 score
- [x] Measured refresh rate fed into the scheduler for the whole run
- [x] `randomizer.js` — mulberry32 seeded PRNG, Fisher–Yates, max-repeats-in-a-row, block repetition
- [x] `flow.js` — generator walking blocks, following branch/loop edges, 500-step cycle guard
- [x] `preloader.js` — `img.decode()` for images, `decodeAudioData` for audio, progress reporting
- [x] `audio.js` — shared `AudioContext`, scheduled start, `webkitAudioContext` fallback
- [x] `logger.worker.js` — Web Worker buffer with an IndexedDB mirror
- [x] `uploader.js` — flush between blocks, 3 retries, `sendBeacon` on `visibilitychange`/`pagehide`
- [x] `trackEngagement()` — tab-switch, blur and fullscreen-exit counting
- [x] Cross-browser feature gate (AudioContext / rAF / `indexedDB` / Worker)
- [x] `selfcheck.mjs` — runnable assertion check of the pure logic
- [~] Audio stimuli are loaded and decoded but **never played** — `audio.js` exports `play()` and
      nothing calls it, and the trial renderer draws only `text` and `image`. The schema, the
      model, the preloader, the builder's stimulus-type picker and the AI catalog all advertise
      audio support. Small fix, listed in [P1](#p1--credibility-before-a-reviewer-looks-closely).
- [~] Only `withhold` (the no-go flag) has no builder UI, so the shipped Go/No-Go template
      cannot be hand-authored. It is honoured correctly at runtime by `score.js`.
- [ ] Verified on Firefox, Safari and a physical phone — the participant runtime has only been
      exercised in Chromium.

### Phase 2 — Backend and data

- [x] `db.js` — cached Mongoose connection, plus a boot-time self-heal that drops a non-partial
      `slug_1` index (a fresh Atlas cluster otherwise rejects the second experiment created)
- [x] `app.js` — JSON and `text/plain` (beacon) parsers, CORS, single global error handler
- [x] `middlewares/` — `requireAuth`, `ownsExperiment`, `validate` (Zod), `rateLimit`,
      `requireObjectId`, behind one barrel
- [x] `utils/` — `ApiResponse` envelope, `ApiError`, `asyncHandler`
- [x] Models: `User`, `Experiment`, `Session`, `Trial`, `Stimulus`, `Template`
- [x] Indexes: `sessionId`, `experimentId`, `owner`, unique `email`, unique `withdrawCode`,
      partial unique `slug`
- [x] `minimize: false` on `Experiment` so an unsaved `draft: {}` survives a publish
- [x] All 7 participant routes, public and rate-limited
- [x] Email normalised on register and login (case-variant duplicate → 409)
- [x] Password length capped at 8–128 chars, bounding bcrypt cost against DoS
- [x] Trials/complete/PATCH refuse any session that is not `in_progress` (409)
- [x] Beacon payload Zod-validated before insert; rate-limit keyed on the first forwarded IP
- [x] Malformed ObjectId params → 404, never 500
- [x] Stimulus `url` must be a Blob URL; `size` capped at 50 MB
- [x] CSV export neutralises formula injection
- [~] `draft` is `z.any()` on experiment create and update — **it is never validated
      server-side**. A structurally invalid draft can be published, and every participant then
      sees "Could not load". Validation currently happens only in the browser.
      See [P1](#p1--credibility-before-a-reviewer-looks-closely).

### Phase 3 — Auth and experiments

- [x] Sign up / sign in pages, `ProtectedRoute`, session restore via `/auth/me`
- [x] `api/client.js` attaches the JWT, retries once through a silent refresh, logs out on 401
- [x] Refresh tokens rotated on every use, stored as a SHA-256 hash, replay rejected
- [x] Envelope unwrapped once in the client so no feature module knows it exists
- [x] Dashboard: cards, status badge, create / open / duplicate / close / delete, copy
      participant link
- [x] Demo account is a real database user (`demo@codyssey.local` / `demo1234`, overridable with
      `SEED_EMAIL` / `SEED_PASSWORD`) — the earlier localStorage "demo mode" was revoked because
      it could never be shared to a phone
- [~] Tokens are stored in `localStorage`, so they are reachable by injected script. Moving the
      refresh token to an httpOnly cookie requires tightening CORS from `*` in the same change.
      See [P2](#p2--engineering-debt-worth-fixing).

### Phase 4 — Visual builder

- [x] `shared/experimentSchema.js` (Zod 4) + a hand-ported copy in `backend/src/validators/`
- [x] React Flow canvas: background, zoom, minimap, whiteboard and flow layouts
- [x] Nodes: Start, Block, Branch, Loop, End · Zustand store with 50-step undo/redo
- [x] Real drag-from-palette via `dataTransfer` + `screenToFlowPosition`, alongside a
      click-to-append shortcut for first-time users
- [x] `compile.js` — graph → draft JSON, Zod-validated, with Zod issue paths reverse-mapped to
      node ids so the canvas highlights the offending node, and warnings for blocks not wired
      into the chain rather than silent data loss
- [x] `friendlyError()` rewrites Zod messages into actionable sentences
- [x] Toolbar: editable title, undo/redo, save + 30 s autosave when dirty, preview, publish
- [x] Stimuli: dropzone (direct to Blob via `@vercel/blob/client`), library, picker
- [x] Ten built-in paradigm templates across seven categories, plus per-template assertions
- [x] `HowItWorksModal` — a four-chapter interactive guide with a working mini canvas and a
      playable Stroop trial
- [~] Trials are edited in a modal form and table, not as individual objects on the canvas. The
      graph describes structure; the form describes stimuli. Bulk CSV paste covers the
      high-volume case.

### Phase 5 — Results

- [x] All 5 result routes
- [x] 8 summary cards, RT / accuracy / timing-quality charts by condition
- [x] Participant table with timing score, per-trial drawer, exclude toggle, low-quality filter
- [x] Auto-refresh every 5 s with a live indicator
- [x] CSV + JSON export, formula-injection safe, 26 columns per trial
- [~] **No inferential statistics.** Means and proportions only — no standard deviation, no SEM,
      no confidence intervals, no paired tests, no effect sizes, no RT trimming or outlier
      rules, no practice-block exclusion, no paradigm-specific scoring (IAT D-score, search
      slope). Stroop, Flanker and IAT templates ship, so the platform can collect data for
      paradigms whose standard analysis it cannot perform. This is the most valuable single
      improvement available. See [P1](#p1--credibility-before-a-reviewer-looks-closely).
- [~] `meanRt` in the summary averages **all** trials, including incorrect and no-go responses,
      which is not a meaningful decision time.
- [~] Per-condition charts are aggregated client-side, capped at 50 sessions, and re-fetch on
      every 5 s poll — roughly 50 full-trial requests every 5 seconds, sustained. Sessions past
      the cap are silently dropped.
- [ ] No pagination anywhere. `getSummary` and `exportData` load whole tables into memory.

### Phase 6 — Privacy and ethics

Full detail, including every known gap, in [privacy.md](privacy.md).

- [x] Consent screen with researcher-set text and a decline path that collects nothing
- [x] Random UUID `participantId` only — no name, email, IP or raw user-agent field exists
- [x] 8-character withdrawal code plus public self-service delete of session and trials
- [x] Ownership enforced in middleware on every results and experiment route
- [x] Secrets only in environment variables; `GROQ_API_KEY` never reaches the browser
- [~] The consent event itself is not persisted — no timestamp, no consent-text version. The
      main IRB gap.
- [~] `withdrawCode` rides along in the researcher sessions payload and can be deleted, though
      the fix is a one-line `delete`.
- [ ] `scrub.js` (free-text redaction) is **dead code** — nothing imports it, because the app has
      no free-text field. Previously reported as working. Delete it or wire it up alongside a
      free-text question type.

### Phase 7 — AI generation

- [x] `POST /generate` — clarify step, compact `trialTypes` design, deterministic normalisation,
      schema + semantic validation, up to two repair rounds, 60-minute valid-only cache
- [x] Client wired: `api/ai.js` posts `{ prompt }` and handles the `kind: "questions"` response
- [x] `aiCatalog.js` — component whitelist plus 12 paradigm recipes, and an explicit list of
      paradigms it cannot express so the model approximates and discloses it in `notes`
- [ ] Bot-detection score
- [ ] Participant simulator
- [ ] Auto-generated IRB summary

### Phase 8 — Testing

- [x] `backend/test-routes.mjs` — 84 assertions across the API surface: happy path, invalid
      body, wrong owner (403), missing resource (404), malformed ObjectId (404 not 500), state
      conflicts (409), closed experiment (410), refresh-token replay, cross-user isolation,
      CSV header and row count, cascade-delete counts. Skips the AI route without a key.
- [x] `services/normalizeDraft.check.js` — 18 assertions on normalisation, repair triggering and
      `trialTypes` expansion
- [x] `engine/selfcheck.mjs` — assertions on the pure timing and flow logic
- [x] `shared/templates/templates.check.mjs` — every template compiles and expands to the
      expected trial counts
- [~] No test framework. These are hand-rolled `assert` scripts, so there is no runner, no
      coverage measurement and no CI. `npm test` is literally `node test-routes.mjs`.
- [~] No frontend component or integration tests at all — `frontend/package.json` has no `test`
      script.
- [ ] `npm test` needs the API running and takes about 3 minutes (it paces itself under the rate
      limiter), so it is not yet wired into any commit hook.

## Prioritised work

### P0 — demo blockers

| # | Item | State |
|---|---|---|
| 1 | ~~AI modal 404s~~ — the client posted to a route that no longer existed | **done.** `api/ai.js` posts to `/generate` with `{ prompt }` and handles the clarify response |
| 2 | **A reviewer's phone cannot open a participant link on localhost** — a phone's `localhost` is the phone, not your laptop | **open.** `--host` and the LAN `CORS_ORIGIN` / `FRONTEND_URL` variables are documented; a public tunnel for the demo is the remaining step. See [Demo runbook](#demo-runbook) |
| 3 | ~~Copy buttons silently fail on a LAN phone~~ — `navigator.clipboard` needs a secure context | **done.** The call sites go through `shared/clipboard.js`, which falls back to selecting the on-screen text |
| 4 | ~~A fresh Atlas cluster breaks on the second experiment~~ — a non-partial unique `slug` index rejects duplicate `null` slugs | **done.** `db.js` inspects the indexes on boot, drops a bad `slug_1` and re-syncs |

### P1 — credibility before a reviewer looks closely

| # | Item | Why it matters | Size |
|---|---|---|---|
| 5 | **A public URL for the demo** | Everything else is invisible to a judge who cannot open the link. Cheapest path is a tunnel — no account, no config. | 5 min |
| 6 | **Validate drafts server-side on publish** | Right now a malformed draft can be published and breaks every participant who opens it. Gate `publishExperiment` on the existing `validateExperiment()`. | ~10 lines |
| 7 | **Standard deviation, n and SEM in the summary** | A cognitive-science platform reporting a mean with no dispersion is the most exposed gap, and it is what makes the shipped Stroop/Flanker/IAT templates interpretable. Exclude incorrect and no-go trials from the RT mean. | ~20 lines |
| 8 | **Play audio stimuli** | An entire stimulus modality is advertised in the schema, the builder and the AI catalog but silently does nothing. | ~10 lines |
| 9 | **Return `meanRt` and `completionRate` from the engine's `getMetrics`** | Two of the three branch metrics are selectable in the UI and always evaluate false, so the feature reads as fake. | ~10 lines |
| 10 | **Strip `withdrawCode` from researcher responses** | A researcher can currently read a participant's deletion code. | 1 line |
| 11 | **Record consent** — server-stamped `agreedAt` plus a hash of the published consent text | Turns a consent checkbox into an auditable consent record, which is what the ethics claim rests on. | ~20 lines |
| 12 | **A `withhold` toggle in the trial form** | The Go/No-Go template cannot be hand-authored without it. | ~10 lines |
| 13 | **Verify on Firefox, Safari and a phone** | The participant runtime is the differentiator and has only run in Chromium. | 30 min |
| 14 | **Move per-condition aggregation server-side** | Ends the ~50-requests-every-5-seconds pattern and the silent 50-session cap. | ~1 h |

### P2 — engineering debt worth fixing

| # | Item | Note |
|---|---|---|
| 15 | Unique index on `(sessionId, trialIndex)` + upsert | A retried upload batch double-inserts trials, which corrupts the data. Needs a dedupe migration first if any collection already has duplicates. |
| 16 | Refresh token in an httpOnly cookie, with CORS tightened in the same change | `cors({ origin: '*' })` today. Do these together or auth breaks. |
| 17 | `helmet` + a CSP | Defaults today. The CSP has to permit the Vite dev server and the Blob origin, so test a full participant run afterwards. |
| 18 | Per-session capability token for `/run/sessions/:id/*` | These routes authenticate on ObjectId possession alone. |
| 19 | Pagination on the sessions and export routes | Explicitly absent today. |
| 20 | Route-level code splitting | The researcher bundle is ~1.55 MB (478 kB gz). Irrelevant on localhost; visible if deployed. |
| 21 | Store the randomization seed on the session | `createSeededRandom` exists and is deterministic but is never called, so trial order is not reproducible after the fact — a real requirement for replication. |
| 22 | A test framework | The hand-rolled `.check.mjs` scripts work but have no runner, coverage or CI. |
| 23 | Delete `scrub.js`, and either implement or remove the `showProgressBar` setting | Both are validated and stored but never read. |
| 24 | A real migration instead of the boot-time index self-heal | Correct, but it is a hack that runs on every cold start. |

## Demo runbook

**On a phone**, `localhost` only works on the host machine. Three options, cheapest first:

1. **LAN — no extra software.** Start the frontend with `npm run dev -- --host`, find the
   machine's IP (`ipconfig getifaddr en0`), then set
   `CORS_ORIGIN=http://<ip>:5173` and `FRONTEND_URL=http://<ip>:5173` in `backend/.env` and
   restart the API. Both servers already bind all interfaces, so the only blockers are CORS and
   the firewall.
2. **Tunnel — one command, works from any network.**
   `cloudflared tunnel --url http://localhost:5173` or `ngrok http 5173`, then put that origin
   in `CORS_ORIGIN` and `FRONTEND_URL`. Note this *is* public exposure, and the withdrawal code
   is the only thing protecting participant data — which is the point being demonstrated.
3. **Same device.** Hand the laptop over, or screen-share. The phone step becomes optional.

**Suggested five-minute script:**

1. The problem in one sentence — lab timing is precise but small-N; web scale is large-N but
   untrustworthy timing
2. Generate a Stroop task with the AI modal, showing the clarifying questions
3. Publish, put the link in a reviewer's hand
4. Show their timing-quality score, and the results page updating live
5. Show the withdrawal code and the privacy posture

**Before the demo:** run `npm test` in `backend/` with the API up, complete one participant run
end to end, and confirm the seeded demo account works.

## Claims that need checking

Things a previous version of this document asserted that turned out to be false, recorded so
they are not repeated:

| Claim | Reality |
|---|---|
| "`scrub.js` strips emails and phone numbers from free-text answers" | The function is **dead code** — imported nowhere, and there is no free-text field to scrub. |
| "The route test script is throwaway, not committed" | It is committed as `backend/test-routes.mjs`, with 84 assertions. |
| "`frontend/README.md` exists but is the Vite default" | There is no `frontend/README.md`. The env-var documentation lives in the [root README](../README.md#environment) instead. |
| "Delete the two `vercel.json` files" | Already deleted. |
| "Seed a demo experiment with sample participants" | Already done — `backend/seed-demo.js`, 12 sessions. |
| "Drag-from-palette is not done" | Done, in `Canvas.jsx`. |
| "The AI client still calls `/ai/generate-experiment`" | Fixed. |
| "80 assertions" in the route test | 84. |

`VITE_DEMO_AUTH` appears in a local `frontend/.env` and is referenced nowhere in the code — it is
a leftover from the revoked localStorage demo mode, and is not documented.
