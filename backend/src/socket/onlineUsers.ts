const onlineUsers = new Map<string, Set<string>>();

export function addSocket(userId: string, socketId: string): boolean {
  const set = onlineUsers.get(userId) ?? new Set<string>();
  const wasEmpty = set.size === 0;
  set.add(socketId);
  onlineUsers.set(userId, set);
  return wasEmpty;
}

export function removeSocket(userId: string, socketId: string): boolean {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function clearAll(): void {
  onlineUsers.clear();
}
