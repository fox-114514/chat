export interface User {
  id: string;
  username: string;
  avatarColor: string;
  publicKey?: string;
  createdAt?: string;
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

export type MessageType = 'text' | 'file' | 'image';

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
