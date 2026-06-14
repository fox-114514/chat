import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { RoomListItem } from '../../types/models';
import { useChatStore } from '../../store/chatStore';
import Avatar from '../common/Avatar';

interface RoomListProps {
  rooms: RoomListItem[];
  currentUserId: string;
}

function getRoomDisplay(room: RoomListItem, currentUserId: string): {
  name: string;
  avatarColor: string;
  otherUserId?: string;
} {
  if (room.name) {
    return { name: room.name, avatarColor: '#3b82f6' };
  }
  const other = room.members.find((m) => m.userId !== currentUserId);
  return {
    name: other?.username ?? 'Unknown',
    avatarColor: other?.avatarColor ?? '#3b82f6',
    otherUserId: other?.userId,
  };
}

export default function RoomList({ rooms, currentUserId }: RoomListProps) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const messagesByRoom = useChatStore((state) => state.messages);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      // Sort by latest message time if available, otherwise room creation time
      const aMessages = messagesByRoom[a.id] ?? [];
      const bMessages = messagesByRoom[b.id] ?? [];
      const aTime =
        aMessages.length > 0
          ? new Date(aMessages[aMessages.length - 1].createdAt).getTime()
          : new Date(a.createdAt).getTime();
      const bTime =
        bMessages.length > 0
          ? new Date(bMessages[bMessages.length - 1].createdAt).getTime()
          : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [rooms, messagesByRoom]);

  return (
    <div className="h-full overflow-y-auto">
      {sortedRooms.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>No conversations yet</p>
          <p className="mt-1 text-xs">Search users to start a chat</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 dark:divide-gray-800">
          {sortedRooms.map((room) => {
            const display = getRoomDisplay(room, currentUserId);
            const isActive = room.id === roomId;
            const isOnline =
              room.isDirect && display.otherUserId ? onlineUsers.has(display.otherUserId) : false;
            const roomMessages = messagesByRoom[room.id] ?? [];
            const lastMessage = roomMessages.length > 0 ? roomMessages[roomMessages.length - 1] : null;

            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-blue-50/80 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <Avatar
                    username={display.name}
                    avatarColor={display.avatarColor}
                    size="md"
                    isOnline={isOnline}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {display.name}
                      </span>
                      {lastMessage && (
                        <span className="flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500">
                          {formatTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {lastMessage
                          ? lastMessage.type === 'image'
                            ? '📷 Photo'
                            : lastMessage.type === 'file'
                              ? '📎 File'
                              : lastMessage.content
                          : 'No messages yet'}
                      </span>
                      {room.unreadCount > 0 && (
                        <span className="flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
