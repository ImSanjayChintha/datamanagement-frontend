/**
 * Module: toolkit/core/api
 * Purpose: Single consolidated API client for all toolkit endpoints.
 *          Import everything from here — no need to reach into sub-folders.
 *
 * Usage:
 *   import { toolkitTablesApi, toolkitAiApi, toolkitDataApi } from '@/modules/toolkit/core/api';
 */

import { post,postBlob } from '@/core/api';
import type { LangOption, TranslationMap } from '@/types/shared';
import type {
  ToolkitSchema,
  ToolkitTable,
  ToolkitTableDetail,
  ToolkitField,
  ToolkitFieldOption,
  DdlLogEntry,
} from '@/types/toolkit';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const toolkitSchemasApi = {
  list: () =>
    post<ToolkitSchema[]>('/admin/toolkit/schemas/list', {}),

  get: (id: number) =>
    post<ToolkitSchema>('/admin/toolkit/schemas/get', { id }),

  create: (data: { name: string; label?: string; description?: string }) =>
    post<ToolkitSchema>('/admin/toolkit/schemas/create', data),
};

// ── Tables ────────────────────────────────────────────────────────────────────

export const toolkitTablesApi = {
  list: (p?: { is_active?: boolean }) =>
    post<ToolkitTable[]>('/admin/toolkit/tables/list', p ?? {}),

  get: (id: number) =>
    post<ToolkitTableDetail>('/admin/toolkit/tables/get', { id }),

  getByCode: (code: string) =>
    post<ToolkitTableDetail>('/admin/toolkit/tables/get', { code }),

  schemaFields: (schemaTable: string) =>
    post<{ fields: ToolkitField[]; options: ToolkitFieldOption[]; schema_table: string }>(
      '/admin/toolkit/tables/schema-fields',
      { schema_table: schemaTable },
    ),

  previewDdl: (table: object, fields: object[]) =>
    post<{ sql: string }>('/admin/toolkit/tables/preview-ddl', { table, fields }),

  ddl: (idOrCode: number | string) =>
    post<{
      table_code:      string;
      sql:             string;
      parts:           { operation: string; sql: string; label?: string }[];
      saved_functions: {
        upsert?: { sql: string; keys: string[] };
        sync?:   { sql: string; keys: string[] };
        delete?: { sql: string; keys: string[] };
      };
    }>(
      '/admin/toolkit/tables/ddl',
      typeof idOrCode === 'number' ? { id: idOrCode } : { code: idOrCode },
    ),

  create: (data: object) =>
    post<ToolkitTableDetail>('/admin/toolkit/tables/create', data),

  update: (data: object) =>
    post<ToolkitTableDetail>('/admin/toolkit/tables/update', data),

  saveTranslations: (data: object) =>
    post<ToolkitTableDetail>('/admin/toolkit/tables/save-translations', data),

  associatedObjects: (id: number) =>
    post<{
      views:     { code: string; schema_name: string }[];
      functions: { code: string; schema_name: string }[];
      apis:      { id: number; name: string; url_path: string; method: string; status: string }[];
      page_defs: { id: number; code: string; title: string }[];
    }>('/admin/toolkit/tables/associated-objects', { id }),

  delete: (id: number) =>
    post<{ deleted: boolean; code: string }>('/admin/toolkit/tables/delete', { id }),

  regenerate: (id: number, objectType?: 'view' | 'function') =>
    post<{ regenerated: boolean }>('/admin/toolkit/tables/regenerate', { id, object_type: objectType }),

  resetObject: (id: number, objectCode: string, objectType: 'view' | 'function') =>
    post<{ sql: string }>('/admin/toolkit/tables/reset-object', { id, object_code: objectCode, object_type: objectType }),

  regenerateAll: () =>
    post<{ success: string[]; failed: { id: number; error: string }[] }>(
      '/admin/toolkit/tables/regenerate-all', {},
    ),

schemaContext: (codes?: string[]) =>
    post<{ tables: object[]; objects: object[]; count: number }>(
      '/admin/toolkit/tables/schema-context',
      codes ? { codes } : {},
    ),
};

export const toolkitExportApi = {
  template: (body: { family_code: string; endpoint: string }) =>
    postBlob('/admin/toolkit/export/template', body),
  data: (body: { family_code: string; endpoint: string }) =>
    postBlob('/admin/toolkit/export/data', body),
};

