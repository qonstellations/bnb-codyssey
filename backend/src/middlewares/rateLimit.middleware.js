import { ApiError, asyncHandler } from '../utils/index.js';

// Upstash sliding-window limiters, one Redis prefix per bucket.
// Without UPSTASH_REDIS_REST_URL (or KV_REST_API_URL from the Vercel integration): skipped in local dev, refused (503) on Vercel —
// a deployed demo with no limiter is worse than a deployed demo that's down.
// RATE_LIMITS=off skips them locally (test-routes.mjs runs more signups than the auth buckets allow).
let redis = null;
const limiters = new Map();

async function getLimiter(name, tokens, window) {
  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    if (process.env.VERCEL) {
      throw new ApiError(503, 'Rate limiter not configured', [], '', 'UNAVAILABLE');
    }
    return null;
  }
  if (process.env.RATE_LIMITS === 'off' && !process.env.VERCEL) return null;

  const key = `${name}:${tokens}:${window}`;
  if (limiters.has(key)) return limiters.get(key);

  const { Ratelimit } = await import('@upstash/ratelimit');
  if (!redis) redis = (await import('@upstash/redis')).Redis.fromEnv();
  const rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix: `rl:${name}` });
  limiters.set(key, rl);
  return rl;
}

function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim();
}

/**
 * limit('login', 10, '15 m')                 — per client IP
 * limit('publish', 10, '1 h', { by: 'user' }) — per req.userId; mount after requireAuth
 * limit('ai-day', 100, '1 d', { by: 'global' }) — one shared bucket (caps total spend)
 */
export function limit(name, tokens, window, { by = 'ip' } = {}) {
  return asyncHandler(async (req, res, next) => {
    const rl = await getLimiter(name, tokens, window);
    if (!rl) return next();

    const id = by === 'user' ? req.userId : by === 'global' ? 'all' : clientIp(req);
    let result;
    try {
      result = await rl.limit(id);
    } catch {
      // ponytail: fail open on a Redis outage; MAX_* caps still bound the damage.
      return next();
    }
    if (!result.success) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))));
      throw new ApiError(429, 'Too many requests — slow down and try again shortly', [], '', 'RATE_LIMITED');
    }
    next();
  });
}

// Default bucket for public participant routes: 10 requests / 10 s per IP.
export const rateLimit = limit('ip', 10, '10 s');
