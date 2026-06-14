import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useChatStore } from '../../store/chatStore';
import { fetchMessages } from '../../api/messages';
import { fetchRoom, markRoomAsRead } from '../../api/rooms';
import { emitWithAck, getSocket } from '../../socket/socket';
import { getApiErrorMessage } from '../../api/client';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Avatar from '../common/Avatar';
import type { Room, Message } from '../../types/models';

const DEFAULT_LIMIT = 20;

export default function ChatWindow() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const {
    setCurrentRoomId,
    setMessages,
    appendMessage,
    updateRoomUnread,
    messages: messagesByRoom,
  } = useChatStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const roomMessages = roomId ? messagesByRoom[roomId] ?? [] : [];

  const display = useMemo(() => {
    if (!room || !user) return { name: 'Select a chat', avatarColor: '#3b82f6', isDirect: false };
    if (room.name) return { name: room.name, avatarColor: '#3b82f6', isDirect: false };
    const other = room.members.find((m) => m.userId !== user.id);
    return {
      name: other?.username ?? 'Unknown',
      avatarColor: other?.avatarColor ?? '#3b82f6',
      isDirect: true,
    };
  }, [room, user]);

  const loadRoom = useCallback(async () => {
    if (!roomId) {
      setRoom(null);
      setMessages('', []);
      setCurrentRoomId(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [roomData, messagesData] = await Promise.all([
        fetchRoom(roomId),
        fetchMessages(roomId, { limit: DEFAULT_LIMIT }),
      ]);
      setRoom(roomData);
      // API returns newest-first; store oldest-first so UI renders old->new top->bottom
      setMessages(roomId, [...messagesData.messages].reverse());
      setHasMore(messagesData.hasMore);
      setCurrentRoomId(roomId);
      await markRoomAsRead(roomId);
      updateRoomUnread(roomId, 0);

      const socket = getSocket();
      socket.emit('room:join', { roomId }, (res: { ok: boolean; error?: string }) => {
        if (!res.ok) {
          console.warn('Failed to join room:', res.error);
        }
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [roomId, setCurrentRoomId, setMessages, updateRoomUnread]);

  const loadMore = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore || roomMessages.length === 0) return;
    setLoadingMore(true);
    try {
      const before = roomMessages[0].id;
      const data = await fetchMessages(roomId, { before, limit: DEFAULT_LIMIT });
      setMessages(roomId, [...data.messages].reverse().concat(roomMessages));
      setHasMore(data.hasMore);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, hasMore, roomMessages, setMessages]);

  useEffect(() => {
    loadRoom();
    return () => {
      if (roomId) {
        const socket = getSocket();
        socket.emit('room:leave', { roomId });
      }
    };
  }, [roomId, loadRoom]);

  const handleSendText = useCallback(
    async (content: string) => {
      if (!roomId) return;
      try {
        const res = await emitWithAck<{ ok: boolean; message?: Message; error?: string }>(
          'message:send',
          { roomId, content, type: 'text' },
        );
        if (!res.ok || !res.message) {
          setError(res.error ?? 'Failed to send message');
          return;
        }
        appendMessage(roomId, res.message);
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
    },
    [roomId, appendMessage],
  );

  const handleSendFile = useCallback(
    async (fileMeta: { id: string; originalName: string }, type: 'file' | 'image') => {
      if (!roomId) return;
      try {
        const res = await emitWithAck<{ ok: boolean; message?: Message; error?: string }>(
          'message:send',
          {
            roomId,
            content: fileMeta.originalName,
            type,
            fileId: fileMeta.id,
          },
        );
        if (!res.ok || !res.message) {
          setError(res.error ?? 'Failed to send file');
          return;
        }
        appendMessage(roomId, res.message);
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
    },
    [roomId, appendMessage],
  );

  if (!roomId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-50 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
        <p>Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 px-3 py-2 dark:border-gray-700 sm:px-4 sm:py-3">
        <Avatar username={display.name} avatarColor={display.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {display.name}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {display.isDirect ? 'Direct message' : `${room?.members.length ?? 0} members`}
          </p>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          Loading messages...
        </div>
      ) : (
        <MessageList
          roomId={roomId}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loadingMore={loadingMore}
        />
      )}

      <TypingIndicator roomId={roomId} />

      <MessageInput
        roomId={roomId}
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        disabled={loading}
      />
    </div>
  );
}
