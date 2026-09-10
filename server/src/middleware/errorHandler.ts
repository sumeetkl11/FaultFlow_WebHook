import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

interface HttpError {
  status?: number;
  statusCode?: number;
  code?: string;
  message?: string;
  details?: unknown;
}

export function errorHandler(
  err: HttpError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled API error');

  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected internal error occurred.';

  res.status(status).json({
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString(),
      request_id: (req.headers['x-request-id'] as string) || `req_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
      details: err.details ?? undefined,
    },
  });
}
