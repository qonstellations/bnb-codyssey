import crypto from 'crypto';
import Session from '../models/Session.js';
import { ApiError, asyncHandler } from '../utils/index.js';

export const hashSessionToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Session must be loaded with '+tokenHash'.
export function verifySessionToken(session, token) {
  if (!session?.tokenHash || typeof token !== 'string') return false;
  const a = Buffer.from(hashSessionToken(token));
  const b = Buffer.from(session.tokenHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Participant write routes: only the browser that started the session (holding its token) may write.
export const requireSessionToken = asyncHandler(async (req, _res, next) => {
  const session = await Session.findById(req.params.sessionId).select('+tokenHash +withdrawCode');
  if (!session) throw new ApiError(404, 'Session not found', [], '', 'NOT_FOUND');
  if (!verifySessionToken(session, req.body?.token)) {
    throw new ApiError(403, 'Invalid session token', [], '', 'FORBIDDEN');
  }
  req.session = session;
  next();
});
