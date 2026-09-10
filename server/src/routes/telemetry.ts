import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as sseBroadcaster from '../telemetry/sseBroadcaster.js';
import { pool } from '../db/index.js';

export const telemetryRouter = Router();

// GET /api/v1/telemetry/stream - Real-Time Server-Sent Events (SSE) Stream
telemetryRouter.get('/stream', (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const clientId = `sse_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseBroadcaster.addClient(clientId, tenant.id, res);
});

// GET /api/v1/telemetry/stats - Get historical aggregated metrics
telemetryRouter.get('/stats', async (req: Request, res: Response) => {
  const result = await pool.query(
    `SELECT timestamp, throughput_rps, p50_ms, p95_ms, p99_ms, 
            active_queue, delayed_queue, dlq_count, delivered_count, failed_count
     FROM telemetry_metrics
     ORDER BY timestamp DESC
     LIMIT 50`
  );

  return res.status(200).json({
    success: true,
    status: 200,
    data: result.rows.reverse(),
  });
});
