import { ApiError } from '../utils/index.js';

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
