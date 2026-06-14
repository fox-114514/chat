import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../auth/jwt';
import { logger } from '../utils/logger';

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof token !== 'string' || token.length === 0) {
    next(new Error('NO_TOKEN'));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    socket.data.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    logger.debug({ err }, 'socket auth failed');
    next(new Error('INVALID_TOKEN'));
  }
}
