# ROUTES.md — API Routes

All routes live under `/api/v1`. Base URL: your backend Vercel URL.

**Auth legend**
- 🌐 **Public** — no login, rate-limited (Upstash)
- 🔒 **Auth** — needs Clerk token (`Authorization: Bearer <token>`)
- 👤 **Owner** — Auth + researcher must own the experiment

---

## Health

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/health` | 🌐 | Check the server is alive |

---

## Auth

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 🌐 | Create a researcher account |
| POST | `/api/v1/auth/login` | 🌐 | Log in → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | 🌐 | Swap refresh token for new token pair |
| POST | `/api/v1/auth/logout` | 🔒 | Invalidate refresh token |
| GET | `/api/v1/auth/me` | 🔒 | Get current user profile |

---

## Participant (runtime)

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/run/:slug` | 🌐 | Get the published experiment JSON |
| POST | `/api/v1/run/:slug/sessions` | 🌐 | Start a session → returns `sessionId` + `withdrawCode` |
| PATCH | `/api/v1/run/sessions/:sessionId` | 🌐 | Update session (device info, calibration score, status) |
| POST | `/api/v1/run/sessions/:sessionId/trials` | 🌐 | Upload a batch of trials |
| POST | `/api/v1/run/sessions/:sessionId/complete` | 🌐 | Mark session as finished |
| POST | `/api/v1/run/sessions/:sessionId/beacon` | 🌐 | Last-chance save on tab close (`text/plain` body) |
| DELETE | `/api/v1/run/withdraw/:withdrawCode` | 🌐 | Delete the session + all its trials |

---

## Experiments

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/experiments` | 🔒 | List my experiments |
| POST | `/api/v1/experiments` | 🔒 | Create a new experiment |
| GET | `/api/v1/experiments/:id` | 👤 | Get one experiment |
| PUT | `/api/v1/experiments/:id` | 👤 | Save the draft |
| DELETE | `/api/v1/experiments/:id` | 👤 | Delete an experiment |
| POST | `/api/v1/experiments/:id/duplicate` | 👤 | Copy an experiment |
| POST | `/api/v1/experiments/:id/publish` | 👤 | Freeze a version, create random slug |

---

## Stimuli

| Method | Route | Auth | What it does |
|---|---|---|---|
| POST | `/api/v1/stimuli/upload-url` | 🔒 | Get a Vercel Blob upload URL/token |
| POST | `/api/v1/stimuli` | 🔒 | Save stimulus record after upload |
| GET | `/api/v1/stimuli` | 🔒 | List my stimuli |
| DELETE | `/api/v1/stimuli/:id` | 🔒 | Delete a stimulus (owner only) |

---

## Results

| Method | Route | Auth | What it does |
|---|---|---|---|
| GET | `/api/v1/results/:experimentId/summary` | 👤 | Participants, completion rate, mean RT, accuracy |
| GET | `/api/v1/results/:experimentId/sessions` | 👤 | List sessions with timing quality score |
| GET | `/api/v1/results/:experimentId/sessions/:sessionId` | 👤 | One session + its trials |
| PATCH | `/api/v1/results/:experimentId/sessions/:sessionId` | 👤 | Exclude / include a session |
| GET | `/api/v1/results/:experimentId/export?format=csv\|json` | 👤 | Download all data |

**Total: 29 routes**
