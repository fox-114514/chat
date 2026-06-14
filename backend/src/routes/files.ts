import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { pool } from '../db/pool';
import { requireAuth } from '../auth/middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequest, Forbidden, NotFound, PayloadTooLarge } from '../utils/errors';
import { env } from '../config/env';
import { saveFile, resolveStoragePath } from '../storage/files';
import { logger } from '../utils/logger';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.FILE_UPLOAD_MAX_BYTES },
});

function uploadSingle(field: string) {
  const mw = upload.single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    mw(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(
            PayloadTooLarge(
              `file exceeds ${env.FILE_UPLOAD_MAX_BYTES} bytes`,
              'FILE_TOO_LARGE',
            ),
          );
          return;
        }
        next(BadRequest(err.message, err.code));
        return;
      }
      next(err);
    });
  };
}

router.post(
  '/upload',
  requireAuth,
  uploadSingle('file'),
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    if (!req.file) {
      throw BadRequest('file field is required', 'FILE_REQUIRED');
    }

    const saved = await saveFile(req.file.buffer, req.file.originalname);

    const result = await pool.query<{ id: string }>(
      `INSERT INTO files (uploader_id, storage_path, original_name, size_bytes, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        req.user!.userId,
        saved.storageFilename,
        req.file.originalname,
        saved.sizeBytes,
        req.file.mimetype || 'application/octet-stream',
      ],
    );
    const fileId = result.rows[0]!.id;

    logger.info(
      {
        fileId,
        uploaderId: req.user!.userId,
        size: saved.sizeBytes,
        mime: req.file.mimetype,
      },
      'file uploaded',
    );

    res.status(201).json({
      file: {
        id: fileId,
        originalName: req.file.originalname,
        sizeBytes: saved.sizeBytes,
        mimeType: req.file.mimetype || 'application/octet-stream',
        url: `/api/files/${fileId}`,
      },
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const fileId = req.params.id;
    if (!fileId) throw BadRequest('file id required');

    const result = await pool.query<{
      storage_path: string;
      mime_type: string | null;
      original_name: string | null;
      uploader_id: string;
    }>(
      `SELECT storage_path, mime_type, original_name, uploader_id
       FROM files WHERE id = $1`,
      [fileId],
    );
    const file = result.rows[0];
    if (!file) throw NotFound('file not found', 'FILE_NOT_FOUND');

    const userId = req.user!.userId;
    let allowed = file.uploader_id === userId;
    if (!allowed) {
      const memberCheck = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM messages m
           JOIN room_members rm ON rm.room_id = m.room_id AND rm.user_id = $1
           WHERE m.file_id = $2
         ) AS exists`,
        [userId, fileId],
      );
      allowed = memberCheck.rows[0]?.exists === true;
    }
    if (!allowed) {
      throw Forbidden(
        'you do not have permission to access this file',
        'FILE_ACCESS_DENIED',
      );
    }

    const absolutePath = resolveStoragePath(file.storage_path);
    const mime = file.mime_type || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    if (file.original_name) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
      );
    }

    res.sendFile(absolutePath, (err) => {
      if (err) {
        logger.warn({ err, fileId }, 'failed to send file');
        if (!res.headersSent) {
          res.status(500).json({ error: 'failed to send file' });
        }
      }
    });
  }),
);

export default router;