// ── Fields ────────────────────────────────────────────────────────────────────

export const toolkitFieldsApi = {
  list: (table_id: number) =>
    post<ToolkitField[]>('/admin/toolkit/fields/list', { table_id }),

  create: (data: object) =>
    post<ToolkitField>('/admin/toolkit/fields/create', data),

  update: (data: object) =>
    post<ToolkitField>('/admin/toolkit/fields/update', data),

  reorder: (order: { id: number; sort_order: number }[]) =>
    post<{ reordered: boolean }>('/admin/toolkit/fields/reorder', { order }),

  delete: (id: number) =>
    post<{ deleted: boolean }>('/admin/toolkit/fields/delete', { id }),
};

// ── Options ───────────────────────────────────────────────────────────────────

export const toolkitOptionsApi = {
  list: (field_id: number) =>
    post<ToolkitFieldOption[]>('/admin/toolkit/options/list', { field_id }),

  create: (data: object) =>
    post<ToolkitFieldOption>('/admin/toolkit/options/create', data),

  update: (data: object) =>
    post<ToolkitFieldOption>('/admin/toolkit/options/update', data),

  delete: (id: number) =>
    post<{ deleted: boolean }>('/admin/toolkit/options/delete', { id }),

  reorder: (order: { id: number; sort_order: number }[]) =>
    post<{ reordered: boolean }>('/admin/toolkit/options/reorder', { order }),
};

// ── References ────────────────────────────────────────────────────────────────

export const toolkitRefsApi = {
  get: (field_id: number) =>
    post<object>('/admin/toolkit/references/get', { field_id }),

  upsert: (data: object) =>
    post<object>('/admin/toolkit/references/upsert', data),

  delete: (field_id: number) =>
    post<{ deleted: boolean }>('/admin/toolkit/references/delete', { field_id }),

  options: (field_id: number, search?: string) =>
    post<{ value: string; label: string }[]>(
      '/admin/toolkit/references/options', { field_id, search },
    ),
};

// ── Translations ──────────────────────────────────────────────────────────────

export const toolkitTranslationsApi = {
  languages: () =>
    post<LangOption[]>('/admin/toolkit/translations/available-languages'),
};



// ── Data (generic CRUD) ───────────────────────────────────────────────────────

export const toolkitDataApi = {
  list: (tableCode: string, p: object) =>
    post<object[]>(`/admin/toolkit/data/${tableCode}/list`, p),

  get: (tableCode: string, id: number, lang?: string) =>
    post<object>(`/admin/toolkit/data/${tableCode}/get`, { id, lang }),

  create: (tableCode: string, data: object) =>
    post<object>(`/admin/toolkit/data/${tableCode}/create`, data),

  update: (tableCode: string, data: object) =>
    post<object>(`/admin/toolkit/data/${tableCode}/update`, data),

  delete: (tableCode: string, id: number, soft = true) =>
    post<{ deleted: boolean }>(`/admin/toolkit/data/${tableCode}/delete`, { id, soft }),

  refOpts: (tableCode: string, search?: string) =>
    post<{ value: string; label: string }[]>(
      `/admin/toolkit/data/${tableCode}/ref-options`, { search },
    ),
};

// ── SQL Console ───────────────────────────────────────────────────────────────

export interface ToolkitSavedObject {
  id: number;
  code: string;
  object_type: string;
  schema_name: string;
  label: string;
  description?: string;
  metadata_json?: object;
}

export interface SqlExecResult {
  rows: Record<string, unknown>[];
  count: number;
  truncated?: boolean;
  status?: string;
  saved_object?: ToolkitSavedObject | null;
}


export const toolkitSqlApi = {
  validate: (sql: string) =>
    post<{ valid: boolean; message: string }>('/admin/toolkit/sql/validate', { sql }),

  execute: (sql: string, tableCode?: string, objectMeta?: object) =>
    post<SqlExecResult>('/admin/toolkit/sql/execute', {
      sql,
      table_code:  tableCode,
      object_meta: objectMeta,
    }),

  history: (p?: { table_code?: string; limit?: number }) =>
    post<DdlLogEntry[]>('/admin/toolkit/sql/history', p ?? {}),
};

