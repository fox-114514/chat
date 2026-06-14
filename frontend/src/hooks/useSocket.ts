import { useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getSocket, disconnectSocket } from '../socket/socket';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../types/models';

export function useSocket(): void {
  const { user } = useAuth();
  const joinedRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      joinedRooms.current.clear();
      return;
    }

    let isActive = true;
    const socket = getSocket();

    const handleMessageNew = (message: Message): void => {
      if (!isActive) return;
      useChatStore.getState().appendMessage(message.roomId, message);
      if (message.roomId !== useChatStore.getState().currentRoomId) {
        const room = useChatStore.getState().rooms.find((r) => r.id === message.roomId);
        if (room) {
          useChatStore.getState().updateRoomUnread(message.roomId, room.unreadCount + 1);
        }
      }
    };

    const handleTypingUpdate = (data: {
      userId: string;
      roomId: string;
      isTyping: boolean;
    }): void => {
      if (!isActive) return;
      useChatStore.getState().updateTyping(data.roomId, data.userId, data.isTyping);
    };

    const handlePresenceUpdate = (data: { userId: string; online: boolean }): void => {
      if (!isActive) return;
      if (data.online) {
        useChatStore.getState().setUserOnline(data.userId);
      } else {
        useChatStore.getState().setUserOffline(data.userId);
      }
    };

    socket.on('message:new', handleMessageNew);
    socket.on('typing:update', handleTypingUpdate);
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      isActive = false;
      socket.off('message:new', handleMessageNew);
      socket.off('typing:update', handleTypingUpdate);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [user]);
}
