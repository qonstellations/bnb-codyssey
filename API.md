# API.md — Full API Specification (as built)

> **Version:** 1.1 · **Base URL:** `http://localhost:3001/api/v1` (local dev — no deployed backend)
> **Content-Type:** `application/json` unless noted otherwise
> **30 routes** · reflects the `integration` branch · deployment is localhost-only, no public URLs

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
- [Results](#7-results)

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
| `429` | `RATE_LIMITED` | Too many requests |
| `429` | `RATE_LIMITED` | Too many requests (Upstash) |
| `502` | `GENERATION_FAILED` | AI provider (Groq) failed |
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
  withdrawCode:   String,        // 8-char alphanumeric
  startedAt:      Date,          // set on creation
  completedAt:    Date | null    // set on complete
}
```

**Indexes:** `{ experimentId: 1 }`, `{ withdrawCode: 1 }` (unique)

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

---

## 3. Participant Runtime

Public routes used by the timing engine. All rate-limited (10 req / 10 s / IP).
All `:sessionId` params are ObjectId-validated — a malformed id returns `404`, not `500`.

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
  "withdrawCode": "a8Kp3mNx"
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing/invalid `deviceInfo` |
| `404` | `NOT_FOUND` | Slug doesn't exist |
| `429` | `RATE_LIMITED` | Too many requests |
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

Turns a plain-English description into a schema-validated experiment draft. The Groq API key
stays server-side; the model is `llama-3.3-70b-versatile` with a system prompt that pins the
output to the experiment JSON contract. Rate-limited and owner-authenticated.

---

### `POST /api/v1/generate` 🔒

**Request body:**

```json
{
  "prompt": "A flanker task with 40 trials, arrow keys, 20 second response window"
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
    "draft": { "settings": {}, "blocks": [], "branches": [], "loops": [] },
    "valid": true,
    "errors": []
  },
  "message": "Draft generated",
  "success": true
}
```

| Field | Type | Description |
|---|---|---|
| `draft` | `object` | Candidate experiment JSON (goes straight into the builder canvas) |
| `valid` | `boolean` | Whether the draft passed the shared Zod schema |
| `errors` | `array` | Zod issues when `valid` is `false` |

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Prompt missing or < 10 chars |
| `401` | `UNAUTHORIZED` | Missing/invalid access token |
| `429` | `RATE_LIMITED` | Too many requests |
| `502` | `GENERATION_FAILED` | Groq call failed or returned non-JSON |

> ⚠️ **Client not yet wired:** `src/api/ai.js` still calls `/ai/generate-experiment` with
> `{ description }`. Update it to `request("POST", "/generate", { prompt })` and read
> `data.draft` / `data.valid`.

---

---

## 7. Results

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

### `GET /api/v1/results/:experimentId/export?format=csv|json` 👤

Download all session and trial data as a file. Flat structure — one row/object per trial with session fields denormalized.

**Path params:**

| Param | Type | Description |
|---|---|---|
| `experimentId` | `string` | MongoDB ObjectId |

**Query params:**

| Param | Type | Required | Validation |
|---|---|---|---|
| `format` | `string` | yes | `"csv"` or `"json"` |

**Request:** none

**Response: `200 OK`**

Headers:
```
Content-Type: text/csv  (or application/json)
Content-Disposition: attachment; filename="stroop-task_2026-09-26.csv"
```

> CSV values starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` so spreadsheet
> apps can't execute them as formulas.

**CSV columns:**

```
sessionId,participantId,status,excluded,browser,os,screenW,screenH,pixelRatio,refreshRate,jitter,timingScore,startedAt,completedAt,trialIndex,blockId,condition,stimulusType,stimulusContent,stimulusUrl,response,correct,rt,framesIntended,framesActual,framesDropped
```

**JSON format** (array of flat objects with the same fields as CSV columns):

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

**Errors:**

| Status | Code | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Missing or invalid `format` query param |
| `404` | `NOT_FOUND` | Experiment not found |
| `403` | `FORBIDDEN` | Don't own this experiment |
