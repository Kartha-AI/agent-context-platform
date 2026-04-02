import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './client.js';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getMigrationSql(): string {
  return readFileSync(join(__dirname, 'migrations', '001_initial_schema.sql'), 'utf-8');
}

export async function runMigrations(pool: pg.Pool): Promise<void> {
  const sql = getMigrationSql();
  logger.info('Running migrations...');
  await pool.query(sql);
  logger.info('Migrations complete');
}

async function migrate(): Promise<void> {
  const pool = getPool();
  await runMigrations(pool);
  await closePool();
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isDirectRun) {
  migrate().catch((err) => {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  });
}
