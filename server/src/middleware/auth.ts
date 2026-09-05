import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { logger } from '../utils/logger.js';

export interface TenantInfo {
  id: string;
  name: string;
  signingSecret: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantInfo;
    }
  }
}

// In-memory tenant cache to keep ingress latency sub-25ms
const tenantCache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function authenticateTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey =
    (req.header('X-API-Key') || (req.query.token as string) || '').trim();

  if (!apiKey) {
    return res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'X-API-Key header or token query parameter is required.',
        status: 401,
        timestamp: new Date().toISOString(),
      },
    });
  }

  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Check cache first
  const cached = tenantCache.get(apiKeyHash);
  if (cached && cached.expiresAt > Date.now()) {
    req.tenant = cached.tenant;
    return next();
  }

  try {
    const result = await db.query(
      `SELECT id, name, signing_secret FROM tenants WHERE api_key_hash = $1 LIMIT 1`,
      [apiKeyHash]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key does not correspond to a valid tenant.',
          status: 401,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const row = result.rows[0];
    const tenant: TenantInfo = {
      id: row.id,
      name: row.name,
      signingSecret: row.signing_secret,
    };

    tenantCache.set(apiKeyHash, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    req.tenant = tenant;
    next();
  } catch (err: any) {
    logger.error({ err }, 'Error during tenant authentication');
    return res.status(500).json({
      error: {
        code: 'INTERNAL_AUTH_ERROR',
        message: 'Failed to verify tenant credentials.',
        status: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
