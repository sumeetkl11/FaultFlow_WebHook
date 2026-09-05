import { Queue } from 'bullmq';
import { redisConnection } from '../redis/index.js';

export interface WebhookJobData {
  eventId: string;
  tenantId: string;
  targetUrl: string;
  eventType: string;
  payload: Record<string, any> | null;
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
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: false, // Retain failed jobs for DLQ inspection
  },
});
