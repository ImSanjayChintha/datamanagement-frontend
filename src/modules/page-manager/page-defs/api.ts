import { post } from '@/core/api';
import type { PageDef } from '@/types/toolkit';

const BASE = '/admin/toolkit/page-defs';

export interface PageDefsListResult {
  rows:      PageDef[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface PageDefsListParams {
  search?:      string;
  nav_section?: string;
  is_active?:   boolean;
  page?:        number;
  page_size?:   number;
}

export const pageDefsApi = {
  list:   (params: PageDefsListParams = {}) =>
    post<PageDefsListResult>(`${BASE}/list`, params),

  get:    (code: string) =>
    post<PageDef>(`${BASE}/get`, { code }),

  upsert: (data: Partial<PageDef> & { code: string; gateway_object: string }) =>
    post<PageDef>(`${BASE}/upsert`, data),

  delete: (id: number) =>
    post<{ deleted: boolean; code: string }>(`${BASE}/delete`, { id }),
};
