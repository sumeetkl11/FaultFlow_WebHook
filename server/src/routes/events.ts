import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';
import { checkAndSetIdempotency } from '../redis/index.js';
import { eventQueue } from '../queues/eventQueue.js';
import { IngestEventSchema } from '../schemas/eventSchema.js';
import * as telemetryBuffer from '../telemetry/buffer.js';
import * as sseBroadcaster from '../telemetry/sseBroadcaster.js';
import { config } from '../config/env.js';
import { generateWebhookSignature } from '../utils/signature.js';

export const eventsRouter = Router();

// POST /api/v1/events - Low-Latency Ingress Gateway (<25ms)
eventsRouter.post('/', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const idempotencyKey = req.header('Idempotency-Key');

  if (!idempotencyKey) {
    return res.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header is required for all event dispatches.',
        status: 400,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const trimmedKey = idempotencyKey.trim();
  if (trimmedKey.length === 0 || trimmedKey.length > 128 || !/^[A-Za-z0-9_.:-]+$/.test(trimmedKey)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header must be 1-128 alphanumeric, dash, dot, colon, or underscore characters.',
        status: 400,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Atomic Redis SETNX idempotency check (24h TTL)
  const isUnique = await checkAndSetIdempotency(idempotencyKey, 86400);
  if (!isUnique) {
    telemetryBuffer.recordDeduplication();
    return res.status(200).json({
      success: true,
      status: 200,
      message: 'Deduplicated: payload already received and queued for delivery.',
    });
  }

  // Validate payload schema via Zod
  const parsed = IngestEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The provided request payload failed schema validation.',
        status: 400,
        timestamp: new Date().toISOString(),
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          issue: i.message,
        })),
      },
    });
  }

  const { target_url, event_type, payload, max_retries, timeout_ms } = parsed.data;
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const payloadString = JSON.stringify(payload);
  const payloadBytes = Buffer.byteLength(payloadString, 'utf8');

  // Hybrid Storage: Offload payloads > 4KB to PostgreSQL event_blobs
  let payloadRefId: string | null = null;
  let inlinePayload: Record<string, any> | null = payload;

  if (payloadBytes > config.maxPayloadInlineBytes) {
    payloadRefId = `blob_${eventId}`;
    await pool.query(
      `INSERT INTO event_blobs (id, body) VALUES ($1, $2)`,
      [payloadRefId, payloadString]
    );
    inlinePayload = null;
  }

  // Insert initial record in PostgreSQL events table
  try {
    await pool.query(
      `INSERT INTO events 
       (id, tenant_id, idempotency_key, target_url, event_type, status, max_retries, timeout_ms, payload_ref_id, inline_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        eventId,
        tenant.id,
        idempotencyKey,
        target_url,
        event_type,
        'QUEUED',
        max_retries,
        timeout_ms,
        payloadRefId,
        inlinePayload ? JSON.stringify(inlinePayload) : null,
      ]
    );
  } catch (dbErr: any) {
    // PostgreSQL error code 23505: unique_violation (concurrent idempotency race condition)
    if (dbErr.code === '23505') {
      telemetryBuffer.recordDeduplication();
      return res.status(200).json({
        success: true,
        status: 200,
        message: 'Deduplicated: payload already received and queued for delivery.',
      });
    }
    throw dbErr;
  }

  // Push into BullMQ Queue (< 25ms total response time)
  await eventQueue.add(
    'deliver_webhook',
    {
      eventId,
      tenantId: tenant.id,
      targetUrl: target_url,
      eventType: event_type,
      payload: inlinePayload,
      payloadRefId,
      timeoutMs: timeout_ms,
      maxRetries: max_retries,
      signingSecret: tenant.signingSecret,
    },
    {
      attempts: max_retries,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );

  // Broadcast initial QUEUED state over SSE
  sseBroadcaster.broadcast('job_state_delta', {
    event_id: eventId,
    event_type,
    target_url,
    status: 'QUEUED',
    attempts: 0,
    created_at: new Date().toISOString(),
  }, tenant.id);

  return res.status(202).json({
    success: true,
    status: 202,
    data: {
      event_id: eventId,
      status: 'QUEUED',
      idempotency_cached: false,
      enqueued_at: new Date().toISOString(),
    },
  });
});

// GET /api/v1/events - List historical event logs with pagination
eventsRouter.get('/', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string || '0', 10), 0);
  const status = req.query.status as string;
  const eventType = req.query.event_type as string;

  let query = `
    SELECT id as event_id, target_url, event_type, status, attempts, max_retries,
           latency_ms, last_http_status, created_at, delivered_at
    FROM events
    WHERE tenant_id = $1
  `;
  const params: any[] = [tenant.id];

  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  if (eventType) {
    params.push(eventType);
    query += ` AND event_type = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  // Total count for pagination
  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM events WHERE tenant_id = $1`,
    [tenant.id]
  );
  const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);

  return res.status(200).json({
    success: true,
    status: 200,
    meta: {
      total_count: totalCount,
      limit,
      offset,
    },
    data: result.rows,
  });
});

// GET /api/v1/events/:id - Granular event lifecycle & trace drawer details
eventsRouter.get('/:id', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const { id } = req.params;

  const eventRes = await pool.query(
    `SELECT e.*, b.body as blob_body, t.signing_secret
     FROM events e
     LEFT JOIN event_blobs b ON e.payload_ref_id = b.id
     JOIN tenants t ON e.tenant_id = t.id
     WHERE e.id = $1 AND e.tenant_id = $2`,
    [id, tenant.id]
  );

  if (eventRes.rowCount === 0) {
    return res.status(404).json({
      error: {
        code: 'EVENT_NOT_FOUND',
        message: `Event with ID '${id}' does not exist for this tenant.`,
        status: 404,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const row = eventRes.rows[0];
  const payload = row.blob_body ? JSON.parse(row.blob_body) : row.inline_payload;

  // Retrieve attempt timeline
  const attemptsRes = await pool.query(
    `SELECT attempt_number, http_status as response_status, latency_ms, error_message, attempted_at as timestamp
     FROM event_attempts
     WHERE event_id = $1
     ORDER BY attempt_number ASC`,
    [id]
  );

  // Compute Stripe/Svix HMAC preview
  const payloadStr = JSON.stringify(payload || {});
  const previewTimestamp = Math.floor(new Date(row.created_at).getTime() / 1000) || Math.floor(Date.now() / 1000);
  const { headerValue: hmacSignature } = generateWebhookSignature(
    payloadStr,
    previewTimestamp,
    row.signing_secret
  );

  return res.status(200).json({
    success: true,
    status: 200,
    data: {
      event_id: row.id,
      tenant_id: row.tenant_id,
      status: row.status,
      event_type: row.event_type,
      target_url: row.target_url,
      idempotency_key: row.idempotency_key,
      hmac_signature: `sha256=${hmacSignature}`,
      payload,
      attempts_timeline: attemptsRes.rows,
      created_at: row.created_at,
      delivered_at: row.delivered_at,
    },
  });
});
