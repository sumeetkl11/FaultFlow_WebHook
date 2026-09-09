import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env.local'),
];

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://faultflow_admin:local_secret_password@localhost:5432/faultflow_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'org_live_faultflow_demo',
  defaultApiKey: process.env.DEFAULT_API_KEY || 'org_live_sk_faultflow_test_key_2026',
  defaultSigningSecret: process.env.DEFAULT_SIGNING_SECRET || 'whsec_faultflow_super_secret_signing_key_99',
  maxPayloadInlineBytes: parseInt(process.env.MAX_PAYLOAD_INLINE_BYTES || '4096', 10),
  defaultMaxRetries: parseInt(process.env.DEFAULT_MAX_RETRIES || '5', 10),
  defaultTimeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '5000', 10),
  dlqReplayMaxRps: parseInt(process.env.DLQ_REPLAY_MAX_RPS || '50', 10),
};
