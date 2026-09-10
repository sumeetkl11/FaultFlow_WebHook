import { Queue } from 'bullmq';
import { redisConnection } from '../redis/index.js';

export interface WebhookJobData {
  eventId: string;
  tenantId: string;
  targetUrl: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  payloadRefId: string | null;
  timeoutMs: number;
  maxRetries: number;
  signingSecret: string;
}

export const eventQueue = new Queue<WebhookJobData>('faultflow_events', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 5000,    // Retain up to 5,000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Retain failed jobs in Redis for 7 days for DLQ inspection
      count: 5000,        // Max 5,000 failed jobs to prevent Redis OOM
    },
  },
});
