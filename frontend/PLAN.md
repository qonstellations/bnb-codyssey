# plan.md — Frontend Plan (Detailed)

A detailed checklist for everything inside `/frontend`. Work top to bottom and tick boxes as you go.

**Stack:** Vite + React (JavaScript) · React Router · Mantine · @mantine/charts · React Flow · Zustand · Zod

**Golden rule:** During a trial, the participant's browser makes **zero network calls**. Load everything first, run offline, upload after.

> ⚠️ **AUTH REMINDER — Clerk is NOT used.**
> Authentication is **your task**. Everywhere this plan shows 🔐, you need to plug in your own auth.
> The rest of the frontend only needs a small auth interface (see Phase 2), so you can build auth
> in parallel without blocking anyone.

---

## Phase 0 — Project Setup

### Create the app
- [ ] `npm create vite@latest frontend` → React → JavaScript
- [ ] `cd frontend && npm install`
- [ ] Delete Vite demo files (`App.css`, logo, counter code)

### Install packages
- [ ] `npm i react-router-dom zustand zod @xyflow/react`
- [ ] `npm i @mantine/core @mantine/hooks @mantine/notifications @mantine/charts @mantine/dropzone @mantine/modals recharts`
- [ ] `npm i -D postcss postcss-preset-mantine postcss-simple-vars`
- [ ] Add `postcss.config.cjs` as per Mantine docs

### Environment
- [ ] Create `.env` with `VITE_API_URL=http://localhost:3000`
- [ ] Add `.env` to `.gitignore`
- [ ] Create `src/shared/config.js` that exports `API_URL = import.meta.env.VITE_API_URL`

