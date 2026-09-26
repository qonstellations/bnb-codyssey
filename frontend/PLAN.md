# plan.md — Frontend Plan (Detailed)

A detailed checklist for everything inside `/frontend`. Work top to bottom and tick boxes as you go.

**Stack:** Vite + React (JavaScript) · React Router · Mantine · @mantine/charts · React Flow · Zustand · Zod

**Golden rule:** During a trial, the participant's browser makes **zero network calls**. Load everything first, run offline, upload after.

**API base URL:** `VITE_API_URL` + `/api/v1` (e.g. `http://localhost:3000/api/v1`). Every endpoint below is relative to that. Full spec in `../API.md`, route list in `ROUTES.md`.

> ⚠️ **AUTH — real backend routes, not Clerk.**
> The backend exposes its own auth routes (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`) — see Phase 2.
> Everywhere below marked 🔐, wire these in; nothing here depends on a third-party auth provider.

---

## Phase 2 — App Shell, Routing & Auth

### Mantine setup
- [ ] In `main.jsx`: import `@mantine/core/styles.css`, `@mantine/notifications/styles.css`, `@mantine/charts/styles.css`, `@mantine/dropzone/styles.css`
- [ ] Wrap app in `<MantineProvider>`, `<Notifications />`, `<ModalsProvider>`
- [ ] Pick a primary colour and font in the theme

### Routes (`App.jsx`)

| Path | Page | Protected? |
|---|---|---|
| `/` | Landing | No |
| `/login` | LoginPage 🔐 | No |
| `/signup` | SignupPage 🔐 | No |
| `/dashboard` | Dashboard | Yes |
| `/experiments/:id/edit` | BuilderPage | Yes |
| `/experiments/:id/results` | ResultsPage | Yes |
| `/experiments/:id/settings` | SettingsPage | Yes |
| `*` | NotFound | No |

- [ ] Set up all routes with React Router
- [ ] Wrap protected routes in `<ProtectedRoute>`

### 🔐 Auth — real endpoints

```
POST  /auth/register   { name, email, password }  → { user, token }
POST  /auth/login      { email, password }         → { user, token }
POST  /auth/refresh    (uses refresh cookie/token)  → { token }
POST  /auth/logout
GET   /auth/me                                       → { user }
```

The rest of the frontend only depends on this interface:

```js
// src/auth/AuthContext.jsx must provide:
const { user, token, isLoading, login, signup, logout } = useAuth();
// user    → { id, name, email } or null
// token   → string sent as "Authorization: Bearer <token>", or null
// login(email, password), signup(name, email, password), logout()
```

- [ ] 🔐 `AuthContext.jsx` — on mount, call `GET /auth/me` to restore session (holds user + token, exposes `useAuth()`)
- [ ] 🔐 Decide where the token lives (memory + httpOnly refresh cookie is safest; localStorage is simplest)
- [ ] 🔐 `login`/`signup` call `/auth/login` / `/auth/register`, store returned token
- [ ] 🔐 `logout` calls `POST /auth/logout`, clears local state
- [ ] 🔐 `LoginPage.jsx` and `SignupPage.jsx` using Mantine forms
- [ ] 🔐 `ProtectedRoute.jsx` — redirects to `/login` if no user, shows loader while `isLoading`
- [ ] 🔐 Logout button in the navbar
- [ ] 🔐 On any `401` from the API → try `POST /auth/refresh` once, else log out and redirect to `/login`

### Layout
- [ ] `components/AppLayout.jsx` — Mantine `AppShell` with navbar (logo, Dashboard link, user menu)
- [ ] `components/LoadingScreen.jsx`
- [ ] `components/ErrorState.jsx` (message + retry button)
- [ ] `components/EmptyState.jsx`
- [ ] `components/ConfirmModal.jsx` (for deletes)

---

## Phase 3 — API Layer

### Base client (`api/client.js`)
- [ ] One `request(method, path, body)` function that:
  - [ ] Prefixes `API_URL + "/api/v1"` in front of the path
  - [ ] Adds `Content-Type: application/json`
  - [ ] 🔐 Adds `Authorization: Bearer <token>` from your auth
  - [ ] Parses JSON response; on error, reads `error.code`/`error.message` from the envelope and throws a readable error
  - [ ] 🔐 On `401` → attempt refresh once, else `logout()`

### Endpoint files

**`api/auth.js`**
- [ ] `register(name, email, password)` → `POST /auth/register`
- [ ] `login(email, password)` → `POST /auth/login`
- [ ] `refresh()` → `POST /auth/refresh`
- [ ] `logout()` → `POST /auth/logout`
- [ ] `getMe()` → `GET /auth/me`

**`api/experiments.js`**
- [ ] `listExperiments()` → `GET /experiments`
- [ ] `createExperiment(data)` → `POST /experiments`
- [ ] `getExperiment(id)` → `GET /experiments/:id`
- [ ] `updateExperiment(id, data)` → `PUT /experiments/:id` (partial update: `title`, `draft`, `status`; use `{ status: "closed" }` to close — there is no separate close endpoint)
- [ ] `deleteExperiment(id)` → `DELETE /experiments/:id`
- [ ] `duplicateExperiment(id)` → `POST /experiments/:id/duplicate`
- [ ] `publishExperiment(id)` → `POST /experiments/:id/publish` → returns `{ version, slug, participantUrl }`

**`api/stimuli.js`**
- [ ] `listStimuli()` → `GET /stimuli`
- [ ] `getUploadUrl(filename, contentType)` → `POST /stimuli/upload-url` → `{ uploadUrl, token }`
- [ ] `saveStimulus({ name, type, url, size })` → `POST /stimuli`
- [ ] `deleteStimulus(id)` → `DELETE /stimuli/:id`

**`api/results.js`**
- [ ] `getSummary(expId)` → `GET /results/:expId/summary`
- [ ] `getSessions(expId)` → `GET /results/:expId/sessions`
- [ ] `getSession(expId, sessionId)` → `GET /results/:expId/sessions/:sessionId`
- [ ] `setExcluded(expId, sessionId, excluded)` → `PATCH /results/:expId/sessions/:sessionId`
- [ ] `exportUrl(expId, format)` → builds `/results/:expId/export?format=csv|json`

**`api/run.js`** (participant, no auth, no Mantine — keep it tiny)
- [ ] `loadExperiment(slug)` → `GET /run/:slug` (404 if missing, 410 if closed)
- [ ] `startSession(slug, deviceInfo)` → `POST /run/:slug/sessions` → `{ sessionId, withdrawCode }`
- [ ] `updateSession(sessionId, { calibration?, status? })` → `PATCH /run/sessions/:sessionId`
- [ ] `uploadTrials(sessionId, trials)` → `POST /run/sessions/:sessionId/trials` (max 500 per batch)
- [ ] `completeSession(sessionId)` → `POST /run/sessions/:sessionId/complete` → `{ withdrawCode }`
- [ ] `beacon(sessionId, { trials, status })` → `navigator.sendBeacon(.../beacon, JSON string)` (Content-Type `text/plain`)
- [ ] `withdraw(withdrawCode)` → `DELETE /run/withdraw/:withdrawCode`

### Shared hooks
- [ ] `hooks/useApi.js` — runs a request, returns `{ data, error, loading, reload }`
- [ ] `hooks/usePolling.js` — calls a function every N seconds, stops on unmount

---

## Phase 4 — Experiment JSON Schema

This is the **contract** between the builder, the engine and the backend (`draft` field on the Experiment model). Agree on it as a team early — schema must match what `PUT /experiments/:id` and `GET /run/:slug` expect.

- [ ] Write `shared/experimentSchema.js` with Zod, matching the `snapshot`/`draft` shape in `../API.md` (`settings`, `blocks[].trials[]`, `branches`, `loops`)
- [ ] Write `validateExperiment(json)` that returns `{ ok, errors }` with human-readable messages
- [ ] Create `shared/sampleStroop.js` — a full valid example (used for testing everywhere)

---

## Phase 5 — Timing Engine (`src/engine`)

Pure JavaScript. **No React, no Mantine, no network calls during trials.**

### 5.1 Preloader (`preloader.js`)
- [ ] Load every image with `new Image()` then `await img.decode()`
- [ ] Load every audio file with `fetch` → `audioContext.decodeAudioData`
- [ ] Report progress (`onProgress(loaded, total)`)
- [ ] Fail clearly if a file can't load

### 5.2 Calibration (`calibration.js`)
- [ ] Run ~120 frames of `requestAnimationFrame` and record time between frames
- [ ] Calculate refresh rate (Hz), mean frame time, jitter (standard deviation), dropped frames
- [ ] Produce a **timing quality score** 0–100 (maps to `calibration.score` sent via `updateSession`)
- [ ] Return device info matching `deviceInfo` shape: `browser`, `os`, `screenW`, `screenH`, `pixelRatio`

### 5.3 Renderer (`renderer.js`)
- [ ] Create a full-window Canvas, handle `devicePixelRatio` for sharp text
- [ ] `clear()`, `drawText()`, `drawImage()`, `drawFixation()`, `drawFeedback()`
- [ ] Resize handler

### 5.4 Audio (`audio.js`)
- [ ] One shared `AudioContext`, resumed on first click (browsers require a user gesture)
- [ ] `play(buffer, when)` using scheduled start time

### 5.5 Input (`input.js`)
- [ ] Listen to `keydown`, `pointerdown`
- [ ] Use `event.timeStamp` as response time
- [ ] Ignore `event.repeat` (held keys)
- [ ] Only accept keys listed in `validKeys`
- [ ] `waitForResponse(keys, timeoutMs)` → `{ key, time }` or `null`

### 5.6 Scheduler (`scheduler.js`)
- [ ] Drive everything from one `requestAnimationFrame` loop
- [ ] Convert ms durations to **whole frames** (e.g. 500 ms at 60 Hz = 30 frames)
- [ ] Record the actual onset time of the frame a stimulus appeared on
- [ ] Record intended frames vs. actual frames shown (→ `frameData.intended/actual/dropped`)

### 5.7 Randomizer (`randomizer.js`)
- [ ] Fisher–Yates shuffle
- [ ] Max-repeats-in-a-row rule (`maxRepeats`, reshuffle until valid, with a safety limit)
- [ ] Block repetitions
- [ ] Seeded random (so a session's order can be reproduced from its seed)

### 5.8 Flow (`flow.js`)
- [ ] Walk blocks in order, follow `branches`/`loops`
- [ ] Evaluate branch conditions (e.g. accuracy of previous block)
- [ ] Guard against infinite loops

### 5.9 Logger (`logger.worker.js`)
- [ ] Web Worker that receives trial records via `postMessage`
- [ ] Keeps a buffer, hands it back when asked to flush
- [ ] Mirrors data into IndexedDB as backup

### 5.10 Uploader (`uploader.js`)
- [ ] `flush()` between blocks → `uploadTrials()`
- [ ] Retry failed uploads (up to 3 times, with delay)
- [ ] On `visibilitychange` → hidden / `pagehide` → `sendBeacon` remaining data
- [ ] Never upload during a running trial

### 5.11 Main runner (`index.js`)
- [ ] `runExperiment(experimentJson, { onProgress, onFinish })`
- [ ] For each trial: fixation → stimulus → response → feedback → ITI → log
- [ ] Each trial record matches the Trial model: `trialIndex`, `blockId`, `condition`, `stimulus`, `response`, `correct`, `rt`, `frameData`

### 5.12 Extra tracking
- [ ] Count tab switches / window blur events
- [ ] Detect fullscreen exits
- [ ] Record time spent on each screen (consent, instructions)

### ✅ Engine checkpoint
- [ ] Run `sampleStroop.js` start to finish with no errors
- [ ] RTs look sensible (~300–1000 ms)
- [ ] Tested on Chrome, Firefox, Safari, and a phone
- [ ] CPU throttled 4× in DevTools → timing quality score drops (proves calibration works)

---

## Phase 6 — Participant Runtime (`src/runtime`)

Keep this bundle **small**: no React, no Mantine. Plain JS + simple CSS.

### Screens (in order)
- [ ] `loading.js` — read slug from URL (`/run/:slug`), `loadExperiment(slug)`, validate with Zod
- [ ] `consent.js` — show researcher's `settings.consentText`, "I agree" button (decline → exit screen)
- [ ] `check.js` — device check + calibration, warn if score is low or screen too small
- [ ] `instructions.js` — instruction text, "Start" button (this click also unlocks audio + fullscreen)
- [ ] Preload stimuli with progress bar
- [ ] Start session → `startSession()`, then `updateSession()` with calibration data
- [ ] Run the engine
- [ ] Break screen between blocks (uploads happen here)
- [ ] `complete.js` — thank you, **completion message**, **withdraw code** with a copy button (from `completeSession()`)
- [ ] `withdraw.js` — page at `/run/withdraw` where a participant pastes their code to delete data

### Error screens
- [ ] Experiment not found (404) / closed (410)
- [ ] Unsupported browser
- [ ] Network failed to load (with retry)
- [ ] Upload failed at the end (keep retrying, tell participant not to close the tab)

### Privacy
- [ ] Never ask for name or email
- [ ] Scrub free-text answers before upload (remove emails, phone numbers, long digit strings)

---

## Phase 7 — Dashboard (`pages/Dashboard.jsx`)

- [ ] Fetch `listExperiments()`
- [ ] Grid of cards: title, status badge (**draft / active / closed**), last edited
- [ ] "New experiment" button → `createExperiment()` → go to builder
- [ ] Card menu: Edit, Results, Duplicate, Close (`updateExperiment(id, {status:"closed"})`), Delete (with confirm modal)
- [ ] "Copy participant link" on active experiments (`participantUrl` from publish, or build from `slug`)
- [ ] Empty state with "Create your first experiment" and "Start from Stroop template"
- [ ] Loading skeletons + error state

---

## Phase 8 — Visual Builder (`features/builder`)

### 8.1 Store (`store.js`, Zustand)
- [ ] `nodes`, `edges`, `selectedNodeId`, `settings`, `isDirty`
- [ ] Actions: `addNode`, `updateNode`, `removeNode`, `connect`, `select`, `setSettings`
- [ ] Undo / redo history (keep last ~50 states)
- [ ] `loadFromJson(json)` and `reset()`

### 8.2 Canvas (`Canvas.jsx`)
- [ ] React Flow with background grid, zoom controls, minimap
- [ ] Drag node types from a sidebar onto the canvas
- [ ] Connect nodes with edges
- [ ] Click node → opens inspector
- [ ] Delete key removes selected node/edge

### 8.3 Node types (`/nodes`)
- [ ] `StartNode` — fixed, one per experiment
- [ ] `BlockNode` — shows block name + trial count
- [ ] `BranchNode` — shows the condition (e.g. "accuracy < 70%")
- [ ] `LoopNode` — repeat a section N times
- [ ] `EndNode`
- [ ] Clear colours/icons for each type

### 8.4 Panels (`/panels`)
- [ ] `NodeInspector.jsx` — switches form based on selected node type
- [ ] `BlockEditor.jsx` — block name + table of trials (add, edit, duplicate, delete rows)
- [ ] `TrialForm.jsx` — stimulus type/value, fixation, duration, response keys, correct key, timeout, feedback, ITI, condition
- [ ] `RandomizationPanel.jsx` — shuffle on/off, max repeats, repetitions
- [ ] `BranchEditor.jsx` — metric, operator, value
- [ ] `SettingsPanel.jsx` — background colour, text colour, font size, fullscreen, consent text, instructions
- [ ] "Bulk add trials" helper (e.g. paste a CSV of words + colours)

### 8.5 Stimuli (`features/stimuli`)
- [ ] `StimulusLibrary.jsx` — grid of uploaded files
- [ ] `UploadDropzone.jsx` — Mantine Dropzone, images + audio only, size limit
- [ ] Upload flow: `getUploadUrl(filename, contentType)` → upload file straight to Vercel Blob using returned `uploadUrl`/`token` → `saveStimulus({name, type, url, size})`
- [ ] `StimulusPicker.jsx` — modal to pick a file inside TrialForm

### 8.6 Compile (`compile.js`)
- [ ] Convert React Flow nodes + edges → experiment `draft` JSON
- [ ] Convert `draft` JSON → nodes + edges (for loading saved work)
- [ ] Run `validateExperiment()` and highlight nodes with errors

### 8.7 Toolbar (`Toolbar.jsx`)
- [ ] Editable experiment title
- [ ] Undo / Redo
- [ ] Save (disabled when not dirty) → `updateExperiment(id, {title, draft})`, "Saved ✓" indicator
- [ ] Autosave every 30 seconds when dirty
- [ ] Preview → opens `run.html?preview=1` with the current JSON (no data saved)
- [ ] Publish → confirm modal → `publishExperiment(id)` → show `participantUrl`, copy button, and QR code
- [ ] Warn before leaving the page with unsaved changes

### 8.8 Templates
- [ ] Stroop template
- [ ] Flanker template
- [ ] Simple reaction time template

---

## Phase 9 — Results (`features/results` + `pages/ResultsPage.jsx`)

- [ ] `SummaryCards.jsx` — from `getSummary()`: total/completed/abandoned/excluded, completion rate, mean RT, accuracy, mean timing score
- [ ] `RtChart.jsx` — bar chart of mean RT by condition
- [ ] `AccuracyChart.jsx` — accuracy by condition
- [ ] `QualityChart.jsx` — distribution of timing quality scores
- [ ] `ParticipantTable.jsx` — from `getSessions()`: participantId, device, timing score, trial count, status, exclude toggle
- [ ] Filter: hide excluded / low-quality sessions
- [ ] Click a row → drawer with `getSession()` trial-by-trial data
- [ ] `ExportButton.jsx` — links to `exportUrl(expId, "csv"|"json")`
- [ ] Auto-refresh every 5 seconds with `usePolling` (+ "Live" indicator)
- [ ] Empty state: "No participants yet — share your link" with copy button

---

## Phase 10 — Settings Page

- [ ] Experiment title and description
- [ ] Consent text editor
- [ ] Status controls: publish / close (`updateExperiment(id, {status})`)
- [ ] Danger zone: delete experiment and all data (`deleteExperiment`)

---

## Phase 11 — Stretch Goals (only if time allows)

- [ ] **AI builder** — text box "Describe your experiment" → `POST /api/ai/generate-experiment` → validate → load into canvas
- [ ] **Participant simulator** — run 100 fake participants in the browser to check branches and counterbalancing
- [ ] **Bot score column** in the results table
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts in the builder (Ctrl+Z, Ctrl+S, Delete)

---

## Phase 12 — Testing & Polish

### Flows to test end-to-end
- [ ] 🔐 Sign up → log in → refresh page → still logged in → log out
- [ ] Create experiment → build → save → reload → work is still there
- [ ] Publish → open link on phone → complete → results appear on dashboard
- [ ] Close tab mid-experiment → partial data still saved
- [ ] Withdraw with code → data disappears from results
- [ ] Visit a closed experiment link → friendly `410 Gone` message

### Quality checks
- [ ] Slow 3G throttling → trials still accurate (only loading is slower)
- [ ] Participant pages work on mobile (portrait)
- [ ] All pages have loading, empty and error states
- [ ] No API keys or secrets anywhere in frontend code
- [ ] No `console.log` spam in production
- [ ] Participant bundle is small (check `npm run build` output for `run` chunk)

### Final
- [ ] Production build works locally (`npm run build && npm run preview`)
- [ ] Deployed on Vercel, `VITE_API_URL` points to the live backend
- [ ] Confirm both `/` and `/run/test` load after a page refresh (rewrites in `vercel.json`)
- [ ] Demo experiment seeded and ready

---

## Frontend split (2 people)

Phase 4 (schema) must be agreed on **together, first** — the engine and the builder both depend on it.

| Person | Owns |
|---|---|
| Frontend A | Schema (Phase 4), Timing Engine (Phase 5), Participant Runtime (Phase 6), Stretch: participant simulator |
| Frontend B | App Shell + Auth wiring (Phase 2), API Layer (Phase 3), Dashboard (Phase 7), Builder (Phase 8), Results (Phase 9), Settings (Phase 10) |

Both: Phase 12 testing & polish, split by area (A tests engine/runtime flows, B tests dashboard/builder/results flows).
