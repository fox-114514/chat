import { api } from './client';
import type { User } from '../types/models';

export async function searchUsers(query: string): Promise<User[]> {
  const response = await api.get<{ users: User[] }>('/users', {
    params: { q: query },
  });
  return response.data.users;
}
