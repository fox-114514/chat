import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type NodeEnv = 'development' | 'production' | 'test';

interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  BCRYPT_ROUNDS: number;
  CORS_ORIGIN: string;
  FILE_UPLOAD_MAX_BYTES: number;
  STORAGE_PATH: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
  return value;
}

function parseIntEnv(key: string, defaultValue?: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`[env] Missing required environment variable: ${key}`);
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[env] Environment variable ${key} must be an integer, got: ${raw}`);
  }
  return parsed;
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

function loadEnv(): Env {
  return {
    NODE_ENV: parseNodeEnv(process.env['NODE_ENV']),
    PORT: parseIntEnv('PORT', 3000),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    JWT_SECRET: requireEnv('JWT_SECRET'),
    JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
    BCRYPT_ROUNDS: parseIntEnv('BCRYPT_ROUNDS', 12),
    CORS_ORIGIN: requireEnv('CORS_ORIGIN'),
    FILE_UPLOAD_MAX_BYTES: parseIntEnv('FILE_UPLOAD_MAX_BYTES', 20 * 1024 * 1024),
    STORAGE_PATH: process.env['STORAGE_PATH'] ?? './storage',
  };
}

export const env: Env = loadEnv();
