class ApiError extends Error {
  constructor(
    statusCode,
    message = 'Something went wrong',
    errors = [],
    stack = '',
    code = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.code =
      code ||
      (statusCode === 400
        ? 'VALIDATION_ERROR'
        : statusCode === 401
        ? 'UNAUTHORIZED'
        : statusCode === 403
        ? 'FORBIDDEN'
        : statusCode === 404
        ? 'NOT_FOUND'
        : statusCode === 409
        ? 'CONFLICT'
        : statusCode === 410
        ? 'GONE'
        : statusCode === 429
        ? 'RATE_LIMITED'
        : 'INTERNAL_ERROR');

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };
export default ApiError;
