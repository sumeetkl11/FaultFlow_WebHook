import { Router, Request, Response } from 'express';
import { checkHealth } from '../db/index.js';
import { checkRedisHealth } from '../redis/index.js';

export const healthRouter = Router();

healthRouter.get('/liveness', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

healthRouter.get('/readiness', async (req: Request, res: Response) => {
  const [dbHealthy, redisHealthy] = await Promise.all([
    checkHealth(),
    checkRedisHealth(),
  ]);

  const allHealthy = dbHealthy && redisHealthy;
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'READY' : 'DEGRADED',
    checks: {
      database: dbHealthy ? 'CONNECTED' : 'DISCONNECTED',
      redis: redisHealthy ? 'CONNECTED' : 'DISCONNECTED',
    },
    timestamp: new Date().toISOString(),
  });
});
