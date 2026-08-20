import { api } from '@/lib/api';

export const tagsApi = {
  getAll(): Promise<string[]> {
    return api.get<string[]>('/v1/available-tags');
  },
};
