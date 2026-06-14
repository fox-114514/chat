import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useChatStore } from '../store/chatStore';
import { fetchRooms } from '../api/rooms';
import { getApiErrorMessage } from '../api/client';
import AppLayout from '../components/layout/AppLayout';
import ChatWindow from '../components/chat/ChatWindow';

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { setRooms } = useChatStore();

  useSocket();

  useEffect(() => {
    if (!user) return;
    fetchRooms()
      .then((rooms) => setRooms(rooms))
      .catch((err) => {
        console.error('Failed to load rooms:', getApiErrorMessage(err));
      });
  }, [user, setRooms]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  return (
    <AppLayout>
      <ChatWindow />
    </AppLayout>
  );
}
