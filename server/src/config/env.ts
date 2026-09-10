import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (fs.existsSync(path.resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

if (!process.env.DEFAULT_API_KEY) {
  throw new Error('[FATAL] DEFAULT_API_KEY environment variable is required');
}
if (!process.env.DEFAULT_SIGNING_SECRET) {
  throw new Error('[FATAL] DEFAULT_SIGNING_SECRET environment variable is required');
}


// Production fail-fast verification
if (isProduction) {
  const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL'];
  const missingVars = requiredEnvVars.filter((v) => !Object.prototype.hasOwnProperty.call(process.env, v) || !process.env[v as keyof NodeJS.ProcessEnv]);
  if (missingVars.length > 0) {
    throw new Error(
      `[FATAL] Missing required production environment variables: ${missingVars.join(', ')}`
    );
  }

  // Guard against standard dummy credentials in production
  if (process.env.DEFAULT_API_KEY === 'org_live_sk_faultflow_test_key_2026') {
    throw new Error('[FATAL] Insecure default test API key detected in production. Rotate DEFAULT_API_KEY immediately.');
  }
  if (process.env.DEFAULT_SIGNING_SECRET === 'whsec_faultflow_super_secret_signing_key_99') {
    throw new Error('[FATAL] Insecure default signing secret detected in production. Rotate DEFAULT_SIGNING_SECRET immediately.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://faultflow_admin:local_secret_password@localhost:5432/faultflow_db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultTenantId: process.env.DEFAULT_TENANT_ID || 'org_live_faultflow_demo',
  defaultApiKey: process.env.DEFAULT_API_KEY as string,
  defaultSigningSecret: process.env.DEFAULT_SIGNING_SECRET as string,
  maxPayloadInlineBytes: parseInt(process.env.MAX_PAYLOAD_INLINE_BYTES || '4096', 10),
  defaultMaxRetries: parseInt(process.env.DEFAULT_MAX_RETRIES || '5', 10),
  defaultTimeoutMs: parseInt(process.env.DEFAULT_TIMEOUT_MS || '5000', 10),
  dlqReplayMaxRps: parseInt(process.env.DLQ_REPLAY_MAX_RPS || '50', 10),
  trustedProxyCount: parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10),
  corsAllowedOrigins: (() => {
    if (!process.env.CORS_ALLOWED_ORIGINS) {
      return isProduction ? ['http://localhost:3000'] : ['*'];
    }
    return process.env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  })(),
  allowLocalWebhooks: process.env.ALLOW_LOCAL_WEBHOOKS === 'true' || !isProduction,
};
