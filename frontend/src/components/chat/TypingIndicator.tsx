import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../auth/AuthContext';

interface TypingIndicatorProps {
  roomId: string;
}

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const { user } = useAuth();
  const typingList = useChatStore((state) => state.typing[roomId] ?? []);
  const active = typingList.filter((t) => t.userId !== user?.id && t.isTyping);

  if (active.length === 0) return null;

  const names = active.map((t) => {
    const member = useChatStore
      .getState()
      .rooms.find((r) => r.id === roomId)
      ?.members.find((m) => m.userId === t.userId);
    return member?.username ?? 'Someone';
  });

  const text = names.length === 1 ? `${names[0]} is typing...` : `${names.join(', ')} are typing...`;

  return (
    <div className="px-4 py-1 text-xs text-gray-500 dark:text-gray-400">
      {text}
    </div>
  );
}
