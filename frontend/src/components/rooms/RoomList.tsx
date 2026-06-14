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

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rooms]);

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedRooms.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No conversations yet
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {sortedRooms.map((room) => {
            const display = getRoomDisplay(room, currentUserId);
            const isActive = room.id === roomId;
            const isOnline =
              room.isDirect && display.otherUserId
                ? onlineUsers.has(display.otherUserId)
                : undefined;
            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/chat/${room.id}`)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <Avatar
                    username={display.name}
                    avatarColor={display.avatarColor}
                    size="sm"
                    isOnline={isOnline}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {display.name}
                      </span>
                      {room.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {room.isDirect ? 'Direct message' : `${room.members.length} members`}
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
