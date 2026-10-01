import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Unhandled server error:', err.message, err.stack);

  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  if (err.message && (
    err.message.includes('Unsupported file type') ||
    err.message.includes('File too large') ||
    err.message.includes('LIMIT_FILE_SIZE') ||
    err.message.includes('already registered') ||
    err.message.includes('Password must') ||
    err.message.includes('must be provided')
  )) {
    statusCode = 400;
  } else if (err.message && (
    err.message.includes('Invalid email or password') ||
    err.message.includes('Authentication required') ||
    err.message.includes('Invalid or expired token')
  )) {
    statusCode = 401;
  } else if (err.message && err.message.toLowerCase().includes('not found')) {
    statusCode = 404;
  }

  // Sanitize message: never expose filesystem paths, SQL statements, or internal stack traces
  let clientMessage = err.message || 'An error occurred';
  if (statusCode === 500) {
    clientMessage = 'An unexpected server error occurred. Please try again later.';
  } else if (/(\/|[A-Za-z]:\\|SELECT|INSERT|UPDATE|DELETE|syntax error|at \/)/i.test(clientMessage)) {
    clientMessage = 'Invalid request parameters or server processing error.';
  }

  res.status(statusCode).json({
    status: 'error',
    message: clientMessage,
  });
}
