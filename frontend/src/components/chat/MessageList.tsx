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

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-2 pb-4 sm:p-4"
    >
      {hasMore && (
        <div className="py-2 text-center text-xs text-gray-500">
          {loadingMore ? 'Loading...' : 'Scroll up to load more'}
        </div>
      )}
      <div className="space-y-3 sm:space-y-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} isMe={message.senderId === user.id} />
        ))}
      </div>
    </div>
  );
}
