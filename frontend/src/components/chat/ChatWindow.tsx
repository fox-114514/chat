import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { ArrowLeft, Phone, Video } from 'lucide-react';
import type { Room, Message } from '../../types/models';

const DEFAULT_LIMIT = 20;

export default function ChatWindow() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
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
      <div className="hidden h-full flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 md:flex">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-8 w-8 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white/90 px-3 py-2 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-300 dark:hover:bg-gray-800"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <Avatar username={display.name} avatarColor={display.avatarColor} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {display.name}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {display.isDirect ? 'Online' : `${room?.members.length ?? 0} members`}
          </p>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Voice call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Video call"
          >
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
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
