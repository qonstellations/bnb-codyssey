import { isValidObjectId } from 'mongoose';
import { ApiError } from '../utils/index.js';

// Rejects malformed ObjectId params with 404 (Mongoose would throw CastError -> 500).
// Mount once per router: router.param('sessionId', requireObjectId('sessionId', 'Session not found'))
export function requireObjectId(param, message = 'Not found') {
  return (req, _res, next, value) => {
    if (!isValidObjectId(value ?? req.params[param])) {
      return next(new ApiError(404, message, [], '', 'NOT_FOUND'));
    }
    next();
  };
}