// ── Toolkit Objects (views, functions, triggers) ──────────────────────────────

export const toolkitObjectsApi = {
  list: (object_type?: string) =>
    post<ToolkitSavedObject[]>(
      '/admin/toolkit/objects/list',
      object_type ? { object_type } : {},
    ),

  get: (id: number) =>
    post<ToolkitSavedObject>('/admin/toolkit/objects/get', { id }),

  create: (data: object) =>
    post<ToolkitSavedObject>('/admin/toolkit/objects/create', data),

  update: (data: object) =>
    post<ToolkitSavedObject>('/admin/toolkit/objects/update', data),

  delete: (id: number) =>
    post<{ deleted: boolean; code: string }>('/admin/toolkit/objects/delete', { id }),

  reapply: (id: number) =>
    post<{ reapplied: boolean; code: string }>('/admin/toolkit/objects/reapply', { id }),
};

// ── AI ────────────────────────────────────────────────────────────────────────

export type AiMode = 'auto' | 'table' | 'view' | 'function';

export interface AiClarifyAnswer {
  clarify_type: 'table_selection' | 'specification';
  selected?: string[];
  specification?: string;
}

export interface AiGenerateSqlBody {
  prompt: string;
  object_type?: 'table' | 'view' | 'function';
  selected_tables?: string[];
  clarify_answer?: AiClarifyAnswer;
}

export interface AiField {
  code: string;
  label: string;
  description?: string;
  field_type: string;
  is_required?: boolean;
  is_unique?: boolean;
  is_multilingual?: boolean;
  config?: Record<string, unknown>;
  default_value?: unknown;
  sort_order?: number;
  options?: { code: string; label: string }[];
  ref_table_code?: string;
}

export interface AiTableResult {
  type: 'table';
  code: string;
  label: string;
  description?: string;
  icon?: string;
  has_label?: boolean;
  fields: AiField[];
}

export interface AiObjectMeta {
  label?: string;
  description?: string;
  metadata_json?: object;
}

export interface AiSqlObjectResult {
  type: 'view' | 'function';
  code: string;
  label: string;
  description?: string;
  schema_name?: string;
  sql: string;
  metadata_json?: object;
  object_id?: number;
  object_code?: string;
}

export interface AiClarifyResult {
  type: 'clarify';
  question: string;
  clarify_type: 'table_selection' | 'specification';
  suggestions: string[];
  allow_multiple: boolean;
  hint?: string;
}

export type AiSqlResult = AiTableResult | AiSqlObjectResult | AiClarifyResult;

export const toolkitAiApi = {
  generateSql: (body: AiGenerateSqlBody) =>
    post<AiSqlResult>('/admin/toolkit/ai/generate-sql', body),

  regenerateSql: (id: number, prompt?: string) =>
    post<AiSqlResult>('/admin/toolkit/ai/regenerate-sql', { id, prompt }),

  translate: (texts: Record<string, string>, source_lang: string, target_langs: string[]) =>
    post<Record<string, Record<string, string>>>(
      '/admin/toolkit/ai/translate', { texts, source_lang, target_langs },
    ),

  suggest: (definition: object) =>
    post<{ suggestions: string[]; missing_fields: object[]; warnings: string[] }>(
      '/admin/toolkit/ai/suggest', { definition },
    ),

  generateTable: (prompt: string, schema_context?: object[]) =>
    post<object>('/admin/toolkit/ai/generate-table', { prompt, schema_context }),
};

// ── Common Fields ─────────────────────────────────────────────────────────────

export interface CommonField {
  id: number;
  code: string;
  sort_order: number;
  field_name: string;
  data_type: string;
  field_role: 'user' | 'log';
  show_translation: boolean;
  default_value: string | null;
  true_label: string | null;
  false_label: string | null;
  is_active: boolean;
  inserted_at: string;
  modified_at: string | null;
}

