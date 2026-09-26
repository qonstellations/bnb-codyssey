import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/index.js';

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
