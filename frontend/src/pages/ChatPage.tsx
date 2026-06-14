import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useChatStore } from '../store/chatStore';
import { fetchRooms } from '../api/rooms';
import { getApiErrorMessage } from '../api/client';
import AppLayout from '../components/layout/AppLayout';
import ChatWindow from '../components/chat/ChatWindow';
import RoomList from '../components/rooms/RoomList';
import RoomActions from '../components/rooms/RoomActions';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { setRooms, rooms } = useChatStore();

  useSocket();

  useEffect(() => {
    if (!user) return;
    fetchRooms()
      .then((fetched) => setRooms(fetched))
      .catch((err) => {
        console.error('Failed to load rooms:', getApiErrorMessage(err));
      });
  }, [user, setRooms]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  // Mobile: /chat shows full-screen room list
  if (!roomId) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col md:hidden">
          <MobileRoomListHeader />
          <div className="flex-1 overflow-hidden">
            <RoomList rooms={rooms} currentUserId={user.id} />
          </div>
        </div>
        <div className="hidden h-full flex-col items-center justify-center md:flex">
          <EmptyState />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ChatWindow />
    </AppLayout>
  );
}

function MobileRoomListHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Messages</p>
          <p className="text-xs text-green-500">Online</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RoomActions currentUserId={user.id} compact />
        <button
          type="button"
          onClick={logout}
          className="text-xs font-medium text-gray-500 hover:text-red-500 dark:text-gray-400"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
        <MessageSquare className="h-8 w-8 text-blue-500" />
      </div>
      <p className="text-gray-500 dark:text-gray-400">Select a conversation to start chatting</p>
    </div>
  );
}
