import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../auth/middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequest, NotFound } from '../utils/errors';
import {
  RoomRow,
  RoomMemberRow,
  RoomMember,
  rowToRoomMember,
  roomRowToDto,
} from '../types/models';
import { logger } from '../utils/logger';

const router = Router();

async function fetchMembersForRoom(
  roomId: string,
): Promise<RoomMember[]> {
  const result = await pool.query<RoomMemberRow>(
    `SELECT rm.user_id, rm.role, rm.joined_at, rm.last_read_at,
            u.username, u.avatar_color
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = $1`,
    [roomId],
  );
  return result.rows.map(rowToRoomMember);
}

router.get(
  '/:userId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const otherUserId = req.params.userId;
    if (!otherUserId) throw BadRequest('userId required');
    const selfId = req.user!.userId;

    if (otherUserId === selfId) {
      throw BadRequest('cannot start a direct chat with yourself', 'SELF_DIRECT');
    }

    const userCheck = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      [otherUserId],
    );
    if (userCheck.rows.length === 0) {
      throw NotFound('user not found', 'USER_NOT_FOUND');
    }

    const existing = await pool.query<RoomRow>(
      `SELECT r.id, r.name, r.is_direct, r.created_by, r.created_at
       FROM rooms r
       WHERE r.is_direct = true
         AND EXISTS (SELECT 1 FROM room_members WHERE room_id = r.id AND user_id = $1)
         AND EXISTS (SELECT 1 FROM room_members WHERE room_id = r.id AND user_id = $2)
         AND (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) = 2
       LIMIT 1`,
      [selfId, otherUserId],
    );

    if (existing.rows.length > 0) {
      const room = existing.rows[0]!;
      const members = await fetchMembersForRoom(room.id);
      res.json({ room: roomRowToDto(room, members) });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const roomResult = await client.query<RoomRow>(
        `INSERT INTO rooms (name, is_direct, created_by)
         VALUES (NULL, true, $1)
         RETURNING id, name, is_direct, created_by, created_at`,
        [selfId],
      );
      const room = roomResult.rows[0]!;

      await client.query(
        `INSERT INTO room_members (room_id, user_id, role)
         VALUES ($1, $2, 'admin'), ($1, $3, 'admin')`,
        [room.id, selfId, otherUserId],
      );

      await client.query('COMMIT');

      const members = await fetchMembersForRoom(room.id);
      logger.info(
        { roomId: room.id, selfId, otherUserId },
        'direct chat created',
      );
      res.status(201).json({ room: roomRowToDto(room, members) });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

export default router;
