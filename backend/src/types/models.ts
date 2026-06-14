export interface User {
  id: string;
  username: string;
  avatarColor: string;
  publicKey: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  public_key: string | null;
  avatar_color: string;
  created_at: Date;
  last_seen_at: Date;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    publicKey: row.public_key,
    createdAt: row.created_at.toISOString(),
  };
}

export type RoomRole = 'admin' | 'member';

export interface RoomMember {
  userId: string;
  username: string;
  avatarColor: string;
  role: RoomRole;
  joinedAt: string;
  lastReadAt: string;
}

export interface RoomMemberRow {
  room_id?: string;
  user_id: string;
  username: string;
  avatar_color: string;
  role: string;
  joined_at: Date;
  last_read_at: Date;
}

export function rowToRoomMember(row: RoomMemberRow): RoomMember {
  return {
    userId: row.user_id,
    username: row.username,
    avatarColor: row.avatar_color,
    role: row.role === 'admin' ? 'admin' : 'member',
    joinedAt: row.joined_at.toISOString(),
    lastReadAt: row.last_read_at.toISOString(),
  };
}

export interface RoomRow {
  id: string;
  name: string | null;
  is_direct: boolean;
  created_by: string | null;
  created_at: Date;
}

export interface Room {
  id: string;
  name: string | null;
  isDirect: boolean;
  createdBy: string;
  createdAt: string;
  members: RoomMember[];
}

export interface RoomListItem {
  id: string;
  name: string | null;
  isDirect: boolean;
  createdBy: string;
  createdAt: string;
  members: RoomMember[];
  unreadCount: number;
}

export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount?: number,
): Room | RoomListItem {
  const base = {
    id: row.id,
    name: row.name,
    isDirect: row.is_direct,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at.toISOString(),
    members,
  };
  if (unreadCount === undefined) return base;
  return { ...base, unreadCount };
}

export function groupMembersByRoom(
  rows: RoomMemberRow[],
): Map<string, RoomMember[]> {
  const map = new Map<string, RoomMember[]>();
  for (const row of rows) {
    const roomId = row.room_id;
    if (!roomId) continue;
    const list = map.get(roomId) ?? [];
    list.push(rowToRoomMember(row));
    map.set(roomId, list);
  }
  return map;
}
