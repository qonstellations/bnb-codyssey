# API Reference — Full HTTP Specification (as built)

> **Version:** 1.1 · **Base URL:** `http://localhost:3001/api/v1` (local dev — no deployed backend)
> **Content-Type:** `application/json` unless noted otherwise
> **35 routes** · reflects the `integration` branch · deployment is localhost-only, no public URLs

For a scannable overview see [api-routes.md](api-routes.md). For setup see the
[root README](../README.md). For system design see [architecture.md](architecture.md).

---

## Table of Contents

- [Conventions](#conventions)
- [Data Models](#data-models)
- [Health](#1-health)
- [Auth](#2-auth)
- [Participant Runtime](#3-participant-runtime)
- [Experiments](#4-experiments)
- [Stimuli](#5-stimuli)
- [AI Generation](#6-ai-generation)
- [Templates](#7-templates)
- [Results](#8-results)

---

## Conventions

### Authentication

| Symbol | Level | Header |
|---|---|---|
| 🌐 | **Public** — rate-limited via Upstash | None |
| 🔒 | **Auth** — any logged-in researcher | `Authorization: Bearer <access_token>` |
| 👤 | **Owner** — Auth + must own the resource | `Authorization: Bearer <access_token>` |

### Response Envelope

All **success** responses share this envelope, with the route payload nested under `data`:

```json
{
  "statusCode": 200,
  "data": {
    "experiment": { "..." : "..." }
  },
  "message": "Experiment retrieved successfully",
  "success": true
}
```

(The `export?format=json` download is the one exception — it returns the raw array.)

All **error** responses share this shape:

```json
{
  "statusCode": 404,
  "success": false,
  "message": "Experiment not found",
  "errors": [],
  "error": {
    "code": "NOT_FOUND",
    "message": "Experiment not found"
  }
}
```

### Common Error Codes

| HTTP Status | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Request body fails Zod validation |
| `401` | `UNAUTHORIZED` | Missing/invalid access or refresh token |
| `403` | `FORBIDDEN` | Authenticated but don't own the resource |
| `404` | `NOT_FOUND` | Resource doesn't exist (incl. malformed ObjectId params) |
| `409` | `CONFLICT` | Action conflicts with current state (e.g. publishing a closed experiment) |
| `410` | `GONE` | Experiment is closed |
| `429` | `RATE_LIMITED` | Too many requests (Upstash sliding window, or Groq's own TPM limit) |
| `502` | `GENERATION_FAILED` | AI provider (Groq) failed |
| `503` | `AI_NOT_CONFIGURED` | `GROQ_API_KEY` is not set on the server |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

### Rate Limiting

Sliding window of **10 requests / 10 seconds per IP** (Upstash) on every public route plus
`register` / `login` / `refresh` and AI generation. Keyed on the first entry of
`x-forwarded-for`. Silently skipped when `UPSTASH_REDIS_REST_URL` is unset (local dev).

### Shared Backend Utilities

`src/utils/` — `ApiResponse` (envelope above), `ApiError` (status + code + field errors),
`asyncHandler` (async route → error middleware). Every route throws `ApiError` instead of
hand-rolling `res.status().json()`.

### ID Formats

- MongoDB `_id` fields → 24-char hex strings (malformed → `404`, never `500`)
- `participantId` → UUID v4 (generated server-side)
- `withdrawCode` → 8-char base62 alphanumeric (generated server-side)
- `slug` → 8-char base62 alphanumeric (generated on publish)

### Pagination

No pagination for v1. List endpoints return all records.

---

## Data Models

### User

```js
{
  _id:          ObjectId,          // auto
  name:         String,            // 1–100 chars
  email:        String,            // unique, lowercase, trimmed
  password:     String,            // bcrypt hash (never returned in responses)
  passwordHash: String,            // legacy alias, same value
  refreshToken: String | null,     // SHA-256 hash of the live refresh token
  createdAt:    Date,              // auto (Mongoose timestamps)
  updatedAt:    Date               // auto (Mongoose timestamps)
}
```

**Indexes:** `{ email: 1 }` (unique)
**Helpers:** `isPasswordCorrect()`, `generateAccessToken()` (15 min), `generateRefreshToken()` (7 d), `toSafeJSON()`.

---

### Experiment

```js
{
  _id:        ObjectId,          // auto
  owner:      ObjectId,          // ref → User
  title:      String,            // default: "Untitled Experiment"
  draft:      Object,            // full experiment JSON (nodes, edges, settings)
  versions: [                    // frozen published snapshots
    {
      version:     Number,       // 1, 2, 3…
      snapshot:    Object,       // deep copy of draft at publish time
      publishedAt: Date
    }
  ],
  slug:       String | null,     // random slug, set on first publish
  status:     String,            // enum: "draft" | "active" | "closed"
  createdAt:  Date,              // auto (Mongoose timestamps)
  updatedAt:  Date               // auto (Mongoose timestamps)
}
```

**Indexes:** `{ owner: 1 }`, `{ slug: 1 }` (unique + **partial** — drafts with no slug are
exempt, so unlimited drafts can coexist; publish retries 3× on collision)

---

### Session

```js
{
  _id:            ObjectId,      // auto
  experimentId:   ObjectId,      // ref → Experiment
  participantId:  String,        // UUID v4
  deviceInfo: {
    browser:      String,        // e.g. "Chrome 126"
    os:           String,        // e.g. "macOS 15.0"
    screenW:      Number,        // pixels
    screenH:      Number,        // pixels
    pixelRatio:   Number         // e.g. 2
  },
  calibration: {
    refreshRate:  Number,        // Hz, e.g. 60
    jitter:       Number,        // ms, e.g. 1.2
    score:        Number         // 0–100
  },
  status:         String,        // enum: "in_progress" | "completed" | "abandoned"
  excluded:       Boolean,       // default: false
  withdrawCode:   String,        // 8-char alphanumeric, participant-facing
  tokenHash:      String,        // sha256 of the write token; select:false, never serialised
  version:        Number,        // published version this participant ran
  seed:           Number,        // trial-order PRNG seed — replays the exact shuffle
  engagement: {
    tabSwitches:    Number,      // times the tab was hidden mid-run
    blurCount:      Number,      // window blur events mid-run
    fullscreenExits:Number       // fullscreen exits mid-run
  },
  startedAt:      Date,          // set on creation
  completedAt:    Date | null    // set on complete
}
```

**Indexes:** `{ experimentId: 1 }`, `{ withdrawCode: 1 }` (unique)

`engagement` is submitted with the completion call and is a data-quality signal: a participant
who alt-tabbed through the task has contaminated reaction times, and the researcher needs to be
able to see that. It is behavioural data, so it belongs in the consent text.

---

### Trial

```js
{
  _id:          ObjectId,        // auto
  sessionId:    ObjectId,        // ref → Session
  trialIndex:   Number,          // 0-based
  blockId:      String,          // which block this trial belongs to
  condition:    String,          // e.g. "congruent", "incongruent"
  stimulus: {
    type:       String,          // "text" | "image" | "audio"
    content:    String | null,   // text content if type is "text"
    url:        String | null    // asset URL if type is "image" or "audio"
  },
  response:     String | null,   // key pressed or option clicked
  correct:      Boolean | null,  // null if no correct answer defined
  rt:           Number | null,   // reaction time in ms (float)
  frameData: {
    intended:   Number,          // intended frames to display
    actual:     Number,          // actual frames displayed
    dropped:    Number           // frames dropped
  },
  createdAt:    Date             // auto
}
```

**Indexes:** `{ sessionId: 1 }`

---

### Stimulus

```js
{
  _id:        ObjectId,          // auto
  owner:      ObjectId,          // ref → User
  name:       String,            // user-facing label, e.g. "red_circle.png"
  type:       String,            // enum: "image" | "audio" | "video"
  url:        String,            // Vercel Blob URL
  size:       Number,            // bytes
  createdAt:  Date               // auto
}
```

**Indexes:** `{ owner: 1 }`

---

### Template

A researcher's own reusable experiment design — a full `draft` snapshot, decoupled from any
published experiment so it can be reused and stays editable after publication.

```js
{
  _id:         ObjectId,   // auto
  owner:       ObjectId,   // ref → User
  title:       String,     // required, ≤ 200 chars
  description: String,     // default "", ≤ 500 chars
  draft:       Mixed,      // required — a full experimentSchema object
  createdAt:   Date,       // auto (timestamps)
  updatedAt:   Date        // auto
}
```

**Indexes:** `{ owner: 1, updatedAt: -1 }`

`minimize: false` — without it Mongoose strips empty `description` and `loops: []` on save, and
the two schema shapes stop round-tripping identically.

---

---

## 1. Health

### `GET /api/v1/health` 🌐

Check that the server is alive.

**Request:** none

**Response: `200 OK`**

```json
{
  "status": "ok",
  "timestamp": "2026-09-26T04:54:00.000Z"
}
```

---

---

## 2. Auth

Register, login, token refresh, logout, and profile routes. Uses JWT access + refresh token pairs.

- **Access token:** short-lived (15 min), sent as `Authorization: Bearer <token>`
- **Refresh token:** long-lived (7 days), sent in request body to `/auth/refresh`

---

### `POST /api/v1/auth/register` 🌐

Create a new researcher account.

**Request body:**

```json
{
  "name": "Jane Researcher",
  "email": "jane@university.edu",
  "password": "s3cur3Pa$$word"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | `string` | yes | 1–100 chars, trimmed |
| `email` | `string` | yes | valid email, max 255 chars, lowercased |
| `password` | `string` | yes | 8–128 chars |

**Response: `201 Created`**

```json
{
  "user": {
    "_id": "665f1a2b3c4d5e6f7a8b9c00",
    "name": "Jane Researcher",
    "email": "jane@university.edu",
    "createdAt": "2026-09-26T10:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing/invalid fields |
| `409` | `CONFLICT` | Email already registered |
| `429` | `RATE_LIMITED` | Too many requests |

---

### `POST /api/v1/auth/login` 🌐

Log in with email and password.

**Request body:**

```json
{
  "email": "jane@university.edu",
  "password": "s3cur3Pa$$word"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | `string` | yes | valid email |
| `password` | `string` | yes | |

**Response: `200 OK`**

```json
{
  "user": {
    "_id": "665f1a2b3c4d5e6f7a8b9c00",
    "name": "Jane Researcher",
    "email": "jane@university.edu",
    "createdAt": "2026-09-26T10:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing fields |
| `401` | `UNAUTHORIZED` | Wrong email or password |
| `429` | `RATE_LIMITED` | Too many requests |

---

### `POST /api/v1/auth/refresh` 🌐

Exchange a valid refresh token for a new access + refresh token pair. The old refresh token is invalidated (rotation).

**Request body:**

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `refreshToken` | `string` | yes | |

**Response: `200 OK`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "bmV3IHJlZnJlc2ggdG9r..."
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing refresh token |
| `401` | `UNAUTHORIZED` | Refresh token doesn't match the stored hash |
| `401` | `UNAUTHORIZED` | Invalid or expired refresh token |
| `429` | `RATE_LIMITED` | Too many requests |

---

### `POST /api/v1/auth/logout` 🔒

Invalidate the refresh token so it can't be used again.

**Request body:**

```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `refreshToken` | `string` | yes | |

**Response: `200 OK`**

```json
{
  "ok": true
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing refresh token |
| `401` | `UNAUTHORIZED` | Refresh token doesn't match the stored hash |

---

### `GET /api/v1/auth/me` 🔒

Get the currently authenticated user's profile.

**Request:** none

**Response: `200 OK`**

```json
{
  "user": {
    "_id": "665f1a2b3c4d5e6f7a8b9c00",
    "name": "Jane Researcher",
    "email": "jane@university.edu",
    "createdAt": "2026-09-26T10:00:00.000Z"
  }
}
```

---

### `DELETE /api/v1/auth/me` 🔒

Permanently delete the account (GDPR erasure): every owned experiment with its sessions and trials, saved templates, uploaded stimuli (DB records + blobs), then the user.

**Request body:** `{ "password": "..." }` — re-confirms the owner.

**Response: `200 OK`** `{ "deleted": true }` · **Errors:** `403 FORBIDDEN` wrong password, `401` not logged in.

---

## 3. Participant Runtime

Public routes used by the timing engine. All rate-limited (10 req / 10 s / IP).
All `:sessionId` params are ObjectId-validated — a malformed id returns `404`, not `500`.

**Session token:** every write to an existing session (`PATCH`, `/trials`, `/complete`, `/beacon`) must include `"token"` in the JSON body — the value returned by `POST /:slug/sessions`. Wrong or missing token → `403 FORBIDDEN` (the beacon silently returns `204`). `/complete` also accepts optional `"engagement": { "tabSwitches", "blurCount", "fullscreenExits" }`. `/trials` is idempotent: a re-sent `trialIndex` for the same session is skipped, not duplicated.

---

### `GET /api/v1/run/:slug` 🌐

Fetch the published experiment JSON so the engine can preload and run offline.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `slug` | `string` | 8-char experiment slug from the participant link |

**Request:** none

**Response: `200 OK`**

```json
{
  "experiment": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "title": "Stroop Task",
    "version": 1,
    "snapshot": {
      "settings": {
        "consentText": "You are participating in a study...",
        "fullscreen": true,
        "showProgressBar": true
      },
      "blocks": [
        {
          "id": "block_practice",
          "label": "Practice",
          "shuffle": true,
          "maxRepeats": 2,
          "trials": [
            {
              "id": "trial_1",
              "stimulus": { "type": "text", "content": "RED", "url": null },
              "duration": 2000,
              "fixationDuration": 500,
              "validKeys": ["f", "j"],
              "correctKey": "f",
              "condition": "congruent",
              "feedback": { "correct": "Correct!", "incorrect": "Try again" }
            }
          ]
        }
      ],
      "branches": [],
      "loops": []
    }
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Slug doesn't exist |
| `429` | `RATE_LIMITED` | Too many requests |
| `410` | `GONE` | Experiment is closed (status = `"closed"`) |

---

### `POST /api/v1/run/:slug/sessions` 🌐

Start a new participant session.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `slug` | `string` | Experiment slug |

**Request body:**

```json
{
  "deviceInfo": {
    "browser": "Chrome 126",
    "os": "macOS 15.0",
    "screenW": 1920,
    "screenH": 1080,
    "pixelRatio": 2
  }
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `deviceInfo.browser` | `string` | yes | max 100 chars |
| `deviceInfo.os` | `string` | yes | max 100 chars |
| `deviceInfo.screenW` | `number` | yes | integer, > 0 |
| `deviceInfo.screenH` | `number` | yes | integer, > 0 |
| `deviceInfo.pixelRatio` | `number` | yes | > 0 |

**Response: `201 Created`**

```json
{
  "sessionId": "665f1a2b3c4d5e6f7a8b9c0e",
  "withdrawCode": "a8Kp3mNx",
  "token": "3f9c…(48 hex chars)",
  "seed": 1739201847
}
```

`token` is returned only here (the server stores its sha256). `seed` drives the runtime's trial shuffle and is stored on the session, so the order is reproducible. The session also records the published `version` it ran.

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing/invalid `deviceInfo` |
| `404` | `NOT_FOUND` | Slug doesn't exist |
| `410` | `GONE` | Experiment is closed |
| `429` | `RATE_LIMITED` | Too many requests |

---

### `PATCH /api/v1/run/sessions/:sessionId` 🌐

Update session metadata (calibration results, status change). Only allowed while session is `in_progress`.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `sessionId` | `string` | MongoDB ObjectId |

**Request body** (all fields optional, at least one required):

```json
{
  "calibration": {
    "refreshRate": 60,
    "jitter": 1.2,
    "score": 94
  },
  "status": "abandoned"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `calibration.refreshRate` | `number` | no | > 0 |
| `calibration.jitter` | `number` | no | >= 0 |
| `calibration.score` | `number` | no | 0–100 |
| `status` | `string` | no | only `"abandoned"` allowed here |

**Response: `200 OK`**

```json
{
  "ok": true
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid body or no fields provided |
| `429` | `RATE_LIMITED` | Too many requests |
| `404` | `NOT_FOUND` | Session not found |
| `409` | `CONFLICT` | Session is already completed or abandoned |

---

### `POST /api/v1/run/sessions/:sessionId/trials` 🌐

Upload a batch of trial data. Called between blocks by the engine.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `sessionId` | `string` | MongoDB ObjectId |

**Request body:**

```json
{
  "trials": [
    {
      "trialIndex": 0,
      "blockId": "block_practice",
      "condition": "congruent",
      "stimulus": { "type": "text", "content": "RED", "url": null },
      "response": "f",
      "correct": true,
      "rt": 487.3,
      "frameData": { "intended": 120, "actual": 120, "dropped": 0 }
    },
    {
      "trialIndex": 1,
      "blockId": "block_practice",
      "condition": "incongruent",
      "stimulus": { "type": "text", "content": "BLUE", "url": null },
      "response": "j",
      "correct": false,
      "rt": 623.1,
      "frameData": { "intended": 120, "actual": 119, "dropped": 1 }
    }
  ]
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `trials` | `array` | yes | min 1 item, max 500 |
| `trials[].trialIndex` | `number` | yes | integer, >= 0 |
| `trials[].blockId` | `string` | yes | max 100 chars |
| `trials[].condition` | `string` | yes | max 100 chars |
| `trials[].stimulus` | `object` | yes | `{ type, content?, url? }` |
| `trials[].stimulus.type` | `string` | yes | `"text"` \| `"image"` \| `"audio"` |
| `trials[].stimulus.content` | `string \| null` | no | max 1000 chars |
| `trials[].stimulus.url` | `string \| null` | no | valid URL |
| `trials[].response` | `string \| null` | no | max 50 chars |
| `trials[].correct` | `boolean \| null` | no | |
| `trials[].rt` | `number \| null` | no | >= 0 |
| `trials[].frameData.intended` | `number` | yes | integer, >= 0 |
| `trials[].frameData.actual` | `number` | yes | integer, >= 0 |
| `trials[].frameData.dropped` | `number` | yes | integer, >= 0 |

**Response: `201 Created`**

```json
{
  "inserted": 2
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid trial data |
| `429` | `RATE_LIMITED` | Too many requests |
| `404` | `NOT_FOUND` | Session not found |
| `409` | `CONFLICT` | Session is not `in_progress` (completed or abandoned) |

---

### `POST /api/v1/run/sessions/:sessionId/complete` 🌐

Mark a session as finished. Sets `completedAt` and returns the withdraw code for display.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `sessionId` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "withdrawCode": "a8Kp3mNx"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Session not found |
| `409` | `CONFLICT` | Session is not `in_progress` (completed or abandoned) |

---

### `POST /api/v1/run/sessions/:sessionId/beacon` 🌐

Last-chance data save via `navigator.sendBeacon()` on tab close. Accepts `text/plain` because `sendBeacon` can't set JSON headers reliably.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `sessionId` | `string` | MongoDB ObjectId |

**Headers:**

```
Content-Type: text/plain
```

**Request body:** JSON-encoded string (parsed server-side)

```
{"trials":[{"trialIndex":2,"blockId":"block_main","condition":"incongruent","stimulus":{"type":"text","content":"GREEN","url":null},"response":"f","correct":false,"rt":812.5,"frameData":{"intended":120,"actual":118,"dropped":2}}],"status":"abandoned"}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `trials` | `array` | no | Same shape as batch upload |
| `status` | `string` | no | If present, set to `"abandoned"` |

**Response: `204 No Content`**

No response body.

**Errors:**

Best-effort — server swallows errors silently and returns `204` regardless. Data loss is acceptable here since the main upload path already saved most trials.

---

### `DELETE /api/v1/run/withdraw/:withdrawCode` 🌐

Participant withdraws their data. Deletes the session and all its trials permanently.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `withdrawCode` | `string` | 8-char code shown on completion screen |

**Request:** none

**Response: `200 OK`**

```json
{
  "deleted": {
    "sessions": 1,
    "trials": 47
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Invalid withdraw code (no matching session) |
| `429` | `RATE_LIMITED` | Too many requests |

---

---

## 4. Experiments

Researcher routes for managing experiments. All require auth.

---

### `GET /api/v1/experiments` 🔒

List all experiments owned by the authenticated researcher. Sorted by `updatedAt` descending.

**Request:** none

**Response: `200 OK`**

```json
{
  "experiments": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "title": "Stroop Task",
      "status": "active",
      "slug": "a8Kp3mNx",
      "createdAt": "2026-09-20T10:00:00.000Z",
      "updatedAt": "2026-09-25T14:30:00.000Z"
    },
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c10",
      "title": "Flanker Task",
      "status": "draft",
      "slug": null,
      "createdAt": "2026-09-22T08:00:00.000Z",
      "updatedAt": "2026-09-22T08:00:00.000Z"
    }
  ]
}
```

> **Note:** `draft` and `versions` are excluded from the list to keep payloads small.

---

### `POST /api/v1/experiments` 🔒

Create a new experiment with an empty draft.

**Request body** (optional):

```json
{
  "title": "My New Experiment"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | `string` | no | max 200 chars, defaults to `"Untitled Experiment"` |

**Response: `201 Created`**

```json
{
  "experiment": {
    "_id": "665f1a2b3c4d5e6f7a8b9c11",
    "owner": "user_2abc123",
    "title": "My New Experiment",
    "draft": {},
    "versions": [],
    "slug": null,
    "status": "draft",
    "createdAt": "2026-09-26T10:00:00.000Z",
    "updatedAt": "2026-09-26T10:00:00.000Z"
  }
}
```

---

### `GET /api/v1/experiments/:id` 👤

Get the full experiment including the draft and all published versions.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "experiment": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "owner": "user_2abc123",
    "title": "Stroop Task",
    "draft": {
      "settings": { "consentText": "...", "fullscreen": true },
      "blocks": [],
      "branches": [],
      "loops": []
    },
    "versions": [
      {
        "version": 1,
        "snapshot": { "..." : "..." },
        "publishedAt": "2026-09-25T14:00:00.000Z"
      }
    ],
    "slug": "a8Kp3mNx",
    "status": "active",
    "createdAt": "2026-09-20T10:00:00.000Z",
    "updatedAt": "2026-09-25T14:30:00.000Z"
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `PUT /api/v1/experiments/:id` 👤

Update the experiment title, draft, or status. Partial update — only the fields you send get changed.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId |

**Request body** (at least one field required):

```json
{
  "title": "Stroop Task v2",
  "draft": {
    "settings": { "consentText": "Updated consent...", "fullscreen": true },
    "blocks": [],
    "branches": [],
    "loops": []
  },
  "status": "closed"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | `string` | no | max 200 chars |
| `draft` | `object` | no | validated by experiment Zod schema |
| `status` | `string` | no | `"draft"` \| `"active"` \| `"closed"` |

> **Closing an experiment:** Send `{ "status": "closed" }` to stop accepting new participants. The `GET /run/:slug` route will return `410 Gone` for closed experiments.

**Response: `200 OK`**

```json
{
  "experiment": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "owner": "user_2abc123",
    "title": "Stroop Task v2",
    "draft": { "..." : "..." },
    "versions": [],
    "slug": null,
    "status": "closed",
    "createdAt": "2026-09-20T10:00:00.000Z",
    "updatedAt": "2026-09-26T10:05:00.000Z"
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid body |
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `DELETE /api/v1/experiments/:id` 👤

Permanently delete an experiment and **all** its associated sessions and trials.
Stimuli are owner-level and reusable, so they are **not** deleted.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "deleted": {
    "experiment": true,
    "sessions": 12,
    "trials": 576
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `POST /api/v1/experiments/:id/duplicate` 👤

Create a copy of an experiment. Copies the current `draft`, resets status to `"draft"`, and clears `slug` and `versions`.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId of the experiment to copy |

**Request:** none

**Response: `201 Created`**

```json
{
  "experiment": {
    "_id": "665f1a2b3c4d5e6f7a8b9c15",
    "owner": "user_2abc123",
    "title": "Stroop Task (Copy)",
    "draft": { "..." : "..." },
    "versions": [],
    "slug": null,
    "status": "draft",
    "createdAt": "2026-09-26T10:10:00.000Z",
    "updatedAt": "2026-09-26T10:10:00.000Z"
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Source experiment not found |
| `403` | `FORBIDDEN` | Don't own the source experiment |

---

### `POST /api/v1/experiments/:id/publish` 👤

Freeze the current draft as a new published version. Generates a slug on first publish and sets status to `"active"`.
`participantUrl` is built from `FRONTEND_URL` — set it to `http://<laptop-LAN-IP>:5173` on demo day
so the link opens on a judge's phone.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "version": 2,
  "slug": "a8Kp3mNx",
  "participantUrl": "http://localhost:5173/run/a8Kp3mNx"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |
| `409` | `CONFLICT` | Experiment is closed |

> Draft validation happens **client-side** (`compile.js` + the shared Zod schema) before save,
> so there is no server-side `400` on publish.

---

---

## 5. Stimuli

File management for experiment assets. Upload goes directly from the browser to Vercel Blob — these routes
handle the token handoff and metadata records. Blob is the only remaining external service (storage,
not deployment); it needs `BLOB_READ_WRITE_TOKEN` in `backend/.env` and fails closed without it.

---

### `POST /api/v1/stimuli/upload-url` 🔒

Get a pre-signed Vercel Blob upload URL. The frontend uses this to upload the file directly to Blob storage (no file hits the Express server).

**Request body:**

```json
{
  "filename": "red_circle.png",
  "contentType": "image/png"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `filename` | `string` | yes | 1–255 chars, trimmed |
| `contentType` | `string` | yes | must start with `image/`, `audio/`, or `video/` |

**Response: `200 OK`** (envelope `data` holds the client token the
`@vercel/blob/client` `upload()` flow needs — pass this route as its `handleUploadUrl`)

```json
{
  "type": "blob.generate-client-token",
  "clientToken": "vercel_blob_client_..."
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid filename or unsupported content type |

---

### `POST /api/v1/stimuli` 🔒

Save a stimulus metadata record after the file has been uploaded to Vercel Blob.

**Request body:**

```json
{
  "name": "Red Circle",
  "type": "image",
  "url": "https://abc123.public.blob.vercel-storage.com/red_circle-xyz.png",
  "size": 24576
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | `string` | yes | 1–200 chars, trimmed |
| `type` | `string` | yes | `"image"` \| `"audio"` \| `"video"` |
| `url` | `string` | yes | valid URL, must be a `blob.vercel-storage.com` URL |
| `size` | `number` | yes | integer, 1 byte – 50 MB |

**Response: `201 Created`**

```json
{
  "stimulus": {
    "_id": "665f1a2b3c4d5e6f7a8b9c20",
    "owner": "user_2abc123",
    "name": "Red Circle",
    "type": "image",
    "url": "https://abc123.public.blob.vercel-storage.com/red_circle-xyz.png",
    "size": 24576,
    "createdAt": "2026-09-26T10:00:00.000Z"
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Invalid body |

---

### `GET /api/v1/stimuli` 🔒

List all stimuli owned by the authenticated researcher. Sorted by `createdAt` descending.

**Request:** none

**Response: `200 OK`**

```json
{
  "stimuli": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c20",
      "name": "Red Circle",
      "type": "image",
      "url": "https://abc123.public.blob.vercel-storage.com/red_circle-xyz.png",
      "size": 24576,
      "createdAt": "2026-09-26T10:00:00.000Z"
    }
  ]
}
```

---

### `DELETE /api/v1/stimuli/:id` 🔒

Delete a stimulus record and its file from Vercel Blob. Owner-only (server checks `owner` matches authed user).

**Path params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "deleted": true
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Stimulus not found |
| `403` | `FORBIDDEN` | Don't own this stimulus |

---

---

## 6. AI Generation

Turns a plain-English description into an experiment built **only from the 6 coded template
tasks** (`frontend/src/shared/templates`). The model (`openai/gpt-oss-120b`, set at the top of
`src/services/groq.js`) never writes trials: it returns a *recipe* that picks library blocks,
orders them, and sets repetitions, branches and loops. The backend checks the recipe against
`services/aiCatalog.js` and runs up to two **repair** rounds when it fails. The client expands it
with `composeFromTemplates`, so every trial is copied verbatim from the library. The Groq API
key stays server-side. Owner-authenticated and rate-limited.

---

### `POST /api/v1/generate` 🔒

**Request body:**

```json
{
  "prompt": "A Stroop task, then Go / No-Go. Repeat practice if accuracy is below 80%."
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `prompt` | `string` | yes | 10–2000 chars |

**Response: `200 OK`**

```json
{
  "statusCode": 200,
  "data": {
    "kind": "draft",
    "title": "Stroop + Go/No-Go",
    "notes": ["Kept each task's practice with feedback."],
    "recipe": {
      "blocks": [
        { "id": "stroop_practice", "template": "stroop", "block": "practice", "repetitions": 1 },
        { "id": "stroop_main", "template": "stroop", "block": "main", "repetitions": 1 },
        { "id": "gng_main", "template": "go-nogo", "block": "main", "repetitions": 1 }
      ],
      "branches": [{ "from": "stroop_practice", "to": "stroop_practice", "metric": "accuracy", "operator": "<", "value": 0.8 }],
      "loops": []
    },
    "valid": true,
    "errors": []
  },
  "message": "Draft generated",
  "success": true
}
```

| Field | Type | Description |
|---|---|---|
| `kind` | `"draft"` | Discriminator |
| `recipe` | `object \| null` | Library blocks + branches + loops; `null` when `valid` is `false` |
| `title`, `notes` | `string`, `string[]` | Suggested title; notes on choices and anything the library can't do |
| `valid` | `boolean` | Whether the recipe only references existing templates/blocks |
| `errors` | `string[]` | Recipe problems when `valid` is `false` (message `"Draft generated with validation issues"`) |

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Prompt missing or < 10 chars |
| `401` | `UNAUTHORIZED` | Missing/invalid access token |
| `429` | `RATE_LIMITED` | Too many requests — also returned (with a "the AI is busy" message) when Groq itself rate-limits us |
| `502` | `GENERATION_FAILED` | Groq call failed |
| `503` | `AI_NOT_CONFIGURED` | `GROQ_API_KEY` is not set on the server |

> Responses are cached in-process for 60 min (max 100 entries). Only **valid** recipes are
> cached, so "Try again" after a bad generation genuinely re-runs the model. The cache is
> per-process — see [roadmap.md](roadmap.md#p2--engineering-debt-worth-fixing) if you run more
> than one instance.
> `src/api/ai.js` is wired to this route.

---

## 7. Templates

Saved experiment drafts, reusable across experiments. All owner-scoped: another researcher's
template id returns `404`, never `403`, so ids aren't probeable. Capped at **50 per
researcher**. The `draft` on create is validated against the same `experimentSchema` the
builder and the AI pipeline use, so a stored template is always loadable.

---

### `GET /api/v1/templates` 🔒

Lists the caller's templates, newest first. Metadata only — no `draft`, to keep the list light.

```json
{
  "statusCode": 200,
  "data": {
    "templates": [
      {
        "_id": "66f1a2b3c4d5e6f7a8b9c0d1",
        "title": "Stroop R/G/B/Y",
        "description": "Incongruent ink colour task",
        "createdAt": "2026-09-20T10:12:00.000Z",
        "updatedAt": "2026-09-24T18:03:11.000Z"
      }
    ]
  },
  "message": "Templates retrieved successfully",
  "success": true
}
```

**Errors:** `401` `UNAUTHORIZED`

---

### `GET /api/v1/templates/:id` 🔒

Returns one template **including its `draft`**, ready to drop onto the builder canvas.

**Response: `200 OK`** — `{ statusCode, data: { template }, message, success }` where `template`
is the full document (`_id`, `owner`, `title`, `description`, `draft`, `createdAt`, `updatedAt`).

**Errors:**

| Status | Code | When |
|---|---|---|
| `401` | `UNAUTHORIZED` | Missing/invalid access token |
| `404` | `NOT_FOUND` | No such template for this researcher (incl. malformed ObjectId) |

---

### `POST /api/v1/templates` 🔒

**Request body:**

```json
{
  "title": "Stroop R/G/B/Y",
  "description": "Incongruent ink colour task",
  "draft": { "settings": {}, "blocks": [], "branches": [], "loops": [] }
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | `string` | yes | trimmed, 1–200 chars |
| `description` | `string` | no | ≤ 500 chars, defaults to `""` |
| `draft` | `object` | yes | Full `experimentSchema` — blocks, trials, branches, loops and cross-field rules all enforced |

**Response: `201 Created`** — `{ statusCode, data: { template }, message: "Template saved", success: true }`

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing title, or the draft fails `experimentSchema` (per-issue messages in `errors[]`) |
| `401` | `UNAUTHORIZED` | Missing/invalid access token |
| `409` | `CONFLICT` | Already at the 50-template limit |

---

### `DELETE /api/v1/templates/:id` 🔒

**Response: `200 OK`** — `{ statusCode, data: { deleted: true }, message, success }`

**Errors:**

| Status | Code | When |
|---|---|---|
| `401` | `UNAUTHORIZED` | Missing/invalid access token |
| `404` | `NOT_FOUND` | No such template for this researcher |

---

---

## 8. Results

Read-only data analysis routes plus an exclude toggle. All owner-only.

---

### `GET /api/v1/results/:experimentId/summary` 👤

Aggregated stats for the experiment, computed on the fly. Stats cover non-excluded, **completed**
sessions only; everything else still counts toward `totalSessions`/`abandoned`.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "summary": {
    "totalSessions": 48,
    "completed": 42,
    "abandoned": 6,
    "excluded": 3,
    "completionRate": 0.875,
    "meanRt": 534.2,
    "accuracy": 0.82,
    "meanTimingScore": 91.4
  }
}
```

| Field | Type | Description |
|---|---|---|
| `totalSessions` | `number` | All sessions, regardless of status |
| `completed` | `number` | Sessions with status `"completed"` |
| `abandoned` | `number` | Sessions with status `"abandoned"` |
| `excluded` | `number` | Sessions with `excluded: true` |
| `completionRate` | `number` | `completed / totalSessions` (0–1) |
| `meanRt` | `number` | Mean RT in ms across non-excluded, completed sessions |
| `accuracy` | `number` | Proportion of correct responses (0–1), excluding null `correct` |
| `meanTimingScore` | `number` | Mean calibration score across completed sessions |

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `GET /api/v1/results/:experimentId/sessions` 👤

List all sessions for an experiment with overview data (no trial-level detail).

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "sessions": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "participantId": "550e8400-e29b-41d4-a716-446655440000",
      "deviceInfo": {
        "browser": "Chrome 126",
        "os": "macOS 15.0",
        "screenW": 1920,
        "screenH": 1080,
        "pixelRatio": 2
      },
      "calibration": {
        "refreshRate": 60,
        "jitter": 1.2,
        "score": 94
      },
      "status": "completed",
      "excluded": false,
      "trialCount": 47,
      "startedAt": "2026-09-25T14:30:00.000Z",
      "completedAt": "2026-09-25T14:42:00.000Z"
    }
  ]
}
```

> **Note:** `trialCount` is included as a computed field (count of trials for this session) to avoid needing a separate query.

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `GET /api/v1/results/:experimentId/sessions/:sessionId` 👤

Get a single session with its full trial-level data.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |
| `sessionId` | `string` | MongoDB ObjectId |

**Request:** none

**Response: `200 OK`**

```json
{
  "session": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0e",
    "participantId": "550e8400-e29b-41d4-a716-446655440000",
    "deviceInfo": { "..." : "..." },
    "calibration": { "refreshRate": 60, "jitter": 1.2, "score": 94 },
    "status": "completed",
    "excluded": false,
    "startedAt": "2026-09-25T14:30:00.000Z",
    "completedAt": "2026-09-25T14:42:00.000Z"
  },
  "trials": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c30",
      "trialIndex": 0,
      "blockId": "block_practice",
      "condition": "congruent",
      "stimulus": { "type": "text", "content": "RED", "url": null },
      "response": "f",
      "correct": true,
      "rt": 487.3,
      "frameData": { "intended": 120, "actual": 120, "dropped": 0 },
      "createdAt": "2026-09-25T14:31:00.000Z"
    }
  ]
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `404` | `NOT_FOUND` | Experiment or session not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `PATCH /api/v1/results/:experimentId/sessions/:sessionId` 👤

Toggle the exclude flag on a session. Excluded sessions are omitted from summary stats.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |
| `sessionId` | `string` | MongoDB ObjectId |

**Request body:**

```json
{
  "excluded": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `excluded` | `boolean` | yes | |

**Response: `200 OK`**

```json
{
  "session": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0e",
    "excluded": true
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing `excluded` or not a boolean |
| `404` | `NOT_FOUND` | Experiment or session not found |
| `403` | `FORBIDDEN` | Don't own this experiment |

---

### `GET /api/v1/results/:experimentId/export?format=csv|json&kind=trials|sessions&scope=all|clean` 👤

Download session/trial data as a file, in one of two shapes.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |

**Query params:**

| Param | Type | Required | Validation |
|---|---|---|---|
| `format` | `string` | yes | `"csv"` or `"json"` |
| `kind` | `string` | no | `"trials"` (default) or `"sessions"` |
| `scope` | `string` | no | `"all"` (default) or `"clean"` (completed, non-excluded sessions only) |

**Request:** none

**Response: `200 OK`**

Headers:
```
Content-Type: text/csv; charset=utf-8  (or application/json)
Content-Disposition: attachment; filename="stroop-task_trials_2026-09-26.csv"
```

> CSV values starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` so spreadsheet
> apps can't execute them as formulas. The CSV body is prefixed with a UTF-8 BOM so Excel reads
> non-ASCII stimulus text correctly.

**`kind=trials`** (default) — one row per trial, session fields denormalized:

```
sessionId,participantId,status,excluded,browser,os,screenW,screenH,pixelRatio,refreshRate,jitter,timingScore,version,seed,tabSwitches,blurCount,fullscreenExits,startedAt,completedAt,trialIndex,blockId,condition,stimulusType,stimulusContent,stimulusUrl,response,correct,rt,framesIntended,framesActual,framesDropped
```

```json
[
  {
    "sessionId": "665f1a2b3c4d5e6f7a8b9c0e",
    "participantId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "excluded": false,
    "browser": "Chrome 126",
    "os": "macOS 15.0",
    "screenW": 1920,
    "screenH": 1080,
    "pixelRatio": 2,
    "refreshRate": 60,
    "jitter": 1.2,
    "timingScore": 94,
    "version": 3,
    "seed": 482913,
    "tabSwitches": 0,
    "blurCount": 0,
    "fullscreenExits": 0,
    "startedAt": "2026-09-25T14:30:00.000Z",
    "completedAt": "2026-09-25T14:42:00.000Z",
    "trialIndex": 0,
    "blockId": "block_practice",
    "condition": "congruent",
    "stimulusType": "text",
    "stimulusContent": "RED",
    "stimulusUrl": null,
    "response": "f",
    "correct": true,
    "rt": 487.3,
    "framesIntended": 120,
    "framesActual": 120,
    "framesDropped": 0
  }
]
```

**`kind=sessions`** — one row per session *and per block* (plus one `blockId: "all"` row per
session), with accuracy/RT already aggregated:

```
sessionId,participantId,status,excluded,blockId,trials,scoredTrials,accuracy,meanRt,medianRt,timingScore,startedAt,completedAt,durationSec
```

```json
[
  {
    "sessionId": "665f1a2b3c4d5e6f7a8b9c0e",
    "participantId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "excluded": false,
    "blockId": "all",
    "trials": 12,
    "scoredTrials": 10,
    "accuracy": 0.9,
    "meanRt": 512.4,
    "medianRt": 498,
    "timingScore": 94,
    "startedAt": "2026-09-25T14:30:00.000Z",
    "completedAt": "2026-09-25T14:42:00.000Z",
    "durationSec": 720
  }
]
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing/invalid `format`, `kind` or `scope` query param |
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |
