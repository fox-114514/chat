import type { Server, Socket } from 'socket.io';
import { pool } from '../../db/pool';
import { requireMember } from '../../db/rooms';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
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
      logger.warn(
        {
          err,
          userId: socket.data.user.userId,
          roomId: typeof data?.roomId === 'string' ? data.roomId : undefined,
        },
        'room:join failed',
      );
      if (err instanceof AppError) {
        cb({ ok: false, error: err.message, code: err.code ?? 'JOIN_FAILED' });
        return;
      }
      cb({ ok: false, error: 'JOIN_FAILED', code: 'JOIN_FAILED' });
    }
  });

  socket.on('room:leave', (data) => {
    if (data && typeof data.roomId === 'string' && data.roomId.length > 0) {
      void socket.leave(data.roomId);
    }
  });
}
