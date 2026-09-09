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

let parsedRedisUrl: URL;
try {
  parsedRedisUrl = new URL(config.redisUrl);
} catch {
  parsedRedisUrl = new URL('redis://localhost:6379');
}

export const redisConnection = {
  host: parsedRedisUrl.hostname || 'localhost',
  port: parseInt(parsedRedisUrl.port || '6379', 10),
  username: parsedRedisUrl.username || undefined,
  password: parsedRedisUrl.password ? decodeURIComponent(parsedRedisUrl.password) : undefined,
  tls: parsedRedisUrl.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
  maxRetriesPerRequest: null,
};

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const ping = await redisClient.ping();
    return ping === 'PONG';
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
