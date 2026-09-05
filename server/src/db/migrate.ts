import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pg from 'pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  logger.info('Starting FaultFlow database migration...');

  // Parse URL to check/create database
  const dbUrl = new URL(config.databaseUrl);
  const targetDb = dbUrl.pathname.replace(/^\//, '') || 'faultflow_db';
  
  // Clone URL to connect to default 'postgres' maintenance DB
  const maintenanceUrl = new URL(config.databaseUrl);
  maintenanceUrl.pathname = '/postgres';

  const maintenanceClient = new pg.Client({ connectionString: maintenanceUrl.toString() });

  try {
    await maintenanceClient.connect();
    const checkDb = await maintenanceClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDb]
    );

    if (checkDb.rowCount === 0) {
      logger.info(`Database '${targetDb}' does not exist. Creating...`);
      await maintenanceClient.query(`CREATE DATABASE "${targetDb}"`);
      logger.info(`Database '${targetDb}' created successfully.`);
    } else {
      logger.info(`Database '${targetDb}' already exists.`);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Notice when checking/creating database (will attempt direct pool connection)');
  } finally {
    await maintenanceClient.end().catch(() => {});
  }

  // Connect to target DB and run init.sql
  const targetPool = new pg.Pool({ connectionString: config.databaseUrl });
  try {
    const initSqlPath = path.resolve(__dirname, 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');

    await targetPool.query(initSql);
    await targetPool.query(`ALTER TABLE events ALTER COLUMN idempotency_key TYPE VARCHAR(128);`).catch(() => {});
    logger.info('Database schema DDL executed successfully.');

    // Seed default tenant
    const apiKeyHash = crypto.createHash('sha256').update(config.defaultApiKey).digest('hex');
    const tenantCheck = await targetPool.query(
      `SELECT id FROM tenants WHERE id = $1`,
      [config.defaultTenantId]
    );

    if (tenantCheck.rowCount === 0) {
      await targetPool.query(
        `INSERT INTO tenants (id, name, api_key_hash, signing_secret)
         VALUES ($1, $2, $3, $4)`,
        [
          config.defaultTenantId,
          'FaultFlow Demo Organization',
          apiKeyHash,
          config.defaultSigningSecret,
        ]
      );
      logger.info(`Default demo tenant seeded: ${config.defaultTenantId}`);
    } else {
      logger.info(`Default tenant '${config.defaultTenantId}' already present.`);
    }

    logger.info('FaultFlow database migrations completed successfully.');
  } catch (err: any) {
    logger.error({ err }, 'Migration failed');
    throw err;
  } finally {
    await targetPool.end().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      logger.info('Migration script finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Migration script exited with error.');
      process.exit(1);
    });
}
