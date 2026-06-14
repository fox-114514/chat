import type { Message, MessageType } from './models';

export interface ServerToClientEvents {
  'message:new': (message: Message) => void;
  'typing:update': (data: { userId: string; roomId: string; isTyping: boolean }) => void;
  'presence:update': (data: { userId: string; online: boolean }) => void;
  error: (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { roomId: string }, cb: (res: AckResponse) => void) => void;
  'room:leave': (data: { roomId: string }) => void;
  'message:send': (
    data: MessageSendPayload,
    cb: (res: MessageAckResponse) => void,
  ) => void;
  'typing:start': (data: { roomId: string }) => void;
  'typing:stop': (data: { roomId: string }) => void;
}

export interface InterServerEvents {
  // 暂无
}

export interface SocketData {
  user: { userId: string; username: string };
}

export interface MessageSendPayload {
  roomId: string;
  content?: string;
  type?: MessageType;
  fileId?: string;
}

export interface AckResponse {
  ok: boolean;
  error?: string;
  message?: string;
  code?: string;
}

export interface MessageAckResponse {
  ok: boolean;
  message?: Message;
  error?: string;
  code?: string;
}
