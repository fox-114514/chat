import { useState } from 'react';
import { LogOut, Plus, Search, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useChatStore } from '../../store/chatStore';
import { searchUsers } from '../../api/users';
import { createRoom, getOrCreateDirectRoom } from '../../api/rooms';
import { getApiErrorMessage } from '../../api/client';
import RoomList from '../rooms/RoomList';
import Avatar from '../common/Avatar';
import type { User } from '../../types/models';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { rooms, setRooms } = useChatStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const users = await searchUsers(q);
      setSearchResults(users);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSearchLoading(false);
    }
  }

  async function startDirect(otherUser: User) {
    setError(null);
    try {
      const room = await getOrCreateDirectRoom(otherUser.id);
      useChatStore.getState().upsertRoom(room);
      setSearchOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomName.trim() || selectedMemberIds.length === 0) {
      setError('Room name and at least one member are required');
      return;
    }
    try {
      const room = await createRoom({ name: roomName.trim(), memberIds: selectedMemberIds });
      useChatStore.getState().upsertRoom(room);
      setRooms([{ ...room, unreadCount: 0 }, ...rooms]);
      setCreateOpen(false);
      setRoomName('');
      setSelectedMemberIds([]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

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
      <div className="flex items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Search className="h-4 w-4" />
          Search users
        </button>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-blue-500 p-2.5 text-white shadow-sm shadow-blue-500/20 hover:bg-blue-600"
          title="New group"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Room list */}
      <RoomList rooms={rooms} currentUserId={user.id} />

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Start chat</h3>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setError(null);
                }}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by username..."
              autoFocus
              className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {searchLoading && <p className="text-xs text-gray-500">Searching...</p>}
            <ul className="max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => startDirect(u)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Avatar username={u.username} avatarColor={u.avatarColor} size="sm" />
                    <span className="text-sm text-gray-900 dark:text-white">{u.username}</span>
                  </button>
                </li>
              ))}
              {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <li className="px-2 py-2 text-sm text-gray-500">No users found</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Create room modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">New group</h3>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setRoomName('');
                  setSelectedMemberIds([]);
                  setError(null);
                }}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Group name"
              className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="mb-3">
              <UserSelect selectedIds={selectedMemberIds} onChange={setSelectedMemberIds} />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600"
            >
              Create
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

function UserSelect({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const results = await searchUsers(q);
      setUsers(results);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleUser(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search members..."
        className="mb-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      />
      {loading && <p className="text-xs text-gray-500">Searching...</p>}
      <ul className="max-h-40 overflow-y-auto">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => toggleUser(u.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(u.id)}
                readOnly
                className="h-4 w-4 rounded border-gray-300"
              />
              <Avatar username={u.username} avatarColor={u.avatarColor} size="sm" />
              <span className="text-sm text-gray-900 dark:text-white">{u.username}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
