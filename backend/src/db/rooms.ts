import type { Pool } from 'pg';
import {
  RoomMember,
  RoomMemberRow,
  RoomRole,
  rowToRoomMember,
  groupMembersByRoom,
} from '../types/models';
import { Forbidden } from '../utils/errors';

export async function fetchRoomMembers(
  pool: Pool,
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

export async function fetchRoomMembersBatch(
  pool: Pool,
  roomIds: string[],
): Promise<Map<string, RoomMember[]>> {
  if (roomIds.length === 0) return new Map();
  const result = await pool.query<RoomMemberRow>(
    `SELECT rm.room_id, rm.user_id, rm.role, rm.joined_at, rm.last_read_at,
            u.username, u.avatar_color
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.room_id = ANY($1::uuid[])`,
    [roomIds],
  );
  return groupMembersByRoom(result.rows);
}

export async function requireMember(
  pool: Pool,
  roomId: string,
  userId: string,
): Promise<RoomRole> {
  const result = await pool.query<{ role: string }>(
    `SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId],
  );
  if (result.rows.length === 0) {
    throw Forbidden('not a member of this room', 'NOT_MEMBER');
  }
  return result.rows[0]!.role === 'admin' ? 'admin' : 'member';
}
