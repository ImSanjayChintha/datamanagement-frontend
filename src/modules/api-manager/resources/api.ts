import { post } from '@/core/api';
import type { ApiResource, TestConnectionResult } from '@/types/apiBridge';

export interface ResourcesPage {
  rows:      ApiResource[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export const apiBridgeResourcesApi = {
  list: (p?: { is_active?: boolean; search?: string; page?: number; page_size?: number }) =>
    post<ResourcesPage>('/admin/api-bridge/resources/list', p ?? {}),

  get: (id: number) =>
    post<ApiResource>('/admin/api-bridge/resources/get', { id }),

  create: (data: Record<string, unknown>) =>
    post<ApiResource>('/admin/api-bridge/resources/create', data),

  update: (id: number, data: Record<string, unknown>) =>
    post<ApiResource>('/admin/api-bridge/resources/update', { id, ...data }),

  delete: (id: number) =>
    post<{ deleted: boolean }>('/admin/api-bridge/resources/delete', { id }),

  testConnection: (id: number) =>
    post<TestConnectionResult>('/admin/api-bridge/resources/test-connection', { id }),
};
