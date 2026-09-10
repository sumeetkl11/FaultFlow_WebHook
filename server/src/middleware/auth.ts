import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';
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

// 4.1 In-memory tenant cache with LRU eviction and active sweep to prevent memory leaks
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 60 * 1000; // 1 minute
const tenantCache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();

// Periodic active cleanup of expired tenant cache entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tenantCache.entries()) {
    if (entry.expiresAt <= now) {
      tenantCache.delete(key);
    }
  }
}, 30 * 1000);
if (cleanupInterval.unref) cleanupInterval.unref();

function setTenantCache(key: string, tenant: TenantInfo) {
  if (tenantCache.size >= MAX_CACHE_SIZE) {
    const firstKey = tenantCache.keys().next().value;
    if (firstKey) tenantCache.delete(firstKey);
  }
  tenantCache.set(key, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function authenticateTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = (req.header('X-API-Key') || (req.query.token as string) || '').trim();

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
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      req.tenant = cached.tenant;
      return next();
    } else {
      tenantCache.delete(apiKeyHash);
    }
  }

  try {
    const result = await pool.query(
      `SELECT id, name, api_key_hash, signing_secret FROM tenants WHERE api_key_hash = $1 LIMIT 1`,
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

    // Constant-time hash verification against timing attacks
    const storedHashBuf = Buffer.from(row.api_key_hash, 'utf8');
    const computedHashBuf = Buffer.from(apiKeyHash, 'utf8');
    if (storedHashBuf.length !== computedHashBuf.length || !crypto.timingSafeEqual(storedHashBuf, computedHashBuf)) {
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API key does not correspond to a valid tenant.',
          status: 401,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const tenant: TenantInfo = {
      id: row.id,
      name: row.name,
      signingSecret: row.signing_secret,
    };

    setTenantCache(apiKeyHash, tenant);
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
