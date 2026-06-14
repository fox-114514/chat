import { api } from './client';
import type { Message } from '../types/models';

export interface FetchMessagesOptions {
  before?: string;
  limit?: number;
}

export async function fetchMessages(
  roomId: string,
  options: FetchMessagesOptions = {},
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (options.before) params.set('before', options.before);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  const response = await api.get<{ messages: Message[]; hasMore: boolean }>(
    `/rooms/${roomId}/messages${query ? `?${query}` : ''}`,
  );
  return response.data;
}
