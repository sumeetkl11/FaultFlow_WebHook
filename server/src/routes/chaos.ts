import { Router, Request, Response } from 'express';
import { ChaosConfigSchema, ChaosConfigInput } from '../schemas/eventSchema.js';
import { logger } from '../utils/logger.js';

export const chaosRouter = Router();

interface ChaosState extends ChaosConfigInput {
  updatedAt: string;
}

const currentChaosConfig: ChaosState = {
  simulated_status: 200,
  artificial_delay_ms: 0,
  failure_rate_percent: 0,
  updatedAt: new Date().toISOString(),
};

interface ChaosLogEntry {
  id: string;
  timestamp: string;
  method: string;
  status: number;
  delayMs: number;
  headers: Record<string, any>;
  body: any;
}

const recentChaosLogs: ChaosLogEntry[] = [];
const MAX_CHAOS_LOGS = 50;

// POST /api/v1/chaos/config - Update sandbox failure parameters
chaosRouter.post('/config', (req: Request, res: Response) => {
  const parsed = ChaosConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid chaos configuration payload.',
        status: 400,
        timestamp: new Date().toISOString(),
        details: parsed.error.issues,
      },
    });
  }

  currentChaosConfig.simulated_status = parsed.data.simulated_status;
  currentChaosConfig.artificial_delay_ms = parsed.data.artificial_delay_ms;
  currentChaosConfig.failure_rate_percent = parsed.data.failure_rate_percent;
  currentChaosConfig.updatedAt = new Date().toISOString();

  logger.info({ currentChaosConfig }, 'Chaos sandbox configuration updated');

  return res.status(200).json({
    success: true,
    status: 200,
    data: {
      simulated_status: currentChaosConfig.simulated_status,
      artificial_delay_ms: currentChaosConfig.artificial_delay_ms,
      failure_rate_percent: currentChaosConfig.failure_rate_percent,
      updated_at: currentChaosConfig.updatedAt,
    },
  });
});

// GET /api/v1/chaos/config - Get current sandbox parameters
chaosRouter.get('/config', (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: 200,
    data: {
      simulated_status: currentChaosConfig.simulated_status,
      artificial_delay_ms: currentChaosConfig.artificial_delay_ms,
      failure_rate_percent: currentChaosConfig.failure_rate_percent,
      updated_at: currentChaosConfig.updatedAt,
    },
  });
});

// GET /api/v1/chaos/logs - Get recent chaos sink received deliveries
chaosRouter.get('/logs', (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: 200,
    data: recentChaosLogs,
  });
});

// ALL /api/v1/chaos/sink - Mock webhook destination with chaos simulation
chaosRouter.all('/sink', async (req: Request, res: Response) => {
  const { simulated_status, artificial_delay_ms, failure_rate_percent } = currentChaosConfig;

  // Artificial latency injection
  if (artificial_delay_ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, artificial_delay_ms));
  }

  // Determine whether this request fails
  const shouldFail = Math.random() * 100 < failure_rate_percent;
  const statusToReturn = shouldFail ? simulated_status : 200;

  const logEntry: ChaosLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    method: req.method,
    status: statusToReturn,
    delayMs: artificial_delay_ms,
    headers: {
      'x-signature': req.header('x-signature'),
      'x-timestamp': req.header('x-timestamp'),
      'x-faultflow-event': req.header('x-faultflow-event'),
      'x-faultflow-delivery': req.header('x-faultflow-delivery'),
    },
    body: req.body,
  };

  recentChaosLogs.unshift(logEntry);
  if (recentChaosLogs.length > MAX_CHAOS_LOGS) {
    recentChaosLogs.pop();
  }

  if (statusToReturn === 429) {
    res.setHeader('Retry-After', '5');
    return res.status(429).json({
      error: 'Too Many Requests (Chaos Injected)',
      retry_after_seconds: 5,
    });
  }

  if (statusToReturn >= 500) {
    return res.status(statusToReturn).json({
      error: `Internal Server Error ${statusToReturn} (Chaos Simulation Active)`,
      chaos_injected: true,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Webhook received and processed by FaultFlow Chaos Sink.',
    event: req.header('x-faultflow-event'),
    delivery_id: req.header('x-faultflow-delivery'),
    timestamp: new Date().toISOString(),
  });
});
