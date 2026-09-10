import crypto from 'crypto';
import { pool } from '../db/index.js';
import { eventQueue } from './eventQueue.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import * as sseBroadcaster from '../telemetry/sseBroadcaster.js';

interface ReplayResult {
  replayedCount: number;
  throttleRatePerSec: number;
  queuedAt: string;
}

export async function replayDlqEvents(
  tenantId: string,
  mode: 'SELECTIVE' | 'BATCH_ALL',
  eventIds?: string[]
): Promise<ReplayResult> {
  let queryText = `
    SELECT d.id as dlq_id, d.event_id, e.target_url, e.event_type, e.payload_ref_id,
           e.inline_payload, e.timeout_ms, e.max_retries, t.signing_secret
    FROM dead_letter_queue d
    JOIN events e ON d.event_id = e.id
    JOIN tenants t ON d.tenant_id = t.id
    WHERE d.tenant_id = $1
  `;
  const queryParams: any[] = [tenantId];

  if (mode === 'SELECTIVE' && eventIds && eventIds.length > 0) {
    queryText += ` AND d.event_id = ANY($2::text[])`;
    queryParams.push(eventIds);
  }

  queryText += ` ORDER BY d.dead_lettered_at ASC LIMIT 500`;

  const result = await pool.query(queryText, queryParams);
  const items = result.rows;

  if (items.length === 0) {
    return {
      replayedCount: 0,
      throttleRatePerSec: config.dlqReplayMaxRps,
      queuedAt: new Date().toISOString(),
    };
  }

  logger.info({ count: items.length, mode }, 'Starting throttled DLQ replay');

  let replayedCount = 0;

  for (const item of items) {
    // 1. Remove from DLQ table
    await pool.query(`DELETE FROM dead_letter_queue WHERE id = $1`, [item.dlq_id]);

    // 2. Reset event status to QUEUED and attempts to 0
    await pool.query(
      `UPDATE events SET status = 'QUEUED', attempts = 0, last_http_status = NULL WHERE id = $1`,
      [item.event_id]
    );

    // 3. Re-enqueue into BullMQ
    await eventQueue.add(
      'deliver_webhook',
      {
        eventId: item.event_id,
        tenantId,
        targetUrl: item.target_url,
        eventType: item.event_type,
        payload: item.inline_payload,
        payloadRefId: item.payload_ref_id,
        timeoutMs: item.timeout_ms || 5000,
        maxRetries: item.max_retries || 5,
        signingSecret: item.signing_secret,
      },
      {
        attempts: item.max_retries || 5,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );

    // 4. Broadcast SSE state delta
    sseBroadcaster.broadcast('job_state_delta', {
      event_id: item.event_id,
      status: 'QUEUED',
      attempts: 0,
      replayed: true,
    }, tenantId);

    replayedCount++;
  }

  // Audit log entry
  await pool.query(
    `INSERT INTO audit_logs (id, tenant_id, action, actor_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      `audit_${crypto.randomUUID()}`,
      tenantId,
      'DLQ_BATCH_REPLAY',
      'api_admin',
      JSON.stringify({ mode, count: replayedCount }),
    ]
  );

  return {
    replayedCount,
    throttleRatePerSec: config.dlqReplayMaxRps,
    queuedAt: new Date().toISOString(),
  };
}
