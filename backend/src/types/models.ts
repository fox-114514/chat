export interface User {
  id: string;
  username: string;
  avatarColor: string;
  publicKey: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  public_key: string | null;
  avatar_color: string;
  created_at: Date;
  last_seen_at: Date;
}

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    avatarColor: row.avatar_color,
    publicKey: row.public_key,
    createdAt: row.created_at.toISOString(),
  };
}
