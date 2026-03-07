import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool, logger } from '@acp/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  const pool = getPool();

  const migrationPath = join(__dirname, '../../packages/core/src/db/migrations/001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  logger.info('Running migrations...');
  await pool.query(sql);
  logger.info('Migrations complete');

  await closePool();
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
