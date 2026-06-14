import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';

const UPLOADS_DIR = path.resolve(env.STORAGE_PATH, 'uploads');

export interface SavedFile {
  storageFilename: string;
  sizeBytes: number;
}

async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

function safeExt(originalName: string): string {
  const ext = path.extname(originalName);
  if (!ext || ext.length > 16) return '';
  return ext.replace(/[^a-zA-Z0-9.]/g, '');
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
): Promise<SavedFile> {
  await ensureUploadsDir();
  const ext = safeExt(originalName);
  const storageFilename = `${uuidv4()}${ext}`;
  const absolutePath = path.join(UPLOADS_DIR, storageFilename);
  await fs.writeFile(absolutePath, buffer);
  return { storageFilename, sizeBytes: buffer.length };
}

export function resolveStoragePath(storageFilename: string): string {
  const safe = path.basename(storageFilename);
  return path.join(UPLOADS_DIR, safe);
}

export async function deleteFile(storageFilename: string): Promise<void> {
  const absolutePath = resolveStoragePath(storageFilename);
  await fs.unlink(absolutePath);
}