### Two entry pages
- [ ] Keep `index.html` → loads `src/main.jsx` (researcher app)
- [ ] Create `run.html` → loads `src/runtime/main.js` (participant app)
- [ ] Update `vite.config.js`:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        run: resolve(__dirname, "run.html"),
      },
    },
  },
});
```

### Vercel config
- [ ] Create `vercel.json` so `/run/*` goes to the participant page and everything else to the researcher app:

```json
{
  "rewrites": [
    { "source": "/run/(.*)", "destination": "/run.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] Deploy to Vercel (root directory = `frontend`), add `VITE_API_URL` in project settings
- [ ] Confirm both `/` and `/run/test` load after a page refresh

---

## Phase 1 — Folder Structure

- [ ] Create this structure (empty files are fine for now):

```
/frontend
├── index.html
├── run.html
├── vite.config.js
├── vercel.json
└── src
    ├── main.jsx
    ├── App.jsx
    ├── /api
    │   ├── client.js
    │   ├── experiments.js
    │   ├── stimuli.js
    │   ├── results.js
    │   └── run.js
    ├── /auth                     🔐 YOU BUILD THIS
    │   ├── AuthContext.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── LoginPage.jsx
    │   └── SignupPage.jsx
    ├── /pages
    │   ├── Landing.jsx
    │   ├── Dashboard.jsx
    │   ├── BuilderPage.jsx
    │   ├── ResultsPage.jsx
    │   ├── SettingsPage.jsx
    │   └── NotFound.jsx
    ├── /features
    │   ├── /builder
    │   │   ├── Canvas.jsx
    │   │   ├── Toolbar.jsx
    │   │   ├── store.js
    │   │   ├── compile.js
    │   │   ├── /nodes
    │   │   └── /panels
    │   ├── /results
    │   └── /stimuli
    ├── /components
    ├── /hooks
    ├── /shared
    │   ├── config.js
    │   ├── constants.js
    │   └── experimentSchema.js
    ├── /engine
    └── /runtime
```

---

## Phase 2 — App Shell, Routing & Auth Hooks

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

### 🔐 Auth — YOUR TASK
Build these however you like (e.g. JWT + bcrypt on the backend). The rest of the frontend only depends on this interface:

```js
// src/auth/AuthContext.jsx must provide:
const { user, token, isLoading, login, signup, logout } = useAuth();
// user    → { id, name, email } or null
// token   → string sent as "Authorization: Bearer <token>", or null
// login(email, password), signup(name, email, password), logout()
```

- [ ] 🔐 `AuthContext.jsx` — holds user + token, exposes `useAuth()`
- [ ] 🔐 Decide where the token lives (memory + httpOnly cookie is safest; localStorage is simplest)
- [ ] 🔐 Restore the logged-in user on page refresh
- [ ] 🔐 `LoginPage.jsx` and `SignupPage.jsx` using Mantine forms
- [ ] 🔐 `ProtectedRoute.jsx` — redirects to `/login` if no user, shows loader while `isLoading`
- [ ] 🔐 Logout button in the navbar
- [ ] 🔐 On any `401` from the API → log out and redirect to `/login`

> 💡 **Until auth is ready:** make `useAuth()` return a fake user and fake token so teammates can keep building.

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
  - [ ] Adds `API_URL` in front of the path
  - [ ] Adds `Content-Type: application/json`
  - [ ] 🔐 Adds `Authorization: Bearer <token>` from your auth
  - [ ] Parses JSON response
  - [ ] Throws a readable error on non-2xx
  - [ ] 🔐 Calls `logout()` on `401`

### Endpoint files

**`api/experiments.js`**
- [ ] `listExperiments()` → `GET /api/experiments`
- [ ] `createExperiment(data)` → `POST /api/experiments`
- [ ] `getExperiment(id)` → `GET /api/experiments/:id`
- [ ] `updateExperiment(id, data)` → `PUT /api/experiments/:id`
- [ ] `deleteExperiment(id)` → `DELETE /api/experiments/:id`
- [ ] `duplicateExperiment(id)` → `POST /api/experiments/:id/duplicate`
- [ ] `publishExperiment(id)` → `POST /api/experiments/:id/publish`
- [ ] `closeExperiment(id)` → `POST /api/experiments/:id/close`

**`api/stimuli.js`**
- [ ] `listStimuli()` → `GET /api/stimuli`
- [ ] `getUploadUrl(file)` → `POST /api/stimuli/upload-url`
- [ ] `saveStimulus(meta)` → `POST /api/stimuli`
- [ ] `deleteStimulus(id)` → `DELETE /api/stimuli/:id`

**`api/results.js`**
- [ ] `getSummary(expId)` → `GET /api/results/:expId/summary`
- [ ] `getSessions(expId)` → `GET /api/results/:expId/sessions`
- [ ] `getSession(expId, sessionId)` → `GET /api/results/:expId/sessions/:sessionId`
- [ ] `setExcluded(expId, sessionId, excluded)` → `PATCH /api/results/:expId/sessions/:sessionId`
- [ ] `exportUrl(expId, format)` → builds `/api/results/:expId/export?format=csv|json`

**`api/run.js`** (participant, no auth, no Mantine — keep it tiny)
- [ ] `loadExperiment(slug)` → `GET /api/run/:slug`
- [ ] `startSession(slug, device)` → `POST /api/run/:slug/sessions`
- [ ] `updateSession(sessionId, data)` → `PATCH /api/run/sessions/:sessionId`
- [ ] `uploadTrials(sessionId, trials)` → `POST /api/run/sessions/:sessionId/trials`
- [ ] `completeSession(sessionId)` → `POST /api/run/sessions/:sessionId/complete`
- [ ] `beacon(sessionId, trials)` → `navigator.sendBeacon(.../beacon, JSON string)`
- [ ] `withdraw(code)` → `DELETE /api/run/withdraw/:code`

### Shared hooks
- [ ] `hooks/useApi.js` — runs a request, returns `{ data, error, loading, reload }`
- [ ] `hooks/usePolling.js` — calls a function every N seconds, stops on unmount

---

## Phase 4 — Experiment JSON Schema

This is the **contract** between the builder, the engine and the backend. Agree on it as a team early.

- [ ] Write `shared/experimentSchema.js` with Zod
- [ ] Share a copy with the backend teammate

**Suggested shape:**

```js
{
  version: 1,
  settings: {
    fullscreen: true,
    backgroundColor: "#808080",
    textColor: "#ffffff",
    fontSize: 48,
    consentText: "...",
    instructions: "...",
  },
  stimuli: [{ id, type: "image" | "audio", url }],
  blocks: [
    {
      id, name,
      randomize: true,
      maxRepeats: 3,
      repetitions: 1,
      trials: [
        {
          id,
          fixationMs: 500,
          stimulus: { type: "text" | "image" | "audio", value, color },
          durationMs: 2000,          // how long stimulus stays on screen (null = until response)
          responseKeys: ["f", "j"],
          correctKey: "f",
          timeoutMs: 3000,
          feedback: true,
          itiMs: 500,                // gap before next trial
          condition: "congruent",    // label used in results
        },
      ],
    },
  ],
  flow: [
    { from: "blockA", to: "blockB" },
    { from: "blockB", to: "blockC", if: { metric: "accuracy", op: "<", value: 0.7 } },
  ],
}
```

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
- [ ] Produce a **timing quality score** 0–100
- [ ] Return device info: screen size, pixel ratio, user agent, touch support

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
- [ ] Only accept keys listed in `responseKeys`
- [ ] `waitForResponse(keys, timeoutMs)` → `{ key, time }` or `null`

### 5.6 Scheduler (`scheduler.js`)
- [ ] Drive everything from one `requestAnimationFrame` loop
- [ ] Convert ms durations to **whole frames** (e.g. 500 ms at 60 Hz = 30 frames)
- [ ] Record the actual onset time of the frame a stimulus appeared on
- [ ] Record intended frames vs. actual frames shown

### 5.7 Randomizer (`randomizer.js`)
- [ ] Fisher–Yates shuffle
- [ ] Max-repeats-in-a-row rule (reshuffle until valid, with a safety limit)
- [ ] Block repetitions
- [ ] Seeded random (so a session's order can be reproduced from its seed)

### 5.8 Flow (`flow.js`)
- [ ] Walk blocks in order, follow `flow` edges
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
- [ ] Each trial record includes: trial index, block, condition, stimulus, key, correct, RT, onset time, intended/actual frames, dropped frames

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
- [ ] `loading.js` — read slug from URL (`/run/:slug`), fetch experiment, validate with Zod
- [ ] `consent.js` — show researcher's consent text, "I agree" button (decline → exit screen)
- [ ] `check.js` — device check + calibration, warn if score is low or screen too small
- [ ] `instructions.js` — instruction text, "Start" button (this click also unlocks audio + fullscreen)
- [ ] Preload stimuli with progress bar
- [ ] Start session → `startSession()`, then `updateSession()` with device + calibration data
- [ ] Run the engine
- [ ] Break screen between blocks (uploads happen here)
- [ ] `complete.js` — thank you, **completion code**, **withdraw code** with a copy button
- [ ] `withdraw.js` — page at `/run/withdraw` where a participant pastes their code to delete data

### Error screens
- [ ] Experiment not found / closed
- [ ] Unsupported browser
- [ ] Network failed to load (with retry)
- [ ] Upload failed at the end (keep retrying, tell participant not to close the tab)

### Privacy
- [ ] Never ask for name or email
- [ ] Scrub free-text answers before upload (remove emails, phone numbers, long digit strings)

---

## Phase 7 — Dashboard (`pages/Dashboard.jsx`)

- [ ] Fetch `listExperiments()`
- [ ] Grid of cards: title, status badge (draft / live / closed), participant count, last edited
- [ ] "New experiment" button → create → go to builder
- [ ] Card menu: Edit, Results, Duplicate, Close, Delete (with confirm modal)
- [ ] "Copy participant link" on live experiments
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
- [ ] `SettingsPanel.jsx` — background colour, text colour, font size, fullscreen, instructions
- [ ] "Bulk add trials" helper (e.g. paste a CSV of words + colours)

### 8.5 Stimuli (`features/stimuli`)
- [ ] `StimulusLibrary.jsx` — grid of uploaded files
- [ ] `UploadDropzone.jsx` — Mantine Dropzone, images + audio only, size limit
- [ ] Upload flow: `getUploadUrl()` → upload file straight to Vercel Blob → `saveStimulus()`
- [ ] `StimulusPicker.jsx` — modal to pick a file inside TrialForm

### 8.6 Compile (`compile.js`)
- [ ] Convert React Flow nodes + edges → experiment JSON
- [ ] Convert experiment JSON → nodes + edges (for loading saved work)
- [ ] Run `validateExperiment()` and highlight nodes with errors

### 8.7 Toolbar (`Toolbar.jsx`)
- [ ] Editable experiment title
- [ ] Undo / Redo
- [ ] Save (disabled when not dirty) + "Saved ✓" indicator
- [ ] Autosave every 30 seconds when dirty
- [ ] Preview → opens `run.html?preview=1` with the current JSON (no data saved)
- [ ] Publish → confirm modal → shows link, copy button, and QR code
- [ ] Warn before leaving the page with unsaved changes

### 8.8 Templates
- [ ] Stroop template
- [ ] Flanker template
- [ ] Simple reaction time template

---

## Phase 9 — Results (`features/results` + `pages/ResultsPage.jsx`)

- [ ] `SummaryCards.jsx` — participants started, completed, completion rate, mean RT, accuracy
- [ ] `RtChart.jsx` — bar chart of mean RT by condition
- [ ] `AccuracyChart.jsx` — accuracy by condition
- [ ] `QualityChart.jsx` — distribution of timing quality scores
- [ ] `ParticipantTable.jsx` — anonymous ID, device, timing score, trials done, status, exclude toggle
- [ ] Filter: hide excluded / low-quality sessions
- [ ] Click a row → drawer with that participant's trial-by-trial data
- [ ] `ExportButton.jsx` — CSV and JSON download
- [ ] Auto-refresh every 5 seconds with `usePolling` (+ "Live" indicator)
- [ ] Empty state: "No participants yet — share your link" with copy button

---

## Phase 10 — Settings Page

- [ ] Experiment title and description
- [ ] Consent text editor
- [ ] Max participants (optional)
- [ ] Status controls: publish / close
- [ ] Danger zone: delete experiment and all data

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
- [ ] Visit a closed experiment link → friendly message

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
- [ ] Demo experiment seeded and ready

---

## Suggested frontend split (2 people)

| Person | Owns |
|---|---|
| Frontend A | Schema, engine, participant runtime (Phases 4–6) |
| Frontend B | Shell, API layer, dashboard, builder, results (Phases 2, 3, 7–10) |
| You | 🔐 Auth (Phase 2 auth tasks + backend auth routes) |

**Remember:** Phase 4 (schema) must be agreed on **before** A and B split up, because the engine and the builder both depend on it.
