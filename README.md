# bnb-codyssey — browser-based experiment platform

Build a reaction-time / cognitive study in a visual builder, publish it to a link, and watch
results land live — with millisecond-accurate timing in the participant's browser.

**The hard part we're solving:** most web survey tools (Google Forms, Qualtrics, jsPsych on a
shared server) can't promise timing accuracy or run fully offline. Ours measures the display's
real refresh rate before the study starts, scores the device's timing quality 0–100, drives every
stimulus from a single `requestAnimationFrame` loop, and makes **zero network calls during a
trial** — data uploads between blocks and on tab close.

---

## Running locally

Two processes, no deployment, no Docker.

```bash
# terminal 1 — API on :3001
cd backend
npm ci
cp .env.example .env      # then fill it in (table below)
npm run dev

# terminal 2 — web app on :5173
cd frontend
npm ci
cp .env.example .env      # VITE_API_URL=http://localhost:3001
npm run dev
```

Open <http://localhost:5173>. Sanity check the API with
`curl http://localhost:3001/api/v1/health`.

```bash
cd backend
npm test                  # route-by-route contract test (~3 min, needs the API running)
npm run seed              # demo experiment + 12 fake participants, ready for the results page
```

### Environment

`backend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `ACCESS_TOKEN_SECRET` | yes | signs 15-minute access tokens |
| `REFRESH_TOKEN_SECRET` | yes | signs 7-day refresh tokens |
| `CORS_ORIGIN` | yes | allowed frontend origin, e.g. `http://localhost:5173` |
| `FRONTEND_URL` | yes | used to build the participant link on publish |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | rate limiting (10 req/10 s per IP); skipped when unset |
| `BLOB_READ_WRITE_TOKEN` | stimuli only | Vercel Blob upload token |
| `GROQ_API_KEY` | AI only | AI experiment generation |

`frontend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | yes | API base, e.g. `http://localhost:3001` |

### Trying it on your phone

`localhost` on a phone means the phone. To put the study in someone's hand:

```bash
cd frontend && npm run dev -- --host          # bind all interfaces
ipconfig getifaddr en0                       # your LAN IP, e.g. 10.0.43.237
```

Set `CORS_ORIGIN=http://<your-ip>:5173` and `FRONTEND_URL=http://<your-ip>:5173` in
`backend/.env`, restart the API, and share `http://<your-ip>:5173/run/<slug>`.
Copy-to-clipboard buttons degrade to "select the text" on that origin, because
`navigator.clipboard` needs HTTPS.

---

## How it fits together

```
frontend/src/
  engine/      pure JS, no React, no network — renderer, scheduler, input, audio,
               calibration, randomizer, flow, logger worker, uploader
  runtime/     the participant app (run.html): consent → device check → instructions
               → preload → trials → completion code. Plain JS + CSS, no Mantine.
  features/    builder (React Flow canvas, compile.js), results charts, stimuli
  pages/       landing, dashboard, builder, results, settings, account
  api/         one client (JWT + silent refresh + envelope unwrap) + endpoint modules
  shared/      experimentSchema.js — the contract between builder, engine and backend

backend/src/
  routes/      auth, run (participant), experiments, stimuli, results, generate (AI)
  models/      User, Experiment, Session, Trial, Stimulus
  middleware   requireAuth, ownsExperiment, validate (Zod), rateLimit, requireObjectId
  utils/       ApiResponse envelope, ApiError, asyncHandler
  validators/  experimentSchema.js — the same contract, server-side
  services/    groq.js — AI draft generation
```

`shared/experimentSchema.js` is the spine: the builder validates against it, the engine executes
it, the runtime re-validates what it downloads, and the AI route rejects generations that don't
satisfy it. Change the task model in one file and all four follow.

### API

34 routes under `/api/v1` — see [API.md](API.md) for the full spec and [ROUTES.md](ROUTES.md)
for the one-page table. All success responses share an `{ statusCode, data, message, success }`
envelope; the frontend unwraps `data` once, in `api/client.js`.

## Scripts

| Where | Command | What |
|---|---|---|
| backend | `npm run dev` | API with file watching on :3001 |
| backend | `npm test` | contract test over the API surface (except AI, which needs a key) |
| backend | `npm run seed` | demo experiment + sample participants |
| frontend | `npm run dev` | Vite dev server on :5173 (researcher app + `/run/*` participant app) |
| frontend | `npm run build` | both bundles: `index.html` and `run.html` |
| frontend | `npm run lint` | oxlint |
| engine | `node src/engine/selfcheck.mjs` | assert-based check of the pure logic (randomizer, flow) |
