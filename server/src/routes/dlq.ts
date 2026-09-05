import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { replayDlqEvents } from '../queues/dlqReplay.js';
import { DlqReplaySchema } from '../schemas/eventSchema.js';

export const dlqRouter = Router();

// POST /api/v1/dlq/replay - Throttled DLQ batch/selective replay
dlqRouter.post('/replay', async (req: Request, res: Response) => {
  const tenant = req.tenant!;

  const parsed = DlqReplaySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid DLQ replay payload.',
        status: 400,
        timestamp: new Date().toISOString(),
        details: parsed.error.issues,
      },
    });
  }

  const { mode, event_ids } = parsed.data;
  const result = await replayDlqEvents(tenant.id, mode, event_ids);

  return res.status(200).json({
    success: true,
    status: 200,
    data: {
      replayed_count: result.replayedCount,
      throttle_rate_per_sec: result.throttleRatePerSec,
      queued_at: result.queuedAt,
    },
  });
});

// GET /api/v1/dlq - List dead-lettered events
dlqRouter.get('/', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string || '20', 10), 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string || '0', 10), 0);

  const result = await db.query(
    `SELECT d.id as dlq_id, d.event_id, d.error_message, d.retry_count, d.dead_lettered_at,
            e.target_url, e.event_type
     FROM dead_letter_queue d
     JOIN events e ON d.event_id = e.id
     WHERE d.tenant_id = $1
     ORDER BY d.dead_lettered_at DESC
     LIMIT $2 OFFSET $3`,
    [tenant.id, limit, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) as total FROM dead_letter_queue WHERE tenant_id = $1`,
    [tenant.id]
  );

  return res.status(200).json({
    success: true,
    status: 200,
    meta: {
      total_count: parseInt(countRes.rows[0]?.total || '0', 10),
      limit,
      offset,
    },
    data: result.rows,
  });
});
