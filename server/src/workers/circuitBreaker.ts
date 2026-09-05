import { logger } from '../utils/logger.js';

interface HostFailureRecord {
  failures: number[];
  trippedUntil: number | null;
}

const hostFailureRegistry = new Map<string, HostFailureRecord>();

const FAILURE_WINDOW_MS = 30 * 1000; // 30 seconds
const FAILURE_THRESHOLD = 10;         // 10 consecutive failures
const TRIP_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const circuitBreaker = {
  /**
   * Extracts hostname from a full URL.
   */
  getHost(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  },

  /**
   * Checks if deliveries to this host are currently tripped.
   */
  isTripped(url: string): boolean {
    const host = this.getHost(url);
    const record = hostFailureRegistry.get(host);
    if (!record) return false;

    const now = Date.now();
    if (record.trippedUntil && record.trippedUntil > now) {
      return true;
    }

    // If cooldown passed, reset
    if (record.trippedUntil && record.trippedUntil <= now) {
      record.trippedUntil = null;
      record.failures = [];
      logger.info(`Circuit breaker reset for host: ${host}`);
    }

    return false;
  },

  /**
   * Records a successful request, resetting the failure count.
   */
  recordSuccess(url: string) {
    const host = this.getHost(url);
    hostFailureRegistry.delete(host);
  },

  /**
   * Records a failure (5xx or timeout). Trips if threshold is exceeded.
   */
  recordFailure(url: string): boolean {
    const host = this.getHost(url);
    const now = Date.now();
    let record = hostFailureRegistry.get(host);

    if (!record) {
      record = { failures: [], trippedUntil: null };
      hostFailureRegistry.set(host, record);
    }

    // Filter out timestamps outside the sliding window
    record.failures = record.failures.filter((t) => now - t <= FAILURE_WINDOW_MS);
    record.failures.push(now);

    if (record.failures.length >= FAILURE_THRESHOLD) {
      record.trippedUntil = now + TRIP_DURATION_MS;
      logger.warn(
        `Circuit breaker TRIPPED for host '${host}' (${record.failures.length} failures in 30s). Pausing deliveries for 5 minutes.`
      );
      return true;
    }

    return false;
  },

  /**
   * Returns cooldown time remaining in ms if tripped.
   */
  getRemainingCooldownMs(url: string): number {
    const host = this.getHost(url);
    const record = hostFailureRegistry.get(host);
    if (!record || !record.trippedUntil) return 0;
    return Math.max(0, record.trippedUntil - Date.now());
  },
};
