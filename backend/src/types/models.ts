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
  created_by: string;
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

export interface RoomListItem extends Room {
  unreadCount: number;
}

export function roomRowToDto(row: RoomRow, members: RoomMember[]): Room;
export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount: number,
): RoomListItem;
export function roomRowToDto(
  row: RoomRow,
  members: RoomMember[],
  unreadCount?: number,
): Room | RoomListItem {
  const base: Room = {
    id: row.id,
    name: row.name,
    isDirect: row.is_direct,
    createdBy: row.created_by,
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

export type MessageType = 'text' | 'file' | 'image';

export interface FileMeta {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  url: string;
}

export interface MessageSender {
  id: string;
  username: string;
  avatarColor: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  sender: MessageSender;
  content: string;
  type: MessageType;
  file: FileMeta | null;
  createdAt: string;
  editedAt: string | null;
}

export interface MessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: string;
  file_id: string | null;
  created_at: Date;
  edited_at: Date | null;
  sender_username?: string;
  sender_avatar_color?: string;
  file_original_name?: string | null;
  file_size_bytes?: string | null;
  file_mime_type?: string | null;
}

export function rowToMessage(row: MessageRow): Message {
  let file: FileMeta | null = null;
  if (row.file_id) {
    file = {
      id: row.file_id,
      originalName: row.file_original_name ?? 'unknown',
      sizeBytes: row.file_size_bytes ? Number(row.file_size_bytes) : 0,
      mimeType: row.file_mime_type ?? 'application/octet-stream',
      url: `/api/files/${row.file_id}`,
    };
  }

  return {
    id: row.id,
    roomId: row.room_id,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: row.sender_username ?? 'unknown',
      avatarColor: row.sender_avatar_color ?? '#3b82f6',
    },
    content: row.content,
    type: row.type as MessageType,
    file,
    createdAt: row.created_at.toISOString(),
    editedAt: row.edited_at?.toISOString() ?? null,
  };
}
