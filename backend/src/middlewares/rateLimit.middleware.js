import { ApiError, asyncHandler } from '../utils/index.js';

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

    const ip = String(req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim();
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