export const DATA_TYPES: { value: string; label: string; group: string }[] = [
  { value: 'text',        label: 'Text',         group: 'Text'    },
  { value: 'email',       label: 'Email',        group: 'Text'    },
  { value: 'phone',       label: 'Phone',        group: 'Text'    },
  { value: 'url',         label: 'URL',          group: 'Text'    },
  { value: 'color',       label: 'Color',        group: 'Text'    },
  { value: 'number',      label: 'Number',       group: 'Numeric' },
  { value: 'integer',     label: 'Integer',      group: 'Numeric' },
  { value: 'boolean',     label: 'Boolean',      group: 'Other'   },
  { value: 'date',        label: 'Date',         group: 'Other'   },
  { value: 'datetime',    label: 'Date & Time',  group: 'Other'   },
  { value: 'select',      label: 'Select',       group: 'Choice'  },
  { value: 'multiselect', label: 'Multi-select', group: 'Choice'  },
  { value: 'json',        label: 'JSON',         group: 'Other'   },
];

// ── Gateway Runtime ───────────────────────────────────────────────────────────
// Calls registered gateway endpoints at /api/v1/run/<url_path>
// Swagger UI for all gateway endpoints: /api/v1/gateway/docs

export const gatewayRunApi = {
  /** POST to any gateway endpoint (insert / sync / upsert / select via POST). */
  call: <T = object>(urlPath: string, body: object = {}) =>
    post<T>(`/run/${urlPath}`, body),

  /** Swagger UI URL — open in a browser tab to explore and test. */
  docsUrl: '/api/v1/gateway/docs' as const,
};

// ── API Engine ────────────────────────────────────────────────────────────────
// Calls the metadata-driven engine at /api/v1/<schema>/<object>/<action>
// Swagger UI for all engine objects: /api/v1/engine/docs

export const engineApi = {
  list: <T = object>(
    schema: string,
    obj: string,
    p: {
      filter?: object;
      sort?: object[];
      limit?: number;
      skip?: number;
      count?: boolean;
      count_window?: boolean;
      locale?: string;
    } = {},
  ) =>
    post<{ ok: boolean; rows: T[]; skip: number; limit: number; record_count?: number; total?: number }>(
      `/${schema}/${obj}/list`,
      p,
    ),

  get: <T = object>(schema: string, obj: string, filter: object) =>
    post<{ ok: boolean; data: T }>(
      `/${schema}/${obj}/get`,
      { filter },
    ),

  insert: <T = object>(schema: string, obj: string, data: object | object[]) =>
    post<{ ok: boolean; data: T; count?: number }>(
      `/${schema}/${obj}/insert`,
      { data },
    ),

  update: (schema: string, obj: string, filter: object, data: object, expected?: number) =>
    post<{ ok: boolean; affected: number; data: object[] }>(
      `/${schema}/${obj}/update`,
      { filter, data, ...(expected !== undefined ? { expected } : {}) },
    ),

  delete: (schema: string, obj: string, filter: object, expected?: number) =>
    post<{ ok: boolean; affected: number }>(
      `/${schema}/${obj}/delete`,
      { filter, ...(expected !== undefined ? { expected } : {}) },
    ),

  /** Call any custom action registered in the object's actions config. */
  custom: <T = object>(schema: string, obj: string, action: string, body: object = {}) =>
    post<T>(`/${schema}/${obj}/${action}`, body),

  /** Swagger UI URL — open in a browser tab to explore and test. */
  docsUrl: '/api/v1/engine/docs' as const,
};

export const commonFieldsApi = {
  list: (p?: {
    search?: string;
    is_active?: boolean;
    field_role?: 'user' | 'log';
    limit?: number;
    skip?: number;
  }) => post<CommonField[]>('/admin/toolkit/common-fields/list', p ?? {}),

  get: (id: number) =>
    post<CommonField>('/admin/toolkit/common-fields/get', { id }),

  create: (data: Omit<CommonField, 'id' | 'inserted_at' | 'modified_at'>) =>
    post<CommonField>('/admin/toolkit/common-fields/create', data),

  update: (id: number, data: Partial<Omit<CommonField, 'id' | 'inserted_at' | 'modified_at'>>) =>
    post<CommonField>('/admin/toolkit/common-fields/update', { id, ...data }),

  delete: (id: number, soft = true) =>
    post<{ deleted: boolean; id: number }>('/admin/toolkit/common-fields/delete', { id, soft }),

  getTranslations: () =>
    post<Record<string, Record<string, string>>>('/admin/toolkit/common-fields/translations/get', {}),

  saveTranslations: (translations: Record<string, Record<string, string>>) =>
    post<{ saved: boolean }>('/admin/toolkit/common-fields/translations/save', { translations }),
};
