import { logger } from './utils/logger.js';
import { config } from './config/env.js';
import { deliveryWorker } from './workers/deliveryWorker.js';

logger.info(`=======================================================`);
logger.info(`  FaultFlow Worker Process Started`);
logger.info(`  Environment: ${config.nodeEnv}`);
logger.info(`=======================================================`);

// Graceful Shutdown
['SIGTERM', 'SIGINT'].forEach(sig => {
  process.on(sig, async () => {
    logger.info(`${sig} received. Shutting down worker gracefully...`);
    await deliveryWorker.close();
    process.exit(0);
  });
});
