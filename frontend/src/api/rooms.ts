import { api } from './client';
import type { Room, RoomListItem } from '../types/models';

export interface CreateRoomPayload {
  name: string;
  memberIds: string[];
}

export async function fetchRooms(): Promise<RoomListItem[]> {
  const response = await api.get<{ rooms: RoomListItem[] }>('/rooms');
  return response.data.rooms;
}

export async function fetchRoom(roomId: string): Promise<Room> {
  const response = await api.get<{ room: Room }>(`/rooms/${roomId}`);
  return response.data.room;
}

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const response = await api.post<{ room: Room }>('/rooms', payload);
  return response.data.room;
}

export async function getOrCreateDirectRoom(userId: string): Promise<Room> {
  const response = await api.get<{ room: Room }>(`/direct/${userId}`);
  return response.data.room;
}

export async function addRoomMember(roomId: string, userId: string): Promise<void> {
  await api.post(`/rooms/${roomId}/members`, { userId });
}

export async function markRoomAsRead(roomId: string): Promise<void> {
  await api.post(`/rooms/${roomId}/read`);
}
