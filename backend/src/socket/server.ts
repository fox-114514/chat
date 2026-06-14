import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../types/socket';
import { socketAuthMiddleware } from './auth';
import { addSocket, removeSocket, clearAll } from './onlineUsers';
import { registerRoomHandlers } from './handlers/rooms';
import { registerTypingHandlers } from './handlers/typing';
import { registerMessageHandlers } from './handlers/message';

type AppIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: AppIo | null = null;

function parseOrigins(): true | string[] {
  if (env.CORS_ORIGIN === '*') return true;
  return env.CORS_ORIGIN.split(',').map((s) => s.trim());
}

export function initSocket(httpServer: HttpServer): AppIo {
  if (io) return io;

  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: parseOrigins(), credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    const becameOnline = addSocket(userId, socket.id);

    logger.info(
      { userId, socketId: socket.id },
      'socket connected',
    );

    if (becameOnline) {
      io!.emit('presence:update', { userId, online: true });
    }

    registerRoomHandlers(socket, io!);
    registerTypingHandlers(socket, io!);
    registerMessageHandlers(socket, io!);

    socket.on('disconnect', (reason) => {
      const wentOffline = removeSocket(userId, socket.id);
      logger.info(
        { userId, socketId: socket.id, reason },
        'socket disconnected',
      );
      if (wentOffline) {
        io!.emit('presence:update', { userId, online: false });
      }
    });
  });

  return io;
}

export function getIO(): AppIo {
  if (!io) {
    throw new Error('socket.io not initialized; call initSocket first');
  }
  return io;
}

export async function closeSocket(): Promise<void> {
  if (!io) return;
  clearAll();
  await new Promise<void>((resolve) => {
    io!.close(() => resolve());
  });
  io = null;
}
