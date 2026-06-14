import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { requireMember } from '../db/rooms';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequest } from '../utils/errors';
import { MessageRow, rowToMessage } from '../types/models';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const MESSAGE_SELECT = `
  m.id, m.room_id, m.sender_id, m.content, m.type, m.file_id,
  m.created_at, m.edited_at,
  u.username AS sender_username,
  u.avatar_color AS sender_avatar_color,
  f.original_name AS file_original_name,
  f.size_bytes AS file_size_bytes,
  f.mime_type AS file_mime_type
`;

export const list = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const roomId = req.params.id;
    if (!roomId) throw BadRequest('room id required');

    const userId = req.user!.userId;
    await requireMember(pool, roomId, userId);

    const before =
      typeof req.query.before === 'string' && req.query.before.length > 0
        ? req.query.before
        : null;

    const rawLimit = Number.parseInt(
      typeof req.query.limit === 'string' ? req.query.limit : `${DEFAULT_LIMIT}`,
      10,
    );
    const limit = Number.isNaN(rawLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(rawLimit, 1), MAX_LIMIT);

    const result = await pool.query<MessageRow>(
      `SELECT ${MESSAGE_SELECT}
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN files f ON f.id = m.file_id
       WHERE m.room_id = $1
         AND ($2::uuid IS NULL OR m.created_at < (SELECT created_at FROM messages WHERE id = $2))
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [roomId, before, limit],
    );

    const messages = result.rows.map(rowToMessage);
    res.json({ messages, hasMore: messages.length === limit });
  },
);

export const markRead = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const roomId = req.params.id;
    if (!roomId) throw BadRequest('room id required');

    const userId = req.user!.userId;
    await requireMember(pool, roomId, userId);

    await pool.query(
      `UPDATE room_members
       SET last_read_at = NOW()
       WHERE room_id = $1 AND user_id = $2`,
      [roomId, userId],
    );

    res.json({ ok: true });
  },
);
