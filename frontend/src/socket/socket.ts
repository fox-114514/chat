import { io, Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;
  const token = getAccessToken();
  if (!token) {
    throw new Error('no access token; cannot connect socket');
  }
  socket = io({
    auth: { token },
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitWithAck<TResponse = unknown, TPayload = unknown>(
  event: string,
  payload: TPayload,
  timeoutMs = 5_000,
): Promise<TResponse> {
  const s = getSocket();
  return new Promise<TResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`socket event "${event}" timed out`));
    }, timeoutMs);

    s.emit(event, payload, (response: TResponse) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}
