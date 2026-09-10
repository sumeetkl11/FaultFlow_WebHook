import { redisClient } from '../redis/index.js';
import { logger } from '../utils/logger.js';

const FAILURE_WINDOW_MS = 30 * 1000; // 30 seconds sliding window
const FAILURE_THRESHOLD = 10;        // 10 failures trips circuit
const TRIP_DURATION_MS = 5 * 60 * 1000; // 5 minutes cooldown

// In-memory fallback if Redis is temporarily unreachable
const fallbackFailureMap = new Map<string, { failures: number[]; trippedUntil: number | null }>();

export const circuitBreaker = {
  /**
   * Extracts hostname from a full URL.
   */
  getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0] || url;
    }
  },

  /**
   * Checks if deliveries to this host are currently tripped across the cluster.
   */
  async isTripped(url: string): Promise<boolean> {
    const host = this.getHost(url);
    const tripKey = `cb:tripped:${host}`;

    try {
      const exists = await redisClient.exists(tripKey);
      return exists === 1;
    } catch (err: any) {
      // Graceful fallback to local in-memory record
      logger.warn({ host, err: err.message }, 'Redis circuit breaker check failed, using fallback');
      const rec = fallbackFailureMap.get(host);
      return Boolean(rec?.trippedUntil && rec.trippedUntil > Date.now());
    }
  },

  /**
   * Records a successful request, clearing failures and resetting the circuit breaker.
   */
  async recordSuccess(url: string): Promise<void> {
    const host = this.getHost(url);
    const tripKey = `cb:tripped:${host}`;
    const failKey = `cb:failures:${host}`;

    try {
      await redisClient.del(tripKey, failKey);
    } catch (err: any) {
      logger.warn({ host, err: err.message }, 'Failed to clear circuit breaker in Redis');
    }

    fallbackFailureMap.delete(host);
  },

  /**
   * Records a failure (5xx or timeout) in a Redis sliding window. Trips if threshold is exceeded.
   */
  async recordFailure(url: string): Promise<boolean> {
    const host = this.getHost(url);
    const now = Date.now();
    const tripKey = `cb:tripped:${host}`;
    const failKey = `cb:failures:${host}`;
    const windowStart = now - FAILURE_WINDOW_MS;

    try {
      const member = `${now}:${Math.random().toString(36).substring(2, 7)}`;
      // Atomic pipeline: clean window, add failure, count failures, refresh TTL
      const results = await redisClient
        .multi()
        .zremrangebyscore(failKey, 0, windowStart)
        .zadd(failKey, now, member)
        .zcard(failKey)
        .expire(failKey, 60)
        .exec();

      const failureCount = (results?.[2]?.[1] as number) || 0;

      if (failureCount >= FAILURE_THRESHOLD) {
        await redisClient.set(tripKey, '1', 'PX', TRIP_DURATION_MS);
        logger.warn(
          `[CIRCUIT BREAKER] Tripped for host '${host}' (${failureCount} failures in ${FAILURE_WINDOW_MS / 1000}s). Pausing for ${TRIP_DURATION_MS / 60000} minutes.`
        );
        return true;
      }

      return false;
    } catch (err: any) {
      // Fallback in-memory tracking
      logger.warn({ host, err: err.message }, 'Redis circuit breaker record failed, using fallback');
      let rec = fallbackFailureMap.get(host);
      if (!rec) {
        rec = { failures: [], trippedUntil: null };
        fallbackFailureMap.set(host, rec);
      }
      rec.failures = rec.failures.filter((t) => now - t <= FAILURE_WINDOW_MS);
      rec.failures.push(now);

      if (rec.failures.length >= FAILURE_THRESHOLD) {
        rec.trippedUntil = now + TRIP_DURATION_MS;
        return true;
      }
      return false;
    }
  },

  /**
   * Returns cooldown time remaining in milliseconds if tripped.
   */
  async getRemainingCooldownMs(url: string): Promise<number> {
    const host = this.getHost(url);
    const tripKey = `cb:tripped:${host}`;

    try {
      const pttl = await redisClient.pttl(tripKey);
      return Math.max(0, pttl);
    } catch {
      const rec = fallbackFailureMap.get(host);
      if (!rec || !rec.trippedUntil) return 0;
      return Math.max(0, rec.trippedUntil - Date.now());
    }
  },
};
