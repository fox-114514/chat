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

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?=$|\n)/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
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
      const statements = splitSqlStatements(sql);
      logger.info({ file, statements: statements.length }, 'applying migration');
      for (const stmt of statements) {
        await client.query(stmt);
      }
    }
    logger.info({ count: files.length }, 'migrations complete');
  } finally {
    client.release();
  }
}
