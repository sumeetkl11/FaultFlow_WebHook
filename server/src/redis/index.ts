import { Redis, RedisOptions } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const redisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    logger.warn(`Redis reconnecting attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
};

export const redisClient = new Redis(config.redisUrl, redisOptions);

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis error encountered');
});

export const redisConnection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
};

export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
}

/**
 * Atomic SETNX check for idempotency.
 * Returns true if the key is newly acquired (not previously seen).
 * Returns false if the key already exists (duplicate request).
 */
export async function checkAndSetIdempotency(
  idempotencyKey: string,
  ttlSeconds: number = 86400
): Promise<boolean> {
  const key = `idemp:${idempotencyKey}`;
  const result = await redisClient.set(key, 'LOCKED', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}
