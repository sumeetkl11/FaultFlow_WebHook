import { Worker, Job } from 'bullmq';
import crypto from 'crypto';
import { redisConnection } from '../redis/index.js';
import { pool } from '../db/index.js';
import { logger } from '../utils/logger.js';
import * as telemetryBuffer from '../telemetry/buffer.js';
import { circuitBreaker } from './circuitBreaker.js';
import * as sseBroadcaster from '../telemetry/sseBroadcaster.js';
import { WebhookJobData } from '../queues/eventQueue.js';
import { config } from '../config/env.js';
import { validateWebhookUrl } from '../utils/urlValidator.js';
import { generateWebhookSignature } from '../utils/signature.js';

export function calculateBackoffWithJitter(attemptNumber: number): number {
  // Base intervals: Attempt 1: 5s, Attempt 2: 30s, Attempt 3: 120s (2m), Attempt 4: 900s (15m)
  const baseDelays = [5000, 30000, 120000, 900000];
  const base = baseDelays[Math.min(attemptNumber - 1, baseDelays.length - 1)] || 5000;

  // Randomized jitter (+/- 15%)
  const jitterFactor = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
  return Math.round(base * jitterFactor);
}

export const deliveryWorker = new Worker<WebhookJobData>(
  'faultflow_events',
  async (job: Job<WebhookJobData>) => {
    const {
      eventId,
      tenantId,
      targetUrl,
      payload,
      payloadRefId,
      timeoutMs,
      maxRetries,
      signingSecret,
    } = job.data;

    const attemptNumber = job.attemptsMade + 1;
    logger.info({ eventId, targetUrl, attemptNumber }, 'Worker processing webhook job');

    // Circuit Breaker check
    if (await circuitBreaker.isTripped(targetUrl)) {
      const remainingCooldown = await circuitBreaker.getRemainingCooldownMs(targetUrl);
      logger.warn({ targetUrl, remainingCooldown }, 'Circuit breaker is TRIPPED; delaying execution');
      await pool.query(
        `UPDATE events SET status = 'CIRCUIT_HOLD' WHERE id = $1`,
        [eventId]
      );
      sseBroadcaster.broadcast('job_state_delta', {
        event_id: eventId,
        status: 'CIRCUIT_HOLD',
        attempts: attemptNumber,
        cooldown_remaining_ms: remainingCooldown,
      }, tenantId);
      throw new Error(`Circuit breaker tripped for ${targetUrl}. Paused for ${remainingCooldown}ms`);
    }

    // Resolve payload (inline or offloaded from PostgreSQL event_blobs)
    let resolvedPayload = payload;
    if (!resolvedPayload && payloadRefId) {
      const blobRes = await pool.query('SELECT body FROM event_blobs WHERE id = $1', [payloadRefId]);
      if (blobRes.rowCount && blobRes.rows[0].body) {
        resolvedPayload = JSON.parse(blobRes.rows[0].body);
      }
    }

    // SSRF URL & Hostname/IP Validation
    try {
      await validateWebhookUrl(targetUrl, {
        allowLocal: config.allowLocalWebhooks,
      });
    } catch (ssrfErr: any) {
      logger.error({ eventId, targetUrl, err: ssrfErr.message }, 'SSRF Validation blocked webhook delivery');
      const latencyMs = 0;
      await pool.query(
        `INSERT INTO event_attempts (event_id, attempt_number, http_status, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, attemptNumber, 400, latencyMs, ssrfErr.message]
      ).catch(() => {});

      const dlqId = `dlq_${eventId}_${Date.now()}`;
      await pool.query(
        `INSERT INTO dead_letter_queue (id, event_id, tenant_id, error_message, last_response_body, retry_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dlqId, eventId, tenantId, ssrfErr.message, 'BLOCKED_BY_SSRF_POLICY', attemptNumber]
      ).catch(() => {});

      await pool.query(
        `UPDATE events SET status = 'DEAD_LETTERED', last_http_status = 400, attempts = $1 WHERE id = $2`,
        [attemptNumber, eventId]
      ).catch(() => {});

      sseBroadcaster.broadcast('job_state_delta', {
        event_id: eventId,
        status: 'DEAD_LETTERED',
        attempts: attemptNumber,
        last_http_status: 400,
        error_message: ssrfErr.message,
      }, tenantId);

      return { delivered: false, status: 400, latencyMs, error: ssrfErr.message };
    }

    // Cryptographic HMAC-SHA256 Signature (Stripe / Svix Standard: v1,<sig>)
    const bodyString = JSON.stringify(resolvedPayload || {});
    const timestamp = String(Math.floor(Date.now() / 1000));
    const { headerValue: signatureHeader } = generateWebhookSignature(
      bodyString,
      timestamp,
      signingSecret || config.defaultSigningSecret
    );

    // AbortController timeout enforcement
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs || 5000);
    const startTime = Date.now();

    let responseStatus: number | null = null;
    let responseBody = '';
    let errorMessage: string | null = null;

    try {
      // Mark as PROCESSING
      await pool.query(`UPDATE events SET status = 'PROCESSING' WHERE id = $1`, [eventId]);
      sseBroadcaster.broadcast('job_state_delta', {
        event_id: eventId,
        status: 'PROCESSING',
        attempts: attemptNumber,
      }, tenantId);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FaultFlow-Webhook-Engine/1.0',
          'X-FaultFlow-Event': job.data.eventType,
          'X-FaultFlow-Delivery': eventId,
          'X-Signature': signatureHeader,
          'X-Timestamp': timestamp,
        },
        body: bodyString,
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);
      const latencyMs = Date.now() - startTime;
      responseStatus = response.status;

      try {
        responseBody = await response.text();
      } catch {
        responseBody = '';
      }

      // Record in event_attempts table
      await pool.query(
        `INSERT INTO event_attempts (event_id, attempt_number, http_status, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, attemptNumber, responseStatus, latencyMs, null]
      );

      telemetryBuffer.recordAttempt(latencyMs, responseStatus);

      if (response.ok) {
        // Success (2xx)
        await circuitBreaker.recordSuccess(targetUrl);
        await pool.query(
          `UPDATE events 
           SET status = 'DELIVERED', latency_ms = $1, last_http_status = $2, attempts = $3, delivered_at = NOW()
           WHERE id = $4`,
          [latencyMs, responseStatus, attemptNumber, eventId]
        );

        sseBroadcaster.broadcast('job_state_delta', {
          event_id: eventId,
          status: 'DELIVERED',
          attempts: attemptNumber,
          latency_ms: latencyMs,
          last_http_status: responseStatus,
        }, tenantId);

        logger.info({ eventId, latencyMs, status: responseStatus }, 'Webhook successfully delivered');
        return { delivered: true, status: responseStatus, latencyMs };
      }

      // Non-2xx response
      errorMessage = `Destination returned HTTP ${responseStatus}: ${responseBody.slice(0, 200)}`;
      throw new Error(errorMessage);
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === 'AbortError';
      const errMsg = isTimeout
        ? `ETIMEDOUT: Target did not respond within ${timeoutMs}ms`
        : err.message || 'Delivery network error';

      await circuitBreaker.recordFailure(targetUrl);
      telemetryBuffer.recordAttempt(latencyMs, responseStatus || 504);

      // Record failure attempt in event_attempts
      await pool.query(
        `INSERT INTO event_attempts (event_id, attempt_number, http_status, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, attemptNumber, responseStatus || (isTimeout ? 504 : 500), latencyMs, errMsg]
      ).catch(() => {});

      const isExhausted = attemptNumber >= maxRetries;

      if (isExhausted) {
        // Route to Dead-Letter Queue (DLQ)
        const dlqId = `dlq_${eventId}_${Date.now()}`;
        await pool.query(
          `INSERT INTO dead_letter_queue (id, event_id, tenant_id, error_message, last_response_body, retry_count)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [dlqId, eventId, tenantId, errMsg, responseBody.slice(0, 2000), attemptNumber]
        ).catch(() => {});

        await pool.query(
          `UPDATE events 
           SET status = 'DEAD_LETTERED', last_http_status = $1, attempts = $2
           WHERE id = $3`,
          [responseStatus || (isTimeout ? 504 : 500), attemptNumber, eventId]
        ).catch(() => {});

        sseBroadcaster.broadcast('job_state_delta', {
          event_id: eventId,
          status: 'DEAD_LETTERED',
          attempts: attemptNumber,
          last_http_status: responseStatus || 500,
          error_message: errMsg,
        }, tenantId);

        sseBroadcaster.broadcast('dlq_alert', {
          event_id: eventId,
          error_message: errMsg,
          attempts: attemptNumber,
          dead_lettered_at: new Date().toISOString(),
        }, tenantId);

        logger.error({ eventId, attempts: attemptNumber }, 'Event retries exhausted. Transitioned to DLQ.');
      } else {
        // Schedule next retry with exponential backoff & jitter
        const nextDelayMs = calculateBackoffWithJitter(attemptNumber);
        await pool.query(
          `UPDATE events 
           SET status = 'RETRYING', attempts = $1, last_http_status = $2
           WHERE id = $3`,
          [attemptNumber, responseStatus || (isTimeout ? 504 : 500), eventId]
        ).catch(() => {});

        sseBroadcaster.broadcast('job_state_delta', {
          event_id: eventId,
          status: 'RETRYING',
          attempts: attemptNumber,
          next_retry_in_ms: nextDelayMs,
          last_http_status: responseStatus || 500,
          error_message: errMsg,
        }, tenantId);

        logger.warn(
          { eventId, attempt: attemptNumber, nextDelayMs, errMsg },
          'Webhook delivery attempt failed. Scheduling retry.'
        );
      }

      throw err; // Trigger BullMQ retry backoff
    }
  },
  {
    connection: redisConnection,
    concurrency: 20, // Concurrency 20 as specified in Master Plan & Architecture
  }
);

deliveryWorker.on('completed', (job) => {
  logger.debug({ jobId: job.id }, 'BullMQ job completed');
});

deliveryWorker.on('failed', (job, err) => {
  logger.warn({ jobId: job?.id, err: err.message }, 'BullMQ job attempt failed');
});
