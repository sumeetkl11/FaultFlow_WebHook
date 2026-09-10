import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { authenticateTenant } from './middleware/auth.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import { eventsRouter } from './routes/events.js';
import { dlqRouter } from './routes/dlq.js';
import { chaosRouter } from './routes/chaos.js';
import { telemetryRouter } from './routes/telemetry.js';
import { healthRouter } from './routes/health.js';

// Initialize background worker
import './workers/deliveryWorker.js';

const app = express();

// Set reverse proxy trust count (SEC-03)
app.set('trust proxy', config.trustedProxyCount);

// Security & Parsing Middleware
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsAllowedOrigins.includes('*') || config.corsAllowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Idempotency-Key', 'Authorization', 'X-FaultFlow-Event', 'X-Signature', 'X-Timestamp'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Request logging
app.use((req, res, next) => {
  if (!req.path.startsWith('/health') && !req.path.includes('/stream')) {
    logger.debug({ method: req.method, path: req.path }, 'Incoming HTTP request');
  }
  next();
});

// Health Checks (Unauthenticated)
app.use('/health', healthRouter);

// Chaos Testing Sandbox (Sink is open mock endpoint; config can also be accessed)
app.use('/api/v1/chaos', chaosRouter);

// Authenticated Core Endpoints
app.use('/api/v1/events', authenticateTenant, rateLimiter, eventsRouter);
app.use('/api/v1/dlq', authenticateTenant, dlqRouter);
app.use('/api/v1/telemetry', authenticateTenant, telemetryRouter);

// Standard RFC 7807 Error Envelope Middleware
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`=======================================================`);
  logger.info(`  FaultFlow Engine listening on http://localhost:${config.port}`);
  logger.info(`  Environment: ${config.nodeEnv}`);
  logger.info(`  Default Tenant ID: ${config.defaultTenantId}`);
  logger.info(`=======================================================`);
});

// Graceful Shutdown
['SIGTERM', 'SIGINT'].forEach(sig => {
  process.on(sig, () => {
    logger.info(`${sig} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  });
});

export default app;
