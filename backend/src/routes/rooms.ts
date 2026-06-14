import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../auth/middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequest, NotFound, Forbidden, Conflict } from '../utils/errors';
import { RoomRow, roomRowToDto } from '../types/models';
import { fetchRoomMembers, fetchRoomMembersBatch, requireMember } from '../db/rooms';
import * as messageController from './messages';
import { logger } from '../utils/logger';

const router = Router();

const NAME_MAX = 100;

function parseName(body: unknown): string {
  if (typeof body !== 'object' || body === null) {
    throw BadRequest('body must be an object');
  }
  const name = (body as { name?: unknown }).name;
  if (typeof name !== 'string') {
    throw BadRequest('name is required');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > NAME_MAX) {
    throw BadRequest(`name must be 1-${NAME_MAX} characters`);
  }
  return trimmed;
}

function parseMemberIds(body: unknown, selfId: string): string[] {
  if (typeof body !== 'object' || body === null) {
    throw BadRequest('body must be an object');
  }
  const raw = (body as { memberIds?: unknown }).memberIds;
  if (!Array.isArray(raw)) {
    throw BadRequest('memberIds must be an array');
  }
  const filtered = raw.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id !== selfId,
  );
  const unique = [...new Set(filtered)];
  if (unique.length === 0) {
    throw BadRequest('memberIds must contain at least one other user');
  }
  return unique;
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.userId;
    const roomsResult = await pool.query<RoomRow & { unread_count: number }>(
      `SELECT r.id, r.name, r.is_direct, r.created_by, r.created_at,
              COALESCE(
                (SELECT COUNT(*)::int FROM messages m
                 WHERE m.room_id = r.id
                   AND m.created_at > rm.last_read_at
                   AND m.sender_id <> $1),
                0
              ) AS unread_count
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
       ORDER BY COALESCE(
         (SELECT MAX(created_at) FROM messages WHERE room_id = r.id),
         r.created_at
       ) DESC`,
      [userId],
    );

    const roomIds = roomsResult.rows.map((r) => r.id);
    const membersByRoom = await fetchRoomMembersBatch(pool, roomIds);

    const items = roomsResult.rows.map((row) =>
      roomRowToDto(row, membersByRoom.get(row.id) ?? [], row.unread_count),
    );
    res.json({ rooms: items });
  }),
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const name = parseName(req.body);
    const memberIds = parseMemberIds(req.body, req.user!.userId);

    const userCheck = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE id = ANY($1::uuid[])`,
      [memberIds],
    );
    if (userCheck.rows.length !== memberIds.length) {
      throw BadRequest('one or more memberIds do not exist', 'INVALID_MEMBERS');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const roomResult = await client.query<RoomRow>(
        `INSERT INTO rooms (name, is_direct, created_by)
         VALUES ($1, false, $2)
         RETURNING id, name, is_direct, created_by, created_at`,
        [name, req.user!.userId],
      );
      const room = roomResult.rows[0]!;

      await client.query(
        `INSERT INTO room_members (room_id, user_id, role)
         SELECT $1::uuid, u, 'member'::varchar FROM UNNEST($2::uuid[]) AS u
         UNION ALL
         SELECT $1::uuid, $3::uuid, 'admin'::varchar`,
        [room.id, memberIds, req.user!.userId],
      );

      await client.query('COMMIT');

      const members = await fetchRoomMembers(pool, room.id);
      logger.info(
        { roomId: room.id, creatorId: req.user!.userId, memberCount: members.length },
        'room created',
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

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const roomId = req.params.id;
    if (!roomId) throw BadRequest('room id required');

    await requireMember(pool, roomId, req.user!.userId);

    const roomResult = await pool.query<RoomRow>(
      `SELECT id, name, is_direct, created_by, created_at
       FROM rooms WHERE id = $1`,
      [roomId],
    );
    const room = roomResult.rows[0];
    if (!room) throw NotFound('room not found');

    const members = await fetchRoomMembers(pool, room.id);
    res.json({ room: roomRowToDto(room, members) });
  }),
);

router.get(
  '/:id/messages',
  requireAuth,
  messageController.list,
);

router.post(
  '/:id/read',
  requireAuth,
  messageController.markRead,
);

router.post(
  '/:id/members',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const roomId = req.params.id;
    if (!roomId) throw BadRequest('room id required');
    const body = (req.body ?? {}) as { userId?: unknown };
    if (typeof body.userId !== 'string' || body.userId.length === 0) {
      throw BadRequest('userId is required', 'INVALID_USER_ID');
    }
    const newUserId = body.userId;

    const callerRole = await requireMember(pool, roomId, req.user!.userId);
    if (callerRole !== 'admin') {
      throw Forbidden('only admins can add members', 'NOT_ADMIN');
    }

    const userCheck = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1`,
      [newUserId],
    );
    if (userCheck.rows.length === 0) {
      throw NotFound('user not found', 'USER_NOT_FOUND');
    }

    try {
      await pool.query(
        `INSERT INTO room_members (room_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [roomId, newUserId],
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        throw Conflict('user is already a member', 'ALREADY_MEMBER');
      }
      throw err;
    }

    logger.info(
      { roomId, addedBy: req.user!.userId, newUserId },
      'member added to room',
    );
    res.status(201).json({ ok: true });
  }),
);

router.delete(
  '/:id/members/:userId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
    const roomId = req.params.id;
    const targetUserId = req.params.userId;
    if (!roomId || !targetUserId) throw BadRequest('room id and user id required');

    if (targetUserId === req.user!.userId) {
      throw BadRequest(
        'cannot remove yourself; admins must transfer ownership first',
        'CANNOT_REMOVE_SELF',
      );
    }

    const callerRole = await requireMember(pool, roomId, req.user!.userId);
    if (callerRole !== 'admin') {
      throw Forbidden('only admins can remove members', 'NOT_ADMIN');
    }

    const result = await pool.query(
      `DELETE FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [roomId, targetUserId],
    );
    if (result.rowCount === 0) {
      throw NotFound('user is not a member of this room', 'NOT_A_MEMBER');
    }

    logger.info(
      { roomId, removedBy: req.user!.userId, targetUserId },
      'member removed from room',
    );
    res.json({ ok: true });
  }),
);

export default router;
