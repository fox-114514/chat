import type { Server, Socket } from 'socket.io';
import { pool } from '../../db/pool';
import { requireMember } from '../../db/rooms';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { MessageRow, MessageType, rowToMessage } from '../../types/models';
import type {
  ClientToServerEvents,
  InterServerEvents,
  MessageSendPayload,
  ServerToClientEvents,
  SocketData,
} from '../../types/socket';

type AppIo = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const MAX_TEXT_LEN = 4000;
const VALID_TYPES: ReadonlySet<MessageType> = new Set(['text', 'file', 'image']);

const INSERT_WITH_JOIN = `
  WITH inserted AS (
    INSERT INTO messages (room_id, sender_id, content, type, file_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, room_id, sender_id, content, type, file_id, created_at, edited_at
  )
  SELECT
    m.id, m.room_id, m.sender_id, m.content, m.type, m.file_id,
    m.created_at, m.edited_at,
    u.username AS sender_username,
    u.avatar_color AS sender_avatar_color,
    f.original_name AS file_original_name,
    f.size_bytes AS file_size_bytes,
    f.mime_type AS file_mime_type
  FROM inserted m
  JOIN users u ON u.id = m.sender_id
  LEFT JOIN files f ON f.id = m.file_id
`;

function parsePayload(data: unknown): MessageSendPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.roomId !== 'string' || d.roomId.length === 0) return null;
  const payload: MessageSendPayload = { roomId: d.roomId };
  if (typeof d.content === 'string') payload.content = d.content;
  if (d.type === 'text' || d.type === 'file' || d.type === 'image') {
    payload.type = d.type;
  }
  if (typeof d.fileId === 'string') payload.fileId = d.fileId;
  return payload;
}

function validateContent(type: MessageType, content: unknown): string {
  if (type === 'text') {
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('content is required for text messages');
    }
    if (content.length > MAX_TEXT_LEN) {
      throw new Error(`content exceeds ${MAX_TEXT_LEN} characters`);
    }
    return content;
  }
  if (typeof content === 'string' && content.length > 0) {
    if (content.length > MAX_TEXT_LEN) {
      throw new Error(`content exceeds ${MAX_TEXT_LEN} characters`);
    }
    return content;
  }
  return '';
}

export function registerMessageHandlers(socket: Socket, _io: AppIo): void {
  const userId = socket.data.user.userId;

  socket.on('message:send', async (raw, cb) => {
    try {
      const payload = parsePayload(raw);
      if (!payload) {
        cb({ ok: false, error: 'INVALID_PAYLOAD', code: 'INVALID_PAYLOAD' });
        return;
      }

      const type: MessageType = payload.type ?? 'text';
      if (!VALID_TYPES.has(type)) {
        cb({ ok: false, error: 'INVALID_TYPE', code: 'INVALID_TYPE' });
        return;
      }

      const content = validateContent(type, payload.content);

      if ((type === 'file' || type === 'image') && !payload.fileId) {
        cb({ ok: false, error: 'FILE_ID_REQUIRED', code: 'FILE_ID_REQUIRED' });
        return;
      }

      await requireMember(pool, payload.roomId, userId);

      if (payload.fileId) {
        const fileCheck = await pool.query<{ uploader_id: string }>(
          `SELECT uploader_id FROM files WHERE id = $1`,
          [payload.fileId],
        );
        const file = fileCheck.rows[0];
        if (!file) {
          cb({ ok: false, error: 'FILE_NOT_FOUND', code: 'FILE_NOT_FOUND' });
          return;
        }
        if (file.uploader_id !== userId) {
          cb({ ok: false, error: 'FILE_NOT_OWNED', code: 'FILE_NOT_OWNED' });
          return;
        }
      }

      const result = await pool.query<MessageRow>(INSERT_WITH_JOIN, [
        payload.roomId,
        userId,
        content,
        type,
        payload.fileId ?? null,
      ]);

      const message = rowToMessage(result.rows[0]!);

      socket.to(payload.roomId).emit('message:new', message);

      logger.debug(
        { userId, roomId: payload.roomId, messageId: message.id, type },
        'message sent',
      );

      cb({ ok: true, message });
    } catch (err) {
      logger.warn(
        { err, userId, payload: raw },
        'message:send failed',
      );
      if (err instanceof AppError) {
        cb({ ok: false, error: err.message, code: err.code ?? 'SEND_FAILED' });
        return;
      }
      const message = err instanceof Error ? err.message : 'failed to send message';
      cb({ ok: false, error: 'SEND_FAILED', message, code: 'SEND_FAILED' });
    }
  });
}
