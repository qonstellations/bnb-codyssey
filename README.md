# Codyssey

**Build a reaction-time or cognitive study in a visual builder, publish it to a link, and watch
results land live — with millisecond-accurate stimulus timing in the participant's own browser.**

A web-based experiment platform for behavioural research: a drag-and-drop builder for designing
trials, a publish flow that produces a participant link, a participant runtime engineered for
timing fidelity, and a results dashboard with per-participant data-quality scoring.

---

## Table of contents

- [The problem](#the-problem)
- [What makes the timing work](#what-makes-the-timing-work)
- [Feature overview](#feature-overview)
- [Quickstart](#quickstart)
  - [Environment](#environment)
  - [Verifying the install](#verifying-the-install)
  - [Demo data](#demo-data)
  - [Running on a phone](#running-on-a-phone)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment status](#deployment-status)
- [Documentation](#documentation)
- [Stack](#stack)

---

## The problem

Cognitive research has historically been confined to laboratories: precise, but dependent on
specialised equipment and desktop software, limited to small and demographically narrow samples.
Moving online fixes the sampling problem and creates a new one — the web is a hostile environment
for millisecond-sensitive measurement. A stimulus that should last 2000 ms might last 1800, or
2400, or pause while the browser loads something. Response times get contaminated. Findings stop
being trustworthy, and the reason is invisible unless you go looking.

Most online tools resolve this by giving up on precision. Ours measures it instead.

## What makes the timing work

**The display is measured before the study starts.** A ~120-frame calibration pass records the
screen's *actual* refresh rate (not what the OS reports — it may be 60, 120 or 144 Hz), the
jitter in the frame deltas, and the dropped-frame rate. The measured refresh rate then drives the
scheduler for the entire run, so a 2000 ms trial is 240 frames on a 120 Hz phone rather than
being cut in half.

**Every device gets a quality score, 0–100**, derived from jitter and dropped frames. It is
stored on the session, charted on the results page, filterable, and exported to CSV — so a study
can exclude participants whose timing quality was too poor to trust. That is a
research-integrity feature, not just a diagnostic.

**Durations are counted in frames, not milliseconds.** A trial runs for exactly N frames, and any
shortfall is recorded as `framesDropped` on that trial rather than hidden. Nothing silently
fabricates precision it does not have.

**Reaction times come from the browser's own clock.** `rt = event.timeStamp − onsetFrameTimestamp`,
where the onset is the timestamp of the first animation-frame callback of the stimulus phase —
not the moment the code requested it, which is where naive implementations quietly lose several
milliseconds. Safari's epoch-based `event.timeStamp` quirk is normalised explicitly.

**Zero network calls happen during a trial.** Everything — assets, decoding, permissions — is
done up front behind a progress bar. The trial itself is a single `requestAnimationFrame` loop.
Data uploads between blocks and via `sendBeacon` on tab close.

**The participant bundle is ~35 KB gzipped** and contains no React, no Mantine and no charting
library, because a participant should never be able to download the researcher's application to
take a study.

The full explanation, with the code, is in
[docs/architecture.md](docs/architecture.md#the-timing-engine).

## Feature overview

**For researchers**

- Visual drag-and-drop builder — a React Flow canvas of `Start` / `Block` / `Branch` / `Loop` /
  `End` nodes, with a bidirectional compiler that maps schema errors back to the offending node
- Six built-in paradigm templates — Simple RT, Choice RT, Stroop, Go/No-Go, 2-back and Task
  switching, each with a preview card, an estimated duration, and a difficulty level
- AI experiment generation from a plain-English description, with a clarifying-questions step and
  a schema-validate-repair loop
- Conditional branching on live metrics, block loops, shuffling with a max-repeats constraint,
  and block repetition
- Stimulus library with direct-to-Blob upload
- One-click publish producing a participant link; every publish freezes an immutable version
- Live results dashboard — mean RT and accuracy by condition, timing-quality histogram,
  per-participant table with a per-trial drawer
- Reproducible trial order — every session stores the PRNG seed that produced its shuffle
- CSV and JSON export, formula-injection safe
- Undo/redo, 30-second autosave, and an interactive in-app guide

**For participants**

- A consent screen with a decline path that collects nothing at all
- A device timing check with an honest quality score
- Fullscreen and audio unlocked by the instructions click
- A touch response pad on touch-only devices — one large button per response key
- Canvas text auto-fitted to the viewport, with the webfont preloaded so glyphs never swap
  mid-trial
- Preloaded assets with a progress bar, then a fully offline trial run
- Block intro screens between phases, with practice retries explained in place
- An 8-character withdrawal code and a public self-service deletion route

**Privacy posture:** participants are identified only by a server-generated random UUID. The data
model has no field for a name, email, IP address or raw user agent. Session writes require a
per-session capability token, so knowing a session's id is not enough to alter it. Participants
can withdraw with a self-service code, and researchers can erase their account and all derived
data. Full detail, including an explicit list of known gaps, is in
[docs/privacy.md](docs/privacy.md).

## Quickstart

Two processes, no Docker, no deployment.

```bash
# terminal 1 — API on :3001
cd backend
npm ci
cp .env.example .env      # fill it in — see the table below
npm run dev

# terminal 2 — web app on :5173
cd frontend
npm ci
cp .env.example .env      # VITE_API_URL=http://localhost:3001
npm run dev
```

Open <http://localhost:5173> and sign up. Sanity-check the API with
`curl http://localhost:3001/api/v1/health`.

### Environment

`backend/.env` — template at `backend/.env.example`

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `ACCESS_TOKEN_SECRET` | yes | signs 15-minute access tokens |
| `REFRESH_TOKEN_SECRET` | yes | signs 7-day refresh tokens |
| `CORS_ORIGIN` | yes | allowed frontend origin, e.g. `http://localhost:5173` |
| `FRONTEND_URL` | yes | used to build the participant link on publish |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | rate limiting, 10 req / 10 s per IP. **Silently skipped when unset** — the limiter logs nothing and fails open |
| `BLOB_READ_WRITE_TOKEN` | stimuli only | Vercel Blob upload token |
| `GROQ_API_KEY` | AI only | AI experiment generation. The key never reaches the browser |

`frontend/.env` — template at `frontend/.env.example`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | yes | API base, e.g. `http://localhost:3001` |

### Verifying the install

```bash
curl http://localhost:3001/api/v1/health     # → { "status": "ok" }

cd frontend && npm run build                 # both bundles build
node src/engine/selfcheck.mjs                # timing + flow logic assertions
node src/shared/templates/templates.check.mjs # every template compiles
```

### Demo data

Seeds a demo researcher account, a published experiment, and 12 fake participants with 48 trials
so the results page has something to show on first open.

```bash
cd backend
npm run seed        # → demo@codyssey.local / demo1234
```

Override with `SEED_EMAIL` and `SEED_PASSWORD`. The script is idempotent — re-running it will not
duplicate data.

### Running on a phone

`localhost` on a phone means the phone, not your laptop. To put a study in someone's hand:

```bash
cd frontend && npm run dev -- --host        # bind all interfaces
ipconfig getifaddr en0                     # your LAN IP, e.g. 10.0.43.237
```

Then set `CORS_ORIGIN=http://<your-ip>:5173` and `FRONTEND_URL=http://<your-ip>:5173` in
`backend/.env`, restart the API, and share `http://<your-ip>:5173/run/<slug>`.

Copy-to-clipboard buttons degrade to "select the text" on that origin, because
`navigator.clipboard` requires a secure context. For a tunnel-based alternative, see the
[demo runbook](docs/roadmap.md#demo-runbook).

## Architecture

Two applications are built from one Vite project, as separate Rollup inputs:

| Entry | Audience | Payload |
|---|---|---|
| `index.html` | researcher app | React 19, Mantine, React Flow, GSAP, charts — ~480 KB gz |
| `run.html` | participant app | plain JS, hand-rolled DOM helper, no framework — **~35 KB gz** |

The separation is the most important structural decision in the project: a participant never
downloads the researcher's application, and a researcher-side dependency change cannot alter
stimulus timing for a participant mid-study.

A single Zod schema (`frontend/src/shared/experimentSchema.js`) is the contract between builder,
engine, runtime and backend. Change the task model in one file and all four follow.

The participant runtime is deliberately offline during trials. Its screen sequence is
`loading → consent → device check → session start → instructions → preload → trials →
block intro + upload → completion code`, and everything expensive happens before the clock
starts.

Full detail, including the request pipeline, data model and the eight deliberately-taken
shortcuts: [docs/architecture.md](docs/architecture.md).

## Project layout

```
backend/
  api/index.js          bootstrap — connect, then listen
  src/
    app.js              middleware chain, router mounts, global error handler
    db.js               cached connection + boot-time slug-index self-heal
    routes/             auth · run · experiments · stimuli · results · generate · templates
    controllers/        request handlers
    models/             User · Experiment · Session · Trial · Stimulus · Template
    middlewares/        auth · ownership · validate · objectId · rateLimit
    services/           groq.js · normalizeDraft.js · aiCatalog.js
    validators/         experimentSchema.js  (port of the frontend copy)
    utils/              ApiResponse · ApiError · asyncHandler
  test-routes.mjs       84-assertion API contract test
  seed-demo.js          idempotent demo data seeder

frontend/
  index.html            researcher app entry
  run.html              participant app entry
  src/
    engine/             pure JS, no React, no network — the timing engine
    runtime/            the participant app and its screens
    features/
      builder/          React Flow canvas, compile.js, panels, store
      results/          charts, participant table, condition aggregation
      stimuli/          dropzone, library, picker
    pages/              landing · dashboard · builder · results · settings · account
    api/                client.js (JWT, silent refresh, envelope unwrap) + modules
    shared/             experimentSchema.js · templates/ · clipboard.js
    auth/               AuthContext · ProtectedRoute

docs/                   documentation — see docs/README.md
```

## Scripts

| Where | Command | What |
|---|---|---|
| `backend` | `npm run dev` | API with file watching on :3001 |
| `backend` | `npm start` | API, no watching |
| `backend` | `npm test` | 84-assertion API contract test (~3 min, needs the API running) |
| `backend` | `npm run seed` | demo account, experiment and 12 participants |
| `frontend` | `npm run dev` | Vite dev server on :5173 (researcher app + `/run/*` participant app) |
| `frontend` | `npm run build` | builds both bundles: `index.html` and `run.html` |
| `frontend` | `npm run preview` | serve the production build |
| `frontend` | `npm run lint` | oxlint |
| `frontend` | `node src/engine/selfcheck.mjs` | assertions on the pure timing and flow logic |
| `frontend` | `node src/shared/templates/templates.check.mjs` | every template compiles and expands correctly |
| `backend` | `node src/services/normalizeDraft.check.js` | assertions on AI output normalisation |

## Testing

There is no test framework. Verification is a set of hand-rolled assertion scripts, which run
with plain `node` and have no runner, coverage measurement or CI.

```bash
# needs the API running; paces itself under the rate limiter, ~3 min
cd backend && npm test

# pure logic, no API needed
node frontend/src/engine/selfcheck.mjs
node frontend/src/shared/templates/templates.check.mjs
node backend/src/services/normalizeDraft.check.js
```

`npm test` covers the happy path, invalid bodies, cross-user authorisation (403), missing
resources (404), malformed ObjectIds (404 rather than 500), state conflicts (409), closed
experiments (410), refresh-token replay rejection, cross-user isolation, CSV export shape, and
cascade-delete counts. It skips the AI route when `GROQ_API_KEY` is unset.

The frontend has no component or integration tests at all.

## Deployment status

**Localhost only, by decision.** There is no `vercel.json`, no Dockerfile, no CI configuration
and no public URL — the two processes run on one machine.

This is the largest gap between the project and its stated goal, which describes a SaaS platform.
Vercel Blob and Upstash Redis are used as services, but the application itself is not deployed.
The remaining work is tracked as [P0 item 2](docs/roadmap.md#p0--demo-blockers).

## Documentation

| Document | Contents |
|---|---|
| [docs/README.md](docs/README.md) | Documentation index and conventions |
| [docs/architecture.md](docs/architecture.md) | System design, the timing engine, the builder compiler, the AI pipeline, data model, and deliberate shortcuts |
| [docs/privacy.md](docs/privacy.md) | What participant data is collected, anonymisation, consent, withdrawal, security controls, and known gaps |
| [docs/api-reference.md](docs/api-reference.md) | Full HTTP specification — conventions, error codes, data models, every endpoint |
| [docs/api-routes.md](docs/api-routes.md) | One-page route table with an auth-level legend |
| [docs/roadmap.md](docs/roadmap.md) | Build status by phase, prioritised work, demo runbook, and previously-wrong claims |

The experiment format itself is defined by
[`frontend/src/shared/experimentSchema.js`](frontend/src/shared/experimentSchema.js), which is
better read than summarised.

## Stack

**Frontend** — Vite 8 · React 19 (JavaScript) · React Router 7 · Mantine 9 · React Flow
(`@xyflow/react`) · Zustand · Zod 4 · GSAP + Lenis (landing page only)
**Backend** — Node ESM · Express 4 · Mongoose 8 · MongoDB Atlas · Zod 3 · JWT auth ·
Vercel Blob · Upstash Redis · Groq
**Testing** — hand-rolled `assert` scripts, no framework
