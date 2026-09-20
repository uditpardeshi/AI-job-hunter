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
    err.message.includes('LIMIT_FILE_SIZE')
  )) {
    statusCode = 400;
  }

  res.status(statusCode).json({
    status: 'error',
    message: config.env === 'production' && statusCode === 500 ? 'Internal server error' : err.message,
    ...(config.env !== 'production' && { stack: err.stack }),
  });
}
