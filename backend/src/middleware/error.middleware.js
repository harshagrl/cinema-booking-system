import { AppError } from '../utils/errors.js';

/**
 * Centralized Application Error Handling Middleware.
 * Catches all errors from async controllers, validators, and database operations.
 * Produces structured, consistent JSON error responses.
 */
export const errorHandler = (err, req, res, next) => {
  // If headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Handled Operational Errors (AppError instances)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details && { errors: err.details }),
    });
  }

  // 2. Prisma Known Request Errors
  if (err.code === 'P2002') {
    const target = err.meta?.target ? ` (${err.meta.target})` : '';
    return res.status(409).json({
      success: false,
      message: `A record with this identifier already exists${target}.`,
      code: 'DUPLICATE_RESOURCE',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'The requested record was not found.',
      code: 'RESOURCE_NOT_FOUND',
    });
  }

  // 3. JSON body parsing error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload provided in request body.',
      code: 'MALFORMED_JSON',
    });
  }

  // 4. Unhandled Internal Errors (Log to console, don't expose stack in production)
  console.error('💥 Unhandled Exception:', err);

  const isDevelopment = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    message: isDevelopment ? err.message : 'An unexpected server error occurred.',
    code: 'INTERNAL_SERVER_ERROR',
    ...(isDevelopment && { stack: err.stack }),
  });
};

