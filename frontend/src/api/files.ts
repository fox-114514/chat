import { api } from './client';
import type { FileMeta } from '../types/models';

export async function uploadFile(file: File): Promise<FileMeta> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<{ file: FileMeta }>('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.file;
}
