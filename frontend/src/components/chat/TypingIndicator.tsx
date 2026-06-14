import { useAuth } from '../../auth/AuthContext';
import { useChatStore } from '../../store/chatStore';

interface TypingIndicatorProps {
  roomId: string;
}

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const { user } = useAuth();
  const typingList = useChatStore((state) => state.typing[roomId] ?? []);
  const rooms = useChatStore((state) => state.rooms);

  const active = typingList.filter((t) => t.userId !== user?.id && t.isTyping);
  if (active.length === 0) return null;

  const names = active.map((t) => {
    const member = rooms.find((r) => r.id === roomId)?.members.find((m) => m.userId === t.userId);
    return member?.username ?? 'Someone';
  });

  const text = names.length === 1 ? `${names[0]} is typing` : `${names.join(', ')} are typing`;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
      <span className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  );
}
