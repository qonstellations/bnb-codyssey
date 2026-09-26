# PLAN.md — Web-Based Experiment Platform

A step-by-step checklist. Work top to bottom. Tick each box when done.

**Stack:** Vite + React (JavaScript) · React Router · Mantine · React Flow · Zustand · Zod · Express on Vercel · MongoDB Atlas + Mongoose · JWT Auth · Vercel Blob · Upstash Redis

**Golden rule:** During a trial, the browser makes **zero network calls**. Load everything first, run offline, upload after.

---

## Phase 0 — Setup

### Accounts
- [ ] GitHub repo created, all teammates added
- [ ] Vercel account connected to GitHub
- [ ] MongoDB Atlas free cluster created
- [ ] Atlas **Network Access** set to `0.0.0.0/0`
- [ ] Atlas database user created, connection string saved
- [ ] JWT secret keys (access + refresh) generated and saved
- [ ] Upstash Redis database created, URL + token saved
- [ ] (Stretch) Gemini or Claude API key saved

### Repo skeleton
- [ ] Create `/frontend` with `npm create vite@latest` → React → JavaScript
- [ ] Create `/backend` with `npm init -y`, add `"type": "module"` to `package.json`
- [ ] Add `.gitignore` (node_modules, .env) to both folders
- [ ] Create `.env` in both folders (never commit these)

### Install packages
- [ ] Frontend: `react-router-dom @mantine/core @mantine/hooks @mantine/charts @mantine/notifications @mantine/dropzone @xyflow/react zustand zod`
- [ ] Backend: `express mongoose cors zod jsonwebtoken bcryptjs @vercel/blob @upstash/redis @upstash/ratelimit dotenv`

### Deploy "hello world" early
- [ ] Backend: `api/index.js` exports Express app with a `GET /api/v1/health` route
- [ ] Backend: `vercel.json` routes `/api/(.*)` → `api/index.js`
- [ ] Deploy backend as Vercel project (root directory = `backend`)
- [ ] Deploy frontend as Vercel project (root directory = `frontend`)
- [ ] Frontend `vercel.json` rewrite added so page refresh doesn't 404
- [ ] Env vars added in both Vercel project settings
- [ ] Frontend calls `/api/v1/health` successfully (CORS works)

---

## Phase 1 — Timing Engine (most important)

Build in `/frontend/src/engine`. Pure JavaScript, **no React**.

### Hardcoded test first
- [ ] Write a hardcoded Stroop experiment as a JSON object
- [ ] `run.html` + `runtime/main.js` load and start it

### Engine modules
- [ ] `preloader.js` — load + `img.decode()` all images, decode audio into buffers, show progress bar
- [ ] `renderer.js` — full-screen Canvas, draw text / images / fixation cross
- [ ] `scheduler.js` — `requestAnimationFrame` loop, show/hide stimuli on exact frames
- [ ] `input.js` — capture key/mouse/touch using `event.timeStamp`, ignore key repeats
- [ ] Reaction time = response `timeStamp` − stimulus onset frame time
- [ ] `audio.js` — play sounds via Web Audio API with scheduled start
- [ ] `randomizer.js` — shuffle, counterbalance, max-repeats-in-a-row rule
- [ ] `flow.js` — walk through blocks/trials, handle branches and loops
- [ ] `logger.worker.js` — Web Worker that stores trial data off the main thread
- [ ] `uploader.js` — batch upload between blocks, IndexedDB backup, `sendBeacon` on tab close

### Timing quality
- [ ] `calibration.js` — measure refresh rate + frame jitter before start
- [ ] Compute a timing quality score (e.g. 0–100)
- [ ] Log per trial: intended duration, actual frames shown, dropped frames
- [ ] Fullscreen request + detect when participant leaves the tab

### Check it
- [ ] Stroop runs start to finish with no errors
- [ ] RTs look sensible (roughly 300–1000 ms)
- [ ] Tested on Chrome, Firefox, Safari, and a phone

---

## Phase 2 — Backend + Database

### Core setup
- [ ] `config/db.js` — cached Mongoose connection
- [ ] `app.js` — Express, JSON parser, CORS (frontend URL only), error handler
- [ ] `middleware/requireAuth.js` — verify JWT access token
- [ ] `middleware/ownsExperiment.js` — researcher can only touch their own data
- [ ] `middleware/rateLimit.js` — Upstash limiter on public routes
- [ ] `middleware/validate.js` — Zod body validation

### Models
- [ ] `Experiment` — owner, title, draft JSON, published versions, slug, status
- [ ] `Session` — experimentId, participantId (UUID), device info, calibration score, status, withdrawCode, excluded flag
- [ ] `Trial` — sessionId, trial index, condition, stimulus, response, RT, frame data
- [ ] `Stimulus` — owner, file URL, type, name
- [ ] Indexes on `sessionId`, `experimentId`, `slug`

### Participant routes (public)
- [ ] `GET /api/v1/run/:slug`
- [ ] `POST /api/v1/run/:slug/sessions`
- [ ] `PATCH /api/v1/run/sessions/:sessionId`
- [ ] `POST /api/v1/run/sessions/:sessionId/trials`
- [ ] `POST /api/v1/run/sessions/:sessionId/complete`
- [ ] `POST /api/v1/run/sessions/:sessionId/beacon` (accepts `text/plain`)
- [ ] `DELETE /api/v1/run/withdraw/:withdrawCode`

