# Architecture

How Codyssey is put together, and why. For setup instructions see the [root README](../README.md);
for the HTTP surface see the [API reference](api-reference.md).

## Table of contents

- [The shape of the problem](#the-shape-of-the-problem)
- [Two applications, one dev server](#two-applications-one-dev-server)
- [The shared schema is the spine](#the-shared-schema-is-the-spine)
- [The timing engine](#the-timing-engine)
  - [Calibration before the first trial](#calibration-before-the-first-trial)
  - [Frame counting, not milliseconds](#frame-counting-not-milliseconds)
  - [Measuring reaction time](#measuring-reaction-time)
  - [Dropped frames are recorded, not hidden](#dropped-frames-are-recorded-not-hidden)
  - [Zero network calls during a trial](#zero-network-calls-during-a-trial)
- [Trial flow control](#trial-flow-control)
- [The builder compiles a graph into a draft](#the-builder-compiles-a-graph-into-a-draft)
- [AI experiment generation](#ai-experiment-generation)
- [Data model](#data-model)
- [Request pipeline](#request-pipeline)
- [Bundle sizes](#bundle-sizes)
- [Deliberate shortcuts](#deliberate-shortcuts)

---

## The shape of the problem

A reaction-time experiment is a latency-sensitive program that has to survive an unpredictable
machine. Three things follow from that, and they drive most of the design:

1. **Timing claims must be measured, not asserted.** A participant's browser is not the
   machine you tested on. So the platform measures the display before the study starts, and
   stores that measurement with the data.
2. **Anything slow must happen before the clock starts.** Network calls, asset decoding and
   permission prompts all happen up front. During a trial the only thing running is a
   `requestAnimationFrame` loop.
3. **A slow frame must not silently corrupt the data.** If the browser drops frames mid-trial,
   the trial is flagged rather than quietly recorded as if it ran to spec.

## Two applications, one dev server

The repository builds **two separate bundles from one Vite project**, declared as two Rollup
inputs in `frontend/vite.config.js`:

| Entry | HTML | Audience | Includes |
|---|---|---|---|
| `index.html` | researcher app | the study designer | React 19, Mantine, React Flow, GSAP, charts |
| `run.html` | participant app | the study participant | plain JS, hand-rolled DOM helper, CSS |

The participant app (`frontend/src/runtime/`) deliberately imports **no React, no Mantine, no
charting library, no animation library**. It has its own 47-line DOM builder (`runtime/dom.js`)
and its own stylesheet. Nothing in `engine/` imports anything from the rest of the app.

This is the single most important structural decision in the project. A participant loading a
32 KB gzipped bundle instead of 478 KB means faster trial starts on a cold phone connection,
and it removes an entire class of failure — a researcher-side dependency change can never
alter stimulus timing for a participant mid-study.

Because `run.html` is a separate entry, `/run/<slug>` and `/dashboard` are different
applications served from the same origin. A small dev-only Vite plugin (`runRewrite()` in
`vite.config.js`) serves `run.html` for `/run/*` paths, because the SPA fallback would
otherwise serve `index.html`, whose router has no `/run` route.

```
frontend/src/
  engine/       pure JS, no React, no network
                renderer · scheduler · input · audio · calibration ·
                randomizer · flow · score · preloader ·
                logger.worker · uploader
  runtime/      the participant app (run.html)
                screens/ loading consent check instructions break complete withdraw error
  features/     builder/ (React Flow canvas, compile.js, panels) · results/ · stimuli/
  pages/        landing · dashboard · builder · results · settings · account
  api/          client.js (JWT + silent refresh + envelope unwrap) + per-domain modules
  shared/       experimentSchema.js · templates/ · clipboard.js
  auth/         AuthContext + protected route

backend/src/
  routes/       auth · run · experiments · stimuli · results · generate · templates
  models/       User · Experiment · Session · Trial · Stimulus · Template
  middlewares/  auth · ownership · validate · objectId · rateLimit
  utils/        ApiResponse · ApiError · asyncHandler
  validators/   experimentSchema.js  (port of the frontend copy)
  services/     groq.js · normalizeDraft.js · aiCatalog.js
```

## The shared schema is the spine

One Zod schema, `frontend/src/shared/experimentSchema.js`, defines the experiment contract. It
is enforced in four places:

| Where | Why |
|---|---|
| Builder (`compile.js`) | before a draft can be saved, with errors attributed back to the offending canvas node |
| Runtime (`runtime/screens/loading.js`) | after download, so a participant never executes a malformed experiment |
| Backend (`validators/experimentSchema.js`) | on AI generation and on template save |
| `normalizeDraft.js` | the AI repair loop's error source |

The backend carries a **hand-ported copy** rather than a shared package, because the two halves
deploy and install separately. The port is mechanical, but it is duplicated code and the two
files do carry different Zod majors (frontend on Zod 4, backend on Zod 3) — see
[Deliberate shortcuts](#deliberate-shortcuts).

The schema's cross-field rules are enforced in a `superRefine`, not just per-field: unique
block ids, branches and loops that point at blocks which exist, and a `correctKey` that is
actually one of the trial's `validKeys`.

## The timing engine

Pure JavaScript in `frontend/src/engine/`. No framework, no network access, no globals beyond
`performance` and the canvas.

### Calibration before the first trial

`calibration.js` samples ~120 `requestAnimationFrame` deltas and derives:

- `refreshRate` — `round(1000 / meanFrameTime)`, i.e. the display's *actual* rate, which may be
  60, 120 or 144 Hz and is not necessarily what the OS reports
- `jitter` — standard deviation of the frame deltas, in milliseconds
- `droppedFrames` — deltas exceeding 1.5× the expected frame time
- `score` — a 0–100 heuristic:
  ```js
  score = max(0, 100 − min(jitter × 10, 60) − min(dropRate × 100, 40))
  ```
  Jitter can cost at most 60 points, dropped frames at most 40, so a device that is smooth but
  drops frames is penalised differently from one that is jittery.

The **measured** refresh rate is then fed into the scheduler for the whole run
(`runtime/main.js` passes `calibration.refreshRate` to `runExperiment`). On a 120 Hz phone the
same 2000 ms trial is 240 frames rather than 120, so the stimulus is displayed for the intended
wall-clock duration instead of being cut in half.

The score is stored on the session, charted as a histogram on the results page, filterable, and
exported to CSV. A study can therefore exclude participants whose timing quality was too poor
to trust — which is a research-integrity feature, not just a diagnostic.

Below a score of 50, or on a viewport under 800 px, the participant sees a warning. It is a
warning rather than a hard block: a warning they can accept is recoverable data, a refusal is
not.

### Frame counting, not milliseconds

`scheduler.js` converts every duration to a whole number of frames and counts callbacks:

```js
msToFrames(ms) { return Math.round(ms / this.frameMs) }   // frameMs = 1000 / refreshRate
```

So a 2000 ms trial at 60 Hz is exactly 120 frames. The stimulus phase is driven purely by rAF;
`setTimeout` appears only where wall-clock waiting is genuinely wanted (the response ceiling,
the 600 ms feedback display, and the inter-trial interval).

This is **frame-count accuracy rather than millisecond accuracy**, and the distinction is
honest: under load, nominal durations stretch, because a frame that never arrives cannot be
recovered. What the design guarantees is that the number of *presented* frames matches the
number of *intended* frames exactly, and that any shortfall is recorded.

### Measuring reaction time

```js
rt = responseEvent.timeStamp − stimulusOnsetTimeStamp
```

Both values come from the browser's own high-resolution clock. `onsetTime` is the timestamp of
the **first rAF callback of the stimulus phase** (`scheduler.js`), not the moment the code asked
for it — that distinction is worth several milliseconds and is where naive implementations
quietly go wrong.

Response listeners are attached after fixation and before onset, so a keypress during the
fixation cross cannot produce a negative RT. `event.repeat` is ignored, so a held key does not
register twice. Only keys listed in the trial's `validKeys` are accepted.

One browser-specific trap is handled explicitly (`input.js`): Safari before 14 reports
`event.timeStamp` as **epoch milliseconds** while rAF and `performance.now()` are
navigation-relative. Subtracting them yields reaction times around 1.7 × 10¹² ms. Timestamps
above 10¹² are normalised against `performance.timeOrigin` before use.

### Dropped frames are recorded, not hidden

`scheduler.js` watches the gap between consecutive callbacks. A gap larger than 1.5 frame times
means the browser skipped refreshes, and the scheduler adds `round(gap / frameMs) − 1` to a
`dropped` counter. Every trial returns:

```js
{ onsetTime, intended, actual: max(0, intended − dropped), dropped }
```

which is persisted as `frameData` and exported as `framesIntended` / `framesActual` /
`framesDropped`. Nothing corrects RTs for dropped frames — the honest move is to expose the
drop and let the researcher decide whether to exclude the trial.

### Zero network calls during a trial

The invariant the whole runtime is arranged around. The sequence is:

1. `loading` — fetch and validate the published experiment (one request)
2. `consent` — record agreement
3. `check` — calibrate the display
4. `startSession` → `PATCH` calibration to the server (two requests)
5. `instructions` — this click also unlocks the `AudioContext` and requests fullscreen
6. `preload` — decode every image with `img.decode()` and every sound with `decodeAudioData`,
   behind a progress bar
7. **trials** — rAF loop only, no network
8. `break` screens **between** blocks, where a batch upload is flushed
9. `complete` — final flush and the withdrawal code

Trials are buffered in a Web Worker (`logger.worker.js`) with an IndexedDB mirror, so a tab
crash loses at most the current batch. `uploader.js` flushes between blocks with three retries,
and attaches a `sendBeacon` handler to `visibilitychange` and `pagehide` for the last-chance
save.

A feature gate on the `loading` screen rejects browsers missing `AudioContext`, rAF,
`indexedDB` or `Worker` before the participant invests any effort.

## Trial flow control

`flow.js` is a generator, not a scheduler. It walks blocks in order, and two mechanisms alter
the path:

- **loops** — `{ blockId, repetitions }` repeats that block in place
- **branches** — `{ from, to, condition }` jumps elsewhere (including backwards, or to itself)
  when a live metric satisfies the condition

Conditions are a fixed grammar: a `metric` (`accuracy`, `meanRt`, `completionRate`), an
`operator` (`< <= > >= == !=`), and a numeric `value`. Metrics are read per-block from the
records just collected. A `maxSteps` guard of 500 stops a branch that re-triggers on its own
target from hanging the participant.

This is a deliberate grammar rather than a scripting language. It covers adaptive and
instruction-repetition designs, which is what most behavioural paradigms actually need, and it
stays inspectable — a researcher can read the branching logic without evaluating arbitrary code.
The AI generator is candid in its output `notes` when a requested paradigm cannot be expressed
this way and it has approximated instead.

## The builder compiles a graph into a draft

The canvas is React Flow. Nodes are `Start`, `Block`, `Branch`, `Loop` and `End`, wired by
edges, with real drag-from-palette plus a click-to-append shortcut for first-time users.

`compile.js` is a bidirectional compiler, and it is the part worth reading:

- **graph → draft.** Walks the chain from `start`, follows block/end edges, and derives
  `branches` and `loops` from how the decoration nodes are wired.
- **error attribution.** When Zod validation fails, the compiler reverse-maps each issue path
  back to a node id, so the canvas can select and highlight the node that caused the error
  rather than showing a form-level message.
- **orphans warn instead of vanishing.** A block not wired into the chain produces a warning,
  not silent data loss.

`friendlyError()` then rewrites roughly nine Zod messages into sentences a researcher can act
on — *"'Practice' has no trials yet. Click it and add a trial."*

Trials inside a block are edited in a modal form and a table, with a bulk CSV paste path
(`content,condition,correctKey` per line) because pasting a 40-item Stroop word list is the
real productivity route. Trials are not individual objects on the canvas; the graph describes
*structure*, the form describes *stimuli*.

## AI experiment generation

`POST /api/v1/generate` (`services/groq.js`) is the most involved backend component. It exists
because a free-text description of a paradigm is much easier for a researcher than assembling 40
trials by hand.

The pipeline makes up to three model calls:

1. **Clarify.** Given a short capability list, the model returns `{"kind":"ready"}` or up to five
   clarifying questions with suggested options. The prompt is explicitly conservative — *ask
   only when something essential is genuinely ambiguous* — because a clarifying question the
   researcher did not expect is worse than a sensible default.
2. **Design.** The model emits a compact document: blocks carry shared `defaults` plus a
   `trialTypes` array of `{ …, count }` entries rather than N expanded trials.
   `normalizeDraft.js` expands those to exact counts, preserving order when `shuffle: false`.
   This is a direct response to Groq's free-tier token-per-minute ceiling.
3. **Repair.** `check()` runs the Zod schema *and* a semantic pass that the schema cannot
   express — unrecognised key names, non-text stimuli, `withhold` combined with a non-null
   `correctKey`. On failure the errors go back to the model with the shape and the last JSON
   only, not the full component catalog, to stay inside the token budget. At most two rounds.

`aiCatalog.js` is the whitelist: every component the runtime supports, plus twelve worked
paradigm recipes (simple RT, choice RT, Stroop, Flanker, Go/No-Go, Likert, lexical decision,
N-back, task switching, visual search, IAT, practice pattern). It also lists paradigms it
*cannot* express, so the model approximates and says so in `notes` instead of inventing
unsupported JSON.

After generation, `normalizeDraft.js` does deterministic repair that needs no model: it fills
missing ids, clamps every numeric into range, drops branches with dangling references or a
duplicate `from`, forces a default `consentText` when blank, and maps key aliases (`"Space"`,
`"F"`, `"Left"`) onto exactly what `event.key.toLowerCase()` produces at runtime.

Results are cached in-process for 60 minutes, max 100 entries. Only **valid** drafts are cached,
so "Try again" after a bad generation genuinely re-runs the model.

## Data model

Six collections. Full field lists are in the [API reference](api-reference.md#data-models).

```
User        researcher account, bcrypt password, hashed rotating refresh token
Experiment  owner, title, status, slug (partial unique), draft (Mixed), versions[]
Session     experimentId, participantId (UUID v4), deviceInfo, calibration,
            status, excluded, withdrawCode
Trial       sessionId, trialIndex, blockId, condition, stimulus, response, correct, rt, frameData
Stimulus    owner, name, type, url (Vercel Blob), size
Template    owner, title, description, draft
```

`Experiment.versions[]` is an append-only publish history: each `publish` freezes the current
draft as `{ version, snapshot, publishedAt }`. Participants always fetch the **latest published
snapshot**, never the working draft, so editing a live study cannot change what an
already-started participant sees.

Two index decisions worth knowing:

- `slug` is a **partial** unique index (`partialFilterExpression: { slug: { $type: 'string' } }`).
  Without the partial filter, a plain unique index rejects the second experiment ever created,
  because every unpublished draft stores `slug: null`. `db.js` inspects
  `experiments.indexes()` on boot, drops a non-partial `slug_1` if it finds one, and re-syncs —
  so a fresh cluster heals itself instead of rejecting writes.
- `withdrawCode` is uniquely indexed, and `startSession` retries generation up to three times on
  a collision rather than returning a 500.

## Request pipeline

Every mutating researcher route runs the same chain:

```
requireAuth      verify the JWT, attach req.userId
ownsExperiment   load the experiment, 404 if missing, 403 if not yours
validate(Zod)    parse and replace req.body, 400 with per-issue messages
requireObjectId  malformed :id → 404, never 500
asyncHandler     forward rejections to the single global error handler
```

Success is always `{ statusCode, data, message, success }`. Errors are always
`{ statusCode, success, message, errors, error: { code, message } }` from one handler in
`app.js`. The frontend unwraps `.data` exactly once, in `api/client.js`, so no feature module
knows the envelope exists.

Ownership checks return **403** for another researcher's experiment but **404** for a malformed
id — the id is not probeable. The templates routes deliberately return 404 in both cases, since
template ids carry no meaning outside their owner's account.

## Bundle sizes

Measured from `npm run build` on the current tree:

| Asset | Raw | Gzip |
|---|---|---|
| `run-*.js` — participant runtime + engine | 15.8 kB | **6.3 kB** |
| `run-*.css` | 0.9 kB | 0.5 kB |
| `experimentSchema-*.js` — shared validation | 89.1 kB | 25.8 kB |
| **Participant total** | **~106 kB** | **~32 kB** |
| `main-*.js` — researcher app | 1,550 kB | 478 kB |
| `main-*.css` | 280 kB | 42 kB |

The participant payload is the number that matters: ~32 KB gzipped, of which the majority is the
Zod schema used to re-validate the downloaded experiment. The researcher bundle is not
code-split — fine on localhost, and the obvious place to spend time if this were deployed.

## Deliberate shortcuts

The codebase uses a `// ponytail:` comment to mark a known shortcut with its upgrade path
inline. There are eight, and each names a real fix rather than apologising for the code:

| Location | Shortcut | Real fix |
|---|---|---|
| `services/groq.js:60` | generation cache is an in-process `Map`, so instances diverge | move to the Upstash Redis already wired for rate limiting |
| `services/normalizeDraft.js:33` | clamps numeric fields into range rather than rejecting | fine as-is; the schema bounds are the backstop |
| `controllers/experiments.controller.js:7` | slugs are 8 chars of `randomBytes` | already retries three times on the unique-index collision |
| `controllers/run.controller.js:32` | withdraw codes likewise | — |
| `models/Experiment.js:22` | partial `slug` index, needed because drafts store `slug: null` | — |
| `runtime/main.js:123` | "last block" is an array-position check, not flow-aware, so a branch that ends on an earlier-indexed block shows one extra break screen | flow-aware detection |
| `features/results/useConditionAggregates.js:4` | per-condition stats are rolled up client-side, capped at 50 sessions | a server-side aggregation endpoint |
| `engine/selfcheck.mjs:1` | assertion scripts, not a test framework | Vitest |

Two further known limits are documented where they live rather than with this marker: the
unused seeded PRNG in `engine/randomizer.js` (the seed is never stored on a session, so trial
order is not reproducible after the fact) and the boot-time slug-index self-heal in `db.js`.

The [roadmap](roadmap.md) tracks the rest.
