import jwt from 'jsonwebtoken';
import Experiment from './models/Experiment.js';

// ─── requireAuth ───────────────────────────────────────────
// Verifies JWT access token from Authorization header.
// Sets req.userId for downstream handlers.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing access token' },
    });
  }

  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.ACCESS_TOKEN_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token' },
    });
  }
}

// ─── ownsExperiment ────────────────────────────────────────
// Loads experiment by :id or :experimentId param, verifies the
// authenticated user owns it. Sets req.experiment for the handler.
// Must run AFTER requireAuth.
export async function ownsExperiment(req, res, next) {
  try {
    const id = req.params.id || req.params.experimentId;
    const experiment = await Experiment.findById(id);

    if (!experiment) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Experiment not found' },
      });
    }
    if (experiment.owner.toString() !== req.userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not own this experiment' },
      });
    }

    req.experiment = experiment;
    next();
  } catch {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Experiment not found' },
    });
  }
}

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
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message },
      });
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

export async function rateLimit(req, res, next) {
  try {
    const rl = await getLimiter();
    if (!rl) return next();

    const ip = req.headers['x-forwarded-for'] || req.ip;
    const { success } = await rl.limit(ip);
    if (!success) {
      return res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    }
    next();
  } catch {
    next(); // don't block requests if rate limiter errors
  }
}
