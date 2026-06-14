import { useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useChatStore } from '../../store/chatStore';
import MessageItem from './MessageItem';

interface MessageListProps {
  roomId: string;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}

function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MessageList({
  roomId,
  onLoadMore,
  hasMore,
  loadingMore,
}: MessageListProps) {
  const { user } = useAuth();
  const messages = useChatStore((state) => state.messages[roomId] ?? []);
  const listRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef<number>(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && hasMore && !loadingMore) {
      prevHeightRef.current = target.scrollHeight;
      onLoadMore();
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prevHeightRef.current > 0) {
      const newHeight = el.scrollHeight;
      el.scrollTop = newHeight - prevHeightRef.current;
      prevHeightRef.current = 0;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  if (!user) return null;

  let lastDate: string | null = null;

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-5"
    >
      {hasMore && (
        <div className="py-3 text-center">
          {loadingMore ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
              Loading history...
            </span>
          ) : (
            <button
              type="button"
              onClick={onLoadMore}
              className="text-xs text-gray-400 hover:text-blue-500"
            >
              Load older messages
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        {messages.map((message, index) => {
          const isMe = message.senderId === user.id;
          const prev = messages[index - 1];
          const showAvatar = !prev || prev.senderId !== message.senderId;
          const messageDate = new Date(message.createdAt).toDateString();
          const showDate = messageDate !== lastDate;
          lastDate = messageDate;

          return (
            <div key={message.id}>
              {showDate && (
                <div className="my-4 flex items-center justify-center">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {formatDateLabel(message.createdAt)}
                  </span>
                </div>
              )}
              <div className="py-0.5">
                <MessageItem message={message} isMe={isMe} showAvatar={showAvatar} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
