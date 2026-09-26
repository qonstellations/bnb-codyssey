# Privacy, Data Handling & Ethics

How Codyssey handles participant data, what it deliberately does not collect, and where the
implementation falls short of what an IRB submission would demand. Written to be auditable: every
claim below points at code you can check.

For setup see the [root README](../README.md); for system design see
[architecture.md](architecture.md).

## Table of contents

- [What a participant actually discloses](#what-a-participant-actually-discloses)
- [Anonymisation](#anonymisation)
- [Withdrawal](#withdrawal)
- [Consent](#consent)
- [Data integrity](#data-integrity)
- [Security measures](#security-measures)
- [Researcher-facing controls](#researcher-facing-controls)
- [Known gaps](#known-gaps)
- [What an IRB submission would still need](#what-an-irb-submission-would-still-need)

---

## What a participant actually discloses

The `Session` document is the complete record of a participant. Its entire identifying surface:

```js
{
  experimentId,                  // which study
  participantId,                 // server-generated UUID v4
  deviceInfo: {
    browser,                     // "Chrome 141"  — a family + major version
    os,                          // "macOS"       — a family
    screenW, screenH, pixelRatio
  },
  calibration: { refreshRate, jitter, score },
  status, excluded, withdrawCode,
  startedAt, completedAt,
}
```

There is **no field for a name, an email address, a phone number, an IP address, a free-text
answer, or a raw user-agent string.** Not "we don't fill it" — the schema has nowhere to put it.
A `Trial` holds a stimulus, a condition, a response key, a correctness flag, a reaction time and
a frame-count record. Nothing else.

This is the strongest claim the platform makes, and it is enforced structurally rather than by
policy.

## Anonymisation

**Participant identity is a server-generated UUID v4**, created in `startSession` and never
derived from anything about the person:

```js
session = await Session.create({
  experimentId, participantId: uuidv4(), deviceInfo, withdrawCode: generateCode(),
});
```

Because it is random and unlinkable, the same person taking two studies produces two unrelated
identifiers. There is no cross-study join key, which also means there is nothing to deanonymise
with — a re-identification attack needs a link the system does not store.

**No IP address is persisted.** `x-forwarded-for` appears in exactly one place in the codebase:
as an ephemeral Redis key for rate limiting (`middlewares/rateLimit.middleware.js`). It is never
written to a document.

**No raw user agent is persisted.** `engine/calibration.js` parses `navigator.userAgent` down to
a browser family with a major version (`"Chrome 141"`) and an OS family (`"macOS"`), and only
those two derived strings are sent. This is a deliberate lossy transform: the raw string is a
close-to-unique fingerprint, the derived pair is not.

## Withdrawal

Participants get an 8-character base62 code on the completion screen and can delete everything
without contacting anyone:

```
DELETE /api/v1/run/withdraw/:withdrawCode
```

That route is public and unauthenticated by design — requiring a login to withdraw would be
absurd — and it hard-deletes the session and every trial belonging to it, then removes the
session document. There is no soft-delete, no tombstone, no retention window.

This implements the right to withdraw under GDPR Art. 7(3) ("shall have the right to withdraw
consent at any time") and the equivalent US requirement, and it is rare in research software.

The code is 8 characters of `crypto.randomBytes` mapped into a 62-character alphabet — roughly
48 bits of entropy, with `startSession` retrying up to three times on a collision against the
unique index. Combined with rate limiting on the route, that is a strong control against
guessing. It is not a secret in the cryptographic sense, so the code is treated as a capability
token: the [roadmap](roadmap.md) notes the upgrade path to a longer, single-use code.

## Consent

The participant sees the researcher's consent text and an explicit agree / decline choice. The
decline path exits immediately and **no data is collected** — there is no session to delete,
because the session is not created until after consent is given.

The order in `runtime/main.js` is deliberate:

```js
const agreed = await consentScreen(root, experiment.settings.consentText)
if (!agreed) return declinedScreen(root)
...
const { sessionId, withdrawCode } = await startSession(slug, calibration.deviceInfo)
```

Consent is asked *before* a session exists, which means declining leaves no trace at all.

**Known limitation:** the agree/decline event itself is not persisted. There is no consent
timestamp, no record of which version of the consent text was shown, and no consent event in the
data model. You can show that a participant completed a study; you cannot later prove they
agreed to the wording that was current at the time. This is the single largest gap between the
platform and IRB-grade consent handling, and it is tracked in
[Known gaps](#known-gaps) below.

## Data integrity

**Participant data is read-only to the researcher except for one flag.** A researcher can
exclude a session from analysis; nothing else about a session or trial is editable. Every
results route is owner-scoped, and ownership is enforced in middleware rather than in each
handler — the contract suite asserts a 403 for a second researcher on experiments, duplicate,
stimuli deletion and results summary.

**The withdrawal code is returned only to the participant,** at session start and at
completion, and it is not written to the CSV export. It does currently ride along in the
sessions-list JSON payload, which is a leak worth closing — see
[Known gaps](#known-gaps).

**CSV export neutralises formula injection.** A stimulus string beginning `=`, `+`, `-`, `@`,
tab or carriage return is prefixed with an apostrophe before quoting, because Excel would
otherwise execute it:

```js
if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
```

This is a real consideration that exported-data features in most research tools skip, and it
matters precisely because stimulus content is researcher-supplied text.

**Malformed identifiers return 404, never 500.** A bad ObjectId in any route parameter is
caught by `requireObjectId` and reported as a not-found, so probing the API cannot distinguish
"you sent nonsense" from "that does not exist" by watching for 500s.

**Cross-user isolation is tested.** The contract test suite creates two researchers and asserts
that one cannot read, modify or delete the other's experiment, template or stimulus.

## Security measures

| Control | Implementation |
|---|---|
| Password storage | bcryptjs, cost 10, via a Mongoose pre-save hook. Input capped at 8–128 chars to bound bcrypt cost against DoS. |
| Access tokens | JWT, 15-minute expiry, signed with `ACCESS_TOKEN_SECRET`. |
| Refresh tokens | JWT, 7-day expiry, **rotated on every use**. Only the SHA-256 hash is stored server-side, so a database read cannot recover a usable token. Replay of a spent token is rejected. |
| Silent refresh | the API client retries once through `/auth/refresh` on a 401, then logs out. |
| Secrets | environment variables only; `backend/.gitignore` excludes `*.env` and nothing else in the tree is tracked. `GROQ_API_KEY` never reaches the browser — generation is server-side. |
| Rate limiting | Upstash Redis sliding window, 10 requests / 10 seconds per IP, on all public routes plus register/login/refresh. |
| Input validation | Zod on every mutating request body, with per-issue messages and length caps. |
| Object-level authorisation | `ownsExperiment` middleware returns 403 for another researcher's experiment; template routes return 404 so ids are not probeable. |
| Beacon payload | the `sendBeacon` path is Zod-validated before insert and wrapped so it can never throw into the page unload. |

## Researcher-facing controls

- **Exclude a session** — one toggle, removes it from every aggregate and chart
- **Filter by timing quality** — hide sessions below a score threshold
- **Status visibility** — completed vs. abandoned vs. in-progress, and the completion rate
- **Per-trial inspection** — a drawer showing every trial of a session with its frame data
- **Raw data export** — CSV or JSON, one row per trial, with device and calibration columns

## Known gaps

Stated plainly, because an ethics review that finds them unmentioned is worse than one that
finds them documented.

| Gap | Impact | Fix |
|---|---|---|
| **No consent record.** Agree/decline is not persisted; there is no consent timestamp or consent-text version. | Cannot prove a participant agreed to the wording they saw. The main IRB blocker. | Stamp `agreedAt` (server-side) and a hash of the published `consentText` onto the session at creation; export both. |
| **No IRB metadata.** The model has no ethics-approval field, no protocol number, no consent-form version history. | Cannot tie collected data to an approval. | Add an ethics block to `Experiment` and carry it into the export header. |
| **Withdrawal code is exposed in the sessions API payload.** `getSessions` spreads the whole session document, so a researcher can read a participant's code and delete their data without consent. Not in the CSV export, but in the JSON. | A researcher can override a participant's withdrawal. | Strip `withdrawCode` from all researcher-facing responses. |
| **No consent-text version history.** Publishing freezes an experiment version, but consent text is not separately versioned. | Editing consent wording mid-study makes earlier sessions ambiguous. | Derive the consent version from the published version number. |
| **Tokens live in `localStorage`.** | Exfiltratable by XSS. | Move the refresh token to an httpOnly, SameSite cookie. Requires tightening CORS from `*` at the same time. |
| **No `helmet`, no CSP, no HSTS.** | Defaults rather than hardening. | `app.use(helmet())` behind a CSP that permits the Vite dev server and Blob origins. |
| **Rate limiting fails open and self-disables.** If `UPSTASH_REDIS_REST_URL` is unset the limiter is skipped, and any limiter error passes the request through. | Anonymous routes are unprotected in a default local setup. | Log a loud warning when the limiter is inactive; consider a fail-closed mode for production. |
| **Session routes authenticate on ObjectId possession alone.** | An attacker who can guess or obtain a session id could append trials. ObjectIds embed a creation timestamp, so the search space is narrower than 96 bits. | Per-session capability token, issued at `startSession`. |
| **No idempotency key on trial upload.** A retried batch can double-insert trials, which would corrupt the data. | Duplicate rows on a flaky connection. | Unique index on `(sessionId, trialIndex)` plus an upsert. |
| **Trial upload is unbounded per session.** Any number of rows can be appended while a session is `in_progress`. | A determined client could inject arbitrary trial data. | Cap rows per session against the published trial count. |
| **`scrub.js` is dead code.** It exports a `scrubText()` helper for redacting emails and phone numbers from free-text answers, and nothing imports it — the app has no free-text field. | None today; it would be a false reassurance if a free-text field were added later. | Delete it, or wire it up when a free-text question type exists. |

## What an IRB submission would still need

For anyone intending to actually run a study under oversight, the gap list above is the work
plan. The three that matter most, in order:

1. **A consent record** — timestamp plus the exact text version shown, stored per session and
   exportable. Without it there is no evidence of informed consent, only evidence of task
   completion.
2. **Anonymisation described in the consent text itself** — participants must be told what is
   collected (device, timing, responses), what is not (name, email, IP), and how to withdraw.
   The current consent text is researcher-authored free prose with a default; the platform
   should supply a compliant default that states the specifics.
3. **Ethics metadata on the experiment** — approval reference and consent version, so a dataset
   can be traced back to the protocol that authorised it.

Everything else — the withdrawal right, the absence of direct identifiers, ownership
enforcement, the read-only nature of participant records — is already in place.
