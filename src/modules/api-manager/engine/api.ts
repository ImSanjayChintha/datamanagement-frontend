import { apiClient } from '@/core/api';

export interface EngineObject {
  code: string;
  api_slug: string | null;
  schema_name: string;
  object_name: string;
  name: Record<string, string>;
  kind: string;
  sort_order: number;
}

interface MetaListResponse {
  ok: boolean;
  objects: EngineObject[];
}

export const engineApi = {
  listObjects: async (): Promise<EngineObject[]> => {
    const res = await apiClient.post<MetaListResponse>('/meta', { list: true });
    if (!res.data.ok) throw new Error('Failed to load engine objects');
    return res.data.objects;
  },
};
