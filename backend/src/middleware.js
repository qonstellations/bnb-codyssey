import jwt from 'jsonwebtoken';
import Experiment from './models/Experiment.js';
import { ApiError, asyncHandler } from './utils/index.js';

// ─── requireAuth ───────────────────────────────────────────
// Verifies JWT access token from Authorization header.
// Sets req.userId for downstream handlers.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing access token', [], '', 'UNAUTHORIZED');
  }

  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.ACCESS_TOKEN_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired access token', [], '', 'UNAUTHORIZED');
  }
}

// ─── ownsExperiment ────────────────────────────────────────
// Loads experiment by :id or :experimentId param, verifies the
// authenticated user owns it. Sets req.experiment for the handler.
// Must run AFTER requireAuth.
export const ownsExperiment = asyncHandler(async (req, res, next) => {
  const id = req.params.id || req.params.experimentId;
  let experiment;
  try {
    experiment = await Experiment.findById(id);
  } catch {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }

  if (!experiment) {
    throw new ApiError(404, 'Experiment not found', [], '', 'NOT_FOUND');
  }
  if (experiment.owner.toString() !== req.userId) {
    throw new ApiError(403, 'You do not own this experiment', [], '', 'FORBIDDEN');
  }

  req.experiment = experiment;
  next();
});

// ─── validate ──────────────────────────────────────────────
// Factory: validate(zodSchema) returns middleware that validates
// req.body. On failure, returns 400 with field-level error messages.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new ApiError(400, message, result.error.issues, '', 'VALIDATION_ERROR');
    }
    req.body = result.data;
    next();
  };
}

// ─── rateLimit ─────────────────────────────────────────────
// Upstash sliding-window limiter: 10 requests per 10 seconds per IP.
// Lazily initialised — if Redis env vars aren't set (local dev),
// the limiter is skipped silently.
let limiter = null;

async function getLimiter() {
  if (limiter !== null) return limiter;
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    limiter = false;
    return false;
  }
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '10 s'),
  });
  return limiter;
}

export const rateLimit = asyncHandler(async (req, res, next) => {
  try {
    const rl = await getLimiter();
    if (!rl) return next();

    const ip = req.headers['x-forwarded-for'] || req.ip;
    const { success } = await rl.limit(ip);
    if (!success) {
      throw new ApiError(429, 'Too many requests', [], '', 'RATE_LIMITED');
    }
    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    next(); // don't block requests if rate limiter errors
  }
});

