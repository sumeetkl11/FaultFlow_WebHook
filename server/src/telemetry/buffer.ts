import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { sseBroadcaster } from './sseBroadcaster.js';
import { eventQueue } from '../queues/eventQueue.js';

interface AttemptRecord {
  latencyMs: number;
  status: number;
  timestamp: number;
}

/**
 * Computes NIST-standard percentile using linear interpolation between closest ranks.
 */
export function calculateNistPercentile(sortedValues: number[], percentile: number): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  if (n === 1) return sortedValues[0];

  const rank = (percentile / 100) * (n - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);
  const weight = rank - lowerIndex;

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const interpolated = sortedValues[lowerIndex] * (1 - weight) + sortedValues[upperIndex] * weight;
  return Math.round(interpolated);
}

class TelemetryRingBuffer {
  private buffer: AttemptRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private deduplicationCount: number = 0;
  private rescuedPayloadsCount: number = 0;

  constructor() {
    this.startMicroBatchFlush();
  }

  recordAttempt(latencyMs: number, status: number) {
    this.buffer.push({
      latencyMs,
      status,
      timestamp: Date.now(),
    });
    if (status >= 200 && status < 300) {
      this.rescuedPayloadsCount++;
    }
  }

  recordDeduplication() {
    this.deduplicationCount++;
  }

  private startMicroBatchFlush() {
    this.flushTimer = setInterval(async () => {
      try {
        await this.flushMetrics();
      } catch (err) {
        logger.error({ err }, 'Error during telemetry micro-batch flush');
      }
    }, 2000); // 2-second micro-batch interval as defined in PRD & TAD
  }

  private async flushMetrics() {
    const recordsToProcess = [...this.buffer];
    this.buffer = [];

    const now = new Date();
    const count = recordsToProcess.length;
    const throughputRps = Math.round(count / 2);

    let p50 = 0;
    let p95 = 0;
    let p99 = 0;
    let delivered = 0;
    let failed = 0;

    if (count > 0) {
      const latencies = recordsToProcess.map((r) => r.latencyMs).sort((a, b) => a - b);
      p50 = calculateNistPercentile(latencies, 50);
      p95 = calculateNistPercentile(latencies, 95);
      p99 = calculateNistPercentile(latencies, 99);

      delivered = recordsToProcess.filter((r) => r.status >= 200 && r.status < 300).length;
      failed = count - delivered;
    }

    // Get queue counts from BullMQ
    let activeQueue = 0;
    let delayedQueue = 0;
    let dlqCount = 0;

    try {
      const counts = await eventQueue.getJobCounts('active', 'delayed', 'failed', 'waiting');
      activeQueue = (counts.active || 0) + (counts.waiting || 0);
      delayedQueue = counts.delayed || 0;

      // Also fetch DLQ count from database
      const dlqRes = await db.query('SELECT COUNT(*) as total FROM dead_letter_queue');
      dlqCount = parseInt(dlqRes.rows[0]?.total || '0', 10);
    } catch {
      // Ignore transient queue reading errors
    }

    // Persist aggregated micro-batch to PostgreSQL
    try {
      await db.query(
        `INSERT INTO telemetry_metrics 
         (timestamp, throughput_rps, p50_ms, p95_ms, p99_ms, active_queue, delayed_queue, dlq_count, delivered_count, failed_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [now, throughputRps, p50, p95, p99, activeQueue, delayedQueue, dlqCount, delivered, failed]
      );
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed persisting telemetry micro-batch');
    }

    // Broadcast update over SSE stream
    const telemetryPayload = {
      timestamp: now.toISOString(),
      throughput_rps: throughputRps,
      latency_percentiles: {
        p50_ms: p50,
        p95_ms: p95,
        p99_ms: p99,
      },
      queue_depth: {
        active: activeQueue,
        delayed: delayedQueue,
        failed_dlq: dlqCount,
      },
      rescued_payloads: this.rescuedPayloadsCount,
      deduplications: this.deduplicationCount,
    };

    sseBroadcaster.broadcast('telemetry_update', telemetryPayload);
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export const telemetryBuffer = new TelemetryRingBuffer();
