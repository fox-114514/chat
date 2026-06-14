import { useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { searchUsers } from '../../api/users';
import { createRoom, getOrCreateDirectRoom } from '../../api/rooms';
import { getApiErrorMessage } from '../../api/client';
import Avatar from '../common/Avatar';
import type { User } from '../../types/models';

interface RoomActionsProps {
  currentUserId: string;
  onStartDirect?: () => void;
  compact?: boolean;
}

export default function RoomActions({ currentUserId, onStartDirect, compact }: RoomActionsProps) {
  const { rooms, setRooms, upsertRoom } = useChatStore();
  const [mode, setMode] = useState<'closed' | 'search' | 'create'>('closed');
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  // Create group state
  const [roomName, setRoomName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createQuery, setCreateQuery] = useState('');
  const [createResults, setCreateResults] = useState<User[]>([]);
  const [createSearching, setCreateSearching] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const users = await searchUsers(q);
      setResults(users);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateSearch(q: string) {
    setCreateQuery(q);
    if (q.length < 2) {
      setCreateResults([]);
      return;
    }
    setCreateSearching(true);
    try {
      const users = await searchUsers(q);
      setCreateResults(users);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setCreateSearching(false);
    }
  }

  async function startDirect(user: User) {
    setError(null);
    try {
      const room = await getOrCreateDirectRoom(user.id);
      upsertRoom(room);
      closeAll();
      onStartDirect?.();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomName.trim()) {
      setError('Please enter a group name');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Please select at least one member');
      return;
    }
    try {
      const room = await createRoom({ name: roomName.trim(), memberIds: selectedIds });
      upsertRoom(room);
      setRooms([{ ...room, unreadCount: 0 }, ...rooms]);
      closeAll();
      onStartDirect?.();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  function closeAll() {
    setMode('closed');
    setError(null);
    setQuery('');
    setResults([]);
    setRoomName('');
    setSelectedIds([]);
    setCreateQuery('');
    setCreateResults([]);
  }

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <>
      {compact ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('search')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm shadow-blue-500/20 hover:bg-blue-600"
            aria-label="New chat"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            aria-label="New group"
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('search')}
            className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Search className="h-4 w-4" />
            Search users
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="rounded-lg bg-blue-500 p-2.5 text-white shadow-sm shadow-blue-500/20 hover:bg-blue-600"
            aria-label="New group"
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      )}

      {mode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {mode === 'search' ? 'New chat' : 'New group'}
              </h3>
              <button
                type="button"
                onClick={closeAll}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </div>
            )}

            {mode === 'search' && (
              <>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by username..."
                  autoFocus
                  className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                {searching && <p className="text-xs text-gray-500">Searching...</p>}
                <ul className="max-h-60 overflow-y-auto">
                  {results.map((u) => (
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
                  {!searching && query.length >= 2 && results.length === 0 && (
                    <li className="px-2 py-2 text-sm text-gray-500">No users found</li>
                  )}
                </ul>
              </>
            )}

            {mode === 'create' && (
              <form onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Group name"
                  className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  value={createQuery}
                  onChange={(e) => handleCreateSearch(e.target.value)}
                  placeholder="Search members..."
                  className="mb-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                {createSearching && <p className="mb-2 text-xs text-gray-500">Searching...</p>}
                <ul className="mb-3 max-h-40 overflow-y-auto">
                  {createResults
                    .filter((u) => u.id !== currentUserId)
                    .map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => toggleMember(u.id)}
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
                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  Create group
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
