import { LogOut } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useChatStore } from '../../store/chatStore';
import RoomList from '../rooms/RoomList';
import RoomActions from '../rooms/RoomActions';
import Avatar from '../common/Avatar';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { rooms } = useChatStore();

  if (!user) return null;

  return (
    <aside className="hidden h-full w-72 flex-col border-r border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 md:flex lg:w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <Avatar username={user.username} avatarColor={user.avatarColor} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {user.username}
            </p>
            <p className="text-xs text-green-500">Online</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="border-b border-gray-100 p-3 dark:border-gray-800">
        <RoomActions currentUserId={user.id} />
      </div>

      {/* Room list */}
      <RoomList rooms={rooms} currentUserId={user.id} />
    </aside>
  );
}
