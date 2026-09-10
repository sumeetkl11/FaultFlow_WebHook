import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../redis/index.js';
import { logger } from '../utils/logger.js';

const WINDOW_SIZE_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 2000;

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const tenantId = req.tenant?.id ? `tenant:${req.tenant.id}` : `ip:${clientIp}`;
  const currentMinute = Math.floor(Date.now() / (WINDOW_SIZE_SECONDS * 1000));
  const key = `ratelimit:${tenantId}:${currentMinute}`;

  try {
    const currentCount = await redisClient.incr(key);
    if (currentCount === 1) {
      await redisClient.expire(key, WINDOW_SIZE_SECONDS + 10);
    }

    if (currentCount > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader('Retry-After', WINDOW_SIZE_SECONDS);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Ingestion rate limit exceeded. Max ${MAX_REQUESTS_PER_WINDOW} requests per minute.`,
          status: 429,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - currentCount));
    next();
  } catch (err: unknown) {
    logger.warn({ err }, 'Rate limiter Redis error; allowing request through');
    return res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Rate limiting service is temporarily unavailable.',
        status: 503,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