### Connect engine to backend
- [ ] Runtime fetches experiment by slug instead of hardcoded JSON
- [ ] Trial data saves to MongoDB and shows up in Atlas

---

## Phase 3 — Researcher Auth + Experiments

- [ ] Sign in / sign up pages (custom auth forms)
- [ ] Protected routes for dashboard and builder
- [ ] `api/client.js` attaches JWT access token to every request
- [ ] `POST /api/v1/auth/register`
- [ ] `POST /api/v1/auth/login`
- [ ] `POST /api/v1/auth/refresh`
- [ ] `POST /api/v1/auth/logout`
- [ ] `GET /api/v1/auth/me`
- [ ] `GET /api/v1/experiments`
- [ ] `POST /api/v1/experiments`
- [ ] `GET /api/v1/experiments/:id`
- [ ] `PUT /api/v1/experiments/:id`
- [ ] `DELETE /api/v1/experiments/:id`
- [ ] `POST /api/v1/experiments/:id/duplicate`
- [ ] `POST /api/v1/experiments/:id/publish` (freeze version, random slug)
- [ ] Dashboard page lists experiments with create / open / delete

---

## Phase 4 — Visual Builder

### Schema first
- [ ] `shared/experimentSchema.js` — Zod schema for the experiment JSON
- [ ] Copy the same schema into `backend/src/validators`

### Canvas
- [ ] React Flow canvas with drag-and-drop
- [ ] Node types: Trial, Block, Branch, Loop, End
- [ ] Zustand store for nodes, edges, selection
- [ ] Undo / redo

### Panels
- [ ] Node inspector — edit text, image, duration, valid keys, correct answer
- [ ] Randomization panel — shuffle, repeats, counterbalancing
- [ ] Branch rules — e.g. "if wrong → show feedback"

### Stimuli
- [ ] `POST /api/v1/stimuli/upload-url`, `POST /api/v1/stimuli`, `GET /api/v1/stimuli`, `DELETE /api/v1/stimuli/:id`
- [ ] Upload dropzone (browser uploads straight to Vercel Blob)
- [ ] Stimulus picker inside the node inspector

### Wire it up
- [ ] `compile.js` — convert graph → experiment JSON
- [ ] Validate with Zod before saving, show friendly errors
- [ ] Save button → `PUT /api/experiments/:id`
- [ ] Preview button — run the experiment locally in a new tab
- [ ] Publish button → shows shareable participant link + copy button

---

## Phase 5 — Results Dashboard

- [ ] `GET /api/v1/results/:experimentId/summary`
- [ ] `GET /api/v1/results/:experimentId/sessions`
- [ ] `GET /api/v1/results/:experimentId/sessions/:sessionId`
- [ ] `PATCH /api/v1/results/:experimentId/sessions/:sessionId` (exclude)
- [ ] `GET /api/v1/results/:experimentId/export?format=csv|json`
- [ ] Summary cards — participants, completion rate, mean RT, accuracy
- [ ] RT by condition chart (Mantine charts)
- [ ] Participant table with timing quality score + exclude toggle
- [ ] Auto-refresh every 5 seconds (`usePolling`)
- [ ] CSV / JSON export button

---

## Phase 6 — Privacy + Ethics

- [ ] Consent screen before experiment (text set by researcher)
- [ ] Only random UUIDs stored — no names, emails, or IPs
- [ ] Scrub free-text answers in the browser before upload
- [ ] Withdraw code shown on the completion screen
- [ ] Withdraw route deletes the session + all its trials
- [ ] Every results route checks ownership
- [ ] Secrets only in env vars, never in frontend code

---

## Phase 7 — Stretch Goals (only if time allows)

- [ ] Bot detection score — mouse movement, impossible RTs, tab switching
- [ ] Participant simulator — run fake participants to test branches
- [ ] Template library — ready-made Stroop, Flanker, N-back tasks
- [ ] Auto-generated consent / IRB summary

---

## Phase 8 — Testing + Polish

- [ ] Full flow: sign up → build → publish → take study on phone → see results
- [ ] Close the tab mid-experiment → partial data still saved
- [ ] Slow network test (Chrome DevTools throttling) → timing unaffected
- [ ] Mobile layout works for participant pages
- [ ] Loading and error states everywhere
- [ ] Seed one demo experiment with sample data
- [ ] README: what it does, how to run locally, env vars list

---

## Phase 9 — Demo Prep

- [ ] Final deploy on Vercel, both URLs working
- [ ] Demo script (under 5 minutes):
  1. Problem in one sentence
  2. Build a Stroop task live in the builder
  3. Judge takes it on their phone via link / QR code
  4. Show their timing quality score + results updating live
  5. Show privacy features (anonymous ID, withdraw code)
- [ ] Short pitch slides
- [ ] Backup screen recording in case Wi-Fi fails
- [ ] Each teammate knows which part they explain

---

## Suggested team split (4 people)

| Person | Owns |
|---|---|
| A | Timing engine + participant runtime |
| B | Backend, models, all API routes |
| C | Visual builder + stimuli upload |
| D | Auth, dashboard, results charts, demo prep |
