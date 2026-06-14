import type { Server, Socket } from 'socket.io';
import { pool } from '../../db/pool';
import { requireMember } from '../../db/rooms';
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

export function registerRoomHandlers(socket: Socket, _io: AppIo): void {
  socket.on('room:join', async (data, cb) => {
    try {
      if (!data || typeof data.roomId !== 'string' || data.roomId.length === 0) {
        cb({ ok: false, error: 'INVALID_PAYLOAD', code: 'INVALID_PAYLOAD' });
        return;
      }
      const userId = socket.data.user.userId;
      await requireMember(pool, data.roomId, userId);
      await socket.join(data.roomId);
      logger.debug({ userId, roomId: data.roomId }, 'socket joined room');
      cb({ ok: true });
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'failed to join room';
      logger.warn({ err, userId: socket.data.user.userId, roomId: data?.roomId }, 'room:join failed');
      cb({ ok: false, error: code, message, code });
    }
  });

  socket.on('room:leave', (data) => {
    if (data && typeof data.roomId === 'string' && data.roomId.length > 0) {
      void socket.leave(data.roomId);
    }
  });
}
