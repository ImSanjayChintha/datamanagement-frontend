/**
 * Module: pim/api
 * All PIM data access goes through here — pages never call apiClient directly.
 *
 * Reads:  gateway run endpoints  → POST /api/v1/run/gateway/{object}/list
 * Writes: gateway run endpoints  → POST /api/v1/run/gateway/{object}/upsert|delete
 * Meta:   toolkitTablesApi       → /admin/toolkit/tables/get
 *
 * Uses apiClient.post directly (not the post() helper) — gateway endpoints return
 * varied shapes and do not always wrap in { success, data }.
 *
 * List endpoint contract (call_jsonb_function in executor.py):
 *   list  → body: { filters: {}, sort: [], lang: "en", limit: N, offset: N }
 *   get   → same as list with filters: { id } and limit: 1
 *
 * Write endpoint contract (execute_function_write in executor.py):
 *   upsert → body: { data: { ...fields } }   → fn(p_data => $1::jsonb, p_audit_user => $2)
 *   delete → body: { filters: { id } }       → fn(p_filter => $1::jsonb, p_audit_user => $2)
 *
 * IDs may be integer (brands) or UUID string (attributes, categories).
 */

import { apiClient } from '@/core/api';
import { toolkitTablesApi } from '@/modules/toolkit/core/api';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';

const GW = (path: string) => `/run/${path}`;

// ── Response helpers ──────────────────────────────────────────────────────────

function extractRows(body: Record<string, unknown>): Record<string, unknown>[] {
  const data = (body.data ?? body) as unknown;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.rows)) return obj.rows as Record<string, unknown>[];
  return [];
}

function extractTotal(body: Record<string, unknown>, rows: unknown[]): number {
  if (typeof body.total === 'number') return body.total;
  const d = body.data as Record<string, unknown> | undefined;
  if (d && typeof d.total === 'number') return d.total;
  return (rows as unknown[]).length;
}

// ── Generic builder so each entity needs minimal code ─────────────────────────

interface EntityEndpoints {
  list?:   string;   // url_path or resource code for list/get
  upsert?: string;   // url_path or resource code for upsert
  delete?: string;   // url_path or resource code for delete
}

// Resolves either a full url_path (e.g. /run/gateway/attributes/list) or a plain
// resource code (e.g. attributes) into the gateway path segment used by GW().
function toGwPath(urlPathOrResource: string, operation: string): string {
  const parts = urlPathOrResource.split('/').filter(Boolean);
  const gwIdx = parts.indexOf('gateway');
  if (gwIdx !== -1 && parts[gwIdx + 1]) {
    return `gateway/${parts[gwIdx + 1]}/${operation}`;
  }
  return `gateway/${urlPathOrResource}/${operation}`;
}

export function makeEntityApi(
  object: string,
  tableCode: string,
  endpoints: EntityEndpoints = {},
) {
  const listPath   = toGwPath(endpoints.list   || object, 'list');
  const upsertPath = toGwPath(endpoints.upsert || object, 'upsert');
  const deletePath = toGwPath(endpoints.delete || object, 'delete');

  // Normalise meta result shape regardless of source (toolkit registry vs DB introspection)
  interface TableMeta { has_label: boolean; fields: ToolkitField[]; options: ToolkitFieldOption[] }

  // Always use getByCode with the plain table name — all tables live in the toolkit
  // registry and getByCode is the only source that returns inline_select options.
  const plainTableCode = tableCode.includes('.') ? tableCode.split('.').pop()! : tableCode;
  const meta = (): Promise<TableMeta> =>
    toolkitTablesApi.getByCode(plainTableCode).then(r => ({
      has_label: r.has_label,
      fields:    r.fields,
      options:   r.options,
    }));

  return {
    meta,

    list: async (p: {
      filters?: Record<string, unknown>;
      sort?:    { field: string; direction: 'asc' | 'desc' }[];
      limit?:   number;
      offset?:  number;
    } = {}) => {
      const body: Record<string, unknown> = {
        filters: p.filters ?? {},
        limit:   p.limit ?? 25,
        offset:  p.offset ?? 0,
      };
      if (p.sort?.length) body.sort = p.sort;
      const res = await apiClient.post<Record<string, unknown>>(
        GW(listPath),
        body,
      );
      const rows  = extractRows(res.data);
      const total = extractTotal(res.data, rows);
      return { rows, total };
    },

    get: async (id: string | number, opts: { raw_i18n?: boolean } = {}) => {
      const res = await apiClient.post<Record<string, unknown>>(
        GW(listPath),
        { filters: { id }, limit: 1, offset: 0, ...(opts.raw_i18n ? { raw_i18n: true } : {}) },
      );
      const rows = extractRows(res.data);
      return (rows[0] ?? {}) as Record<string, unknown>;
    },

    upsert: async (data: Record<string, unknown>) => {
      const res = await apiClient.post<Record<string, unknown>>(
        GW(upsertPath),
        { data },
      );
      return res.data;
    },

    delete: async (id: string | number) => {
      const res = await apiClient.post<Record<string, unknown>>(
        GW(deletePath),
        { filters: { id } },
      );
      return res.data;
    },
  };
}

// ── PIM entities ──────────────────────────────────────────────────────────────

export const pimAttributesApi = makeEntityApi('attributes', 'attributes');

export const pimBrandsApi      = makeEntityApi('brands',      'brands');
export const pimCategoriesApi  = makeEntityApi('categories',  'categories');

// ── Future PIM entities: add one line each ─────────────────────────────────────
export const pimProductsApi  = makeEntityApi('products',         'products');
export const pimVariantsApi  = makeEntityApi('product_variants', 'product_variants');
