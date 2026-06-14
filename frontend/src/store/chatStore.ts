import { create } from 'zustand';
import type { Message, Room, RoomListItem } from '../types/models';

interface TypingState {
  userId: string;
  isTyping: boolean;
}

interface ChatState {
  rooms: RoomListItem[];
  currentRoomId: string | null;
  messages: Record<string, Message[]>;
  typing: Record<string, TypingState[]>;
  onlineUsers: Set<string>;
  setRooms: (rooms: RoomListItem[]) => void;
  upsertRoom: (room: Room | RoomListItem) => void;
  updateRoomUnread: (roomId: string, unreadCount: number) => void;
  setCurrentRoomId: (roomId: string | null) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  prependMessages: (roomId: string, messages: Message[]) => void;
  appendMessage: (roomId: string, message: Message) => void;
  updateTyping: (roomId: string, userId: string, isTyping: boolean) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  currentRoomId: null,
  messages: {},
  typing: {},
  onlineUsers: new Set(),

  setRooms: (rooms) => set({ rooms }),

  upsertRoom: (room) =>
    set((state) => {
      const index = state.rooms.findIndex((r) => r.id === room.id);
      const listItem: RoomListItem = 'unreadCount' in room ? room : { ...room, unreadCount: 0 };
      if (index === -1) {
        return { rooms: [listItem, ...state.rooms] };
      }
      const next = [...state.rooms];
      next[index] = { ...next[index], ...listItem };
      return { rooms: next };
    }),

  updateRoomUnread: (roomId, unreadCount) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, unreadCount } : r)),
    })),

  setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),

  setMessages: (roomId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [roomId]: messages },
    })),

  prependMessages: (roomId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...messages, ...(state.messages[roomId] ?? [])],
      },
    })),

  appendMessage: (roomId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] ?? []), message],
      },
    })),

  updateTyping: (roomId, userId, isTyping) =>
    set((state) => {
      const list = state.typing[roomId] ?? [];
      const filtered = list.filter((t) => t.userId !== userId);
      const next = isTyping ? [...filtered, { userId, isTyping }] : filtered;
      return { typing: { ...state.typing, [roomId]: next } };
    }),

  setUserOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),
}));
