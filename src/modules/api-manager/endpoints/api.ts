import { post } from '@/core/api';
import type { ApiEndpoint, DbObject, DbColumn, FunctionDef } from '@/types/gateway';

export interface EndpointsListResult {
  rows:      ApiEndpoint[];
  total:     number;
  page:      number;
  page_size: number;
  pages:     number;
}

export interface EndpointsListParams {
  search?:    string;
  status?:    string;
  page?:      number;
  page_size?: number;
}

export interface ObjectDef {
  type:        'function' | 'view' | 'table';
  definition:  string | null;
  return_type: string | null;
  arguments:   string | null;
  source:      string | null;
  columns:     Array<{ name: string; type: string; nullable: boolean }> | null;
}

export const endpointsApi = {
  list:      (p?: EndpointsListParams)             => post<EndpointsListResult>('/gateway/endpoints/list', p ?? {}),
  get:       (id: number)                          => post<ApiEndpoint>('/gateway/endpoints/get', { id }),
  create:    (data: Partial<ApiEndpoint>)          => post<ApiEndpoint>('/gateway/endpoints/create', data),
  update:    (id: number, data: Partial<ApiEndpoint>) => post<ApiEndpoint>('/gateway/endpoints/update', { id, ...data }),
  delete:    (id: number)                          => post<{ deleted: boolean }>('/gateway/endpoints/delete', { id }),
  setStatus:              (id: number, status: string) => post<ApiEndpoint>('/gateway/endpoints/set-status', { id, status }),
  setupTranslations:      (schema: string)              => post<{ schema: string; table: string; created: boolean }>('/gateway/endpoints/schema/setup-translations', { schema }),
};

export interface TableDataResult {
  rows:    Record<string, unknown>[];
  total:   number;
  columns: string[];
}

export interface ServiceDef {
  name:        string;
  description: string;
}

export const gatewayServicesApi = {
  list: () => post<ServiceDef[]>('/gateway/services/list'),
};

export const schemaBrowserApi = {
  schemas:     ()                                                  => post<string[]>('/gateway/schema/schemas'),
  objects:     (schema: string)                                    => post<DbObject[]>('/gateway/schema/objects', { schema }),
  columns:     (schema: string, object: string, type?: string)     => post<DbColumn[]>('/gateway/schema/columns', { schema, object, type }),
  functionDef: (schema: string, name: string)                      => post<FunctionDef | null>('/gateway/schema/function-def', { schema, name }),
  objectDef:   (schema: string, name: string, type: string)        => post<ObjectDef | null>('/gateway/schema/object-def', { schema, name, type }),
  tableData:   (schema: string, table: string, page: number, limit: number, filters: Record<string, string>) =>
    post<TableDataResult>('/gateway/schema/table-data', { schema, table, page, limit, filters }),
};
