import fs from 'fs/promises';
import path from 'path';
import { pool } from './pool';
import { logger } from '../utils/logger';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function readMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith('.sql')).sort();
}

async function readMigration(name: string): Promise<string> {
  return fs.readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
}

export async function runMigrations(): Promise<void> {
  const files = await readMigrationFiles();
  if (files.length === 0) {
    logger.warn('no migration files found');
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = await readMigration(file);
      logger.info({ file }, 'applying migration');
      await client.query(sql);
    }
    logger.info({ count: files.length }, 'migrations complete');
  } finally {
    client.release();
  }
}
