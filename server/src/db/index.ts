import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 15000,
  keepAlive: true,
});

pool.on('error', (err) => {
  logger.warn({ err: err.message }, 'Notice: PostgreSQL idle connection dropped (pool will auto-reconnect)');
});

export const db = {
  query: async (text: string, params?: any[]) => {
    try {
      return await pool.query(text, params);
    } catch (err: any) {
      if (err.message && (err.message.includes('Connection terminated') || err.message.includes('timeout'))) {
        logger.warn('Retrying database query after connection drop...');
        return await pool.query(text, params);
      }
      throw err;
    }
  },
  getClient: () => pool.connect(),
  checkHealth: async () => {
    try {
      const res = await pool.query('SELECT 1 as healthy');
      return res.rows[0]?.healthy === 1;
    } catch (err) {
      logger.error({ err }, 'PostgreSQL health check failed');
      return false;
    }
  },
  close: () => pool.end(),
};
