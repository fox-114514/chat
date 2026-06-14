import type { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../types/socket';

type AppIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function registerTypingHandlers(socket: Socket, io: AppIo): void {
  const userId = socket.data.user.userId;

  socket.on('typing:start', (data) => {
    if (!data || typeof data.roomId !== 'string' || data.roomId.length === 0) {
      logger.warn({ userId, data }, 'typing:start invalid payload');
      return;
    }
    socket.to(data.roomId).emit('typing:update', {
      userId,
      roomId: data.roomId,
      isTyping: true,
    });
    void io;
  });

  socket.on('typing:stop', (data) => {
    if (!data || typeof data.roomId !== 'string' || data.roomId.length === 0) {
      logger.warn({ userId, data }, 'typing:stop invalid payload');
      return;
    }
    socket.to(data.roomId).emit('typing:update', {
      userId,
      roomId: data.roomId,
      isTyping: false,
    });
    void io;
  });
}
