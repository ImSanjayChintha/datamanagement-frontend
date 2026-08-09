import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Plus, Trash2, Copy, Check, Key, Shield, FileText, X,
  SlidersHorizontal, AlignLeft, Filter, Columns, ChevronDown,
  AlertCircle, List as ListIcon, Pencil, Zap,
} from 'lucide-react';
import { QK } from '@/lib/queryKeys';
import { endpointsApi, schemaBrowserApi, gatewayServicesApi } from './api';
import type { ServiceDef } from './api';
import { engineApi, type EngineObject } from '@/modules/api-manager/engine/api';
import { apiBridgeResourcesApi } from '@/modules/api-manager/resources/api';
import type { ApiResource, AuthType } from '@/types/apiBridge';
import type { HttpMethod, EndpointStatus, OperationType } from '@/types/gateway';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HeaderRow  { name: string; value: string }
interface FilterRow  { column: string; label: string; operators: string[] }
interface ExtraField { key: string; type: 'static' | 'field'; value: string }
interface DbColMeta  { name: string; type: string; nullable: boolean }
type EngineAction = 'list' | 'insert' | 'update' | 'delete';
type TabId = 'request' | 'response' | 'query' | 'auth';

interface FormState {
  name:               string;
  url_path:           string;
  method:             HttpMethod;
  operation_type:     OperationType | '';
  engine_action:      EngineAction;
  resource_code:      string;
  description:        string;
  status:             EndpointStatus;
  db_schema:          string;
  db_object:          string;
  db_type:            string;
  headers:            HeaderRow[];
  body_schema:        string;
  filters:            FilterRow[];
  columns:            string[];
  response_key:       string;
  pagination_enabled: boolean;
  default_limit:      number;
  max_limit:          number;
  include_total:      boolean;
  count_limit:        number;
  response_extras:     ExtraField[];
  service_response:    string;
  config_returns:      string;
  config_raw_response: boolean;
  sort_fields:         { field: string; direction: 'asc' | 'desc' }[];
  filter_fields:       string[];
  static_filters:      { field: string; value: string }[];
}

const EMPTY: FormState = {
  name: '', url_path: '', method: 'GET', operation_type: '',
  engine_action: 'list', resource_code: '',
  description: '', status: 'draft',
  db_schema: '', db_object: '', db_type: '',
  headers: [], body_schema: '{}', filters: [],
  columns: [], response_key: 'rows',
  pagination_enabled: true, default_limit: 20, max_limit: 100,
  include_total: false, count_limit: 10000, response_extras: [],
  service_response: '{}',
  config_returns: '', config_raw_response: false,
  sort_fields: [], filter_fields: [], static_filters: [],
};

// ── Constants ─────────────────────────────────────────────────────────────────

const METHOD_PILL: Record<HttpMethod, string> = {
  GET:    'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  POST:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  PUT:    'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  PATCH:  'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  DELETE: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

// Border color for the method select wrapper — matches method brand color
const METHOD_SELECT_BORDER: Record<HttpMethod, string> = {
  GET:    'border-emerald-300 dark:border-emerald-700',
  POST:   'border-blue-300 dark:border-blue-700',
  PUT:    'border-orange-300 dark:border-orange-700',
  PATCH:  'border-amber-300 dark:border-amber-700',
  DELETE: 'border-red-300 dark:border-red-700',
};

// Badge chip inside the select for the method label
const METHOD_SELECT_BADGE: Record<HttpMethod, string> = {
  GET:    'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  POST:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  PUT:    'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  PATCH:  'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  DELETE: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
};

type IconComponent = React.FC<{ size?: number; className?: string }> | React.ForwardRefExoticComponent<React.RefAttributes<SVGSVGElement> & { size?: number | string; className?: string }>;


const METHODS: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE'];

const ENGINE_ACTIONS: EngineAction[] = ['list', 'insert', 'update', 'delete'];

const ACTION_LABEL: Record<EngineAction, string> = {
  list: 'List', insert: 'Insert', update: 'Update', delete: 'Delete',
};

const ACTION_DEFAULT_METHOD: Record<EngineAction, HttpMethod> = {
  list: 'GET', insert: 'POST', update: 'PATCH', delete: 'DELETE',
};

const METHOD_ALLOWED_ACTIONS: Record<HttpMethod, EngineAction[]> = {
  GET:    ['list'],
  POST:   ['insert', 'list', 'update', 'delete'],
  PUT:    ['insert', 'update'],
  PATCH:  ['update'],
  DELETE: ['delete'],
};

const ACTION_OP_MAP: Record<EngineAction, OperationType> = {
  list: 'select', insert: 'insert', update: 'update', delete: 'delete',
};

const FORM_TABS: { id: TabId; label: string; Icon: IconComponent }[] = [
  { id: 'request',  label: 'Request',  Icon: FileText },
  { id: 'response', label: 'Response', Icon: AlignLeft },
  { id: 'query',    label: 'Query',    Icon: SlidersHorizontal },
  { id: 'auth',     label: 'Auth',     Icon: Shield },
];

const OPERATOR_GROUPS = [
  { label: 'Equality',   ops: [{ value: 'eq', label: '= eq' },  { value: 'ne',      label: '≠ ne'     }] },
  { label: 'Comparison', ops: [{ value: 'lt', label: '< lt' },  { value: 'lte',     label: '≤ lte'    },
                                { value: 'gt', label: '> gt' },  { value: 'gte',     label: '≥ gte'    }] },
  { label: 'Text',       ops: [{ value: 'like', label: '~ like' }, { value: 'ilike', label: '~* ilike' }] },
  { label: 'Special',    ops: [{ value: 'in', label: '∈ in' },  { value: 'is_null', label: '∅ is null' }] },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function pgType(dbType: string): string {
  const raw = (dbType ?? '').toLowerCase();
  // Handle array types: text[] → text (mapped) then append []
  const isArray = raw.endsWith('[]');
  const t = isArray ? raw.slice(0, -2) : raw;

  let base: string;
  if (t.startsWith('bigint') || t.startsWith('int8'))             base = 'bigint';
  else if (t === 'bigserial' || t === 'serial8')                  base = 'bigserial';
  else if (t === 'serial' || t === 'serial4')                     base = 'serial';
  else if (t === 'smallserial' || t === 'serial2')                base = 'smallserial';
  else if (t.startsWith('int') || t.startsWith('smallint'))       base = 'integer';
  else if (t.includes('bool'))                                     base = 'boolean';
  else if (t.includes('numeric') || t.includes('decimal'))        base = 'numeric';
  else if (/float|double|real/.test(t))                           base = 'numeric';
  else if (t.includes('jsonb'))                                    base = 'jsonb';
  else if (t.includes('json'))                                     base = 'jsonb';
  else if (t.includes('uuid'))                                     base = 'uuid';
  else if (t.includes('timestamptz') || t.includes('timestamp with time zone')) base = 'timestamptz';
  else if (t.includes('timestamp'))                                base = 'timestamp';
  else if (t.includes('date'))                                     base = 'date';
  else if (t.includes('time'))                                     base = 'time';
  else if (t.startsWith('varchar') || t.startsWith('char'))       base = 'text';
  else if (t === 'text' || t === 'name')                          base = 'text';
  else                                                             base = t || 'text'; // enums, domains — pass through intact

  return isArray ? `${base}[]` : base;
}

// Parse column definitions from the `AS alias(col type, ...)` clause of jsonb_to_recordset calls.
// This extracts the exact request fields the function accepts.
function parseJtrFields(source: string): DbColMeta[] | null {
  // Match: ) as alias( ... ) — the recordset alias column list
  const m = source.match(/\)\s+as\s+\w+\s*\(([^)]+)\)/is);
  if (!m) return null;
  const cols = m[1].trim().split(',')
    .map(f => {
      const m2 = f.trim().match(/^"?(\w+)"?\s+(.+)$/);
      if (!m2) return null;
      return { name: m2[1], type: m2[2].trim(), nullable: true };
    })
    .filter(Boolean) as DbColMeta[];
  return cols.length > 0 ? cols : null;
}

// Parse a PostgreSQL function argument list from pg_get_function_arguments() output.
// Handles DEFAULT values with commas/quotes/parens, strips OUT/INOUT params.
// Returns { param_name: normalised_pg_type } in declaration order.
function parseFnArguments(argsStr: string): Record<string, string> {
  if (!argsStr?.trim()) return {};
  const result: Record<string, string> = {};

  // Split at top-level commas (ignore commas inside quotes or parens)
  const parts: string[] = [];
  let depth = 0, start = 0, inSingleQuote = false;
  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (ch === "'" ) inSingleQuote = !inSingleQuote;
    else if (!inSingleQuote && ch === '(') depth++;
    else if (!inSingleQuote && ch === ')') depth--;
    else if (!inSingleQuote && depth === 0 && ch === ',') {
      parts.push(argsStr.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(argsStr.slice(start).trim());

  for (const part of parts) {
    if (!part) continue;
    // Strip leading parameter mode (IN / OUT / INOUT / VARIADIC)
    const cleaned = part.replace(/^(?:IN|OUT|INOUT|VARIADIC)\s+/i, '').trim();
    // Only IN params contribute to the call signature
    if (/^OUT\s+/i.test(part)) continue;
    // Slice off DEFAULT clause
    const defaultIdx = cleaned.search(/\s+DEFAULT\s+/i);
    const nameAndType = (defaultIdx >= 0 ? cleaned.slice(0, defaultIdx) : cleaned).trim();
    const spaceIdx = nameAndType.search(/\s+/);
    if (spaceIdx < 0) continue;
    const name = nameAndType.slice(0, spaceIdx).replace(/^"|"$/g, '');
    const type = nameAndType.slice(spaceIdx).trim();
    if (name && type) result[name] = pgType(type);
  }
  return result;
}

// Parse return keys from `RETURN jsonb_build_object('k1', v1, 'k2', v2, ...)`.
// Keys are at even-indexed positions in the depth-tracked token list.
// Uses the same depth-tracking walk as parseFnArguments to handle commas inside
// nested parens/function calls (e.g. coalesce(v_ok, false)).
function parseFnReturnKeys(source: string): string[] | null {
  const m = source.match(/return\s+jsonb_build_object\s*\(\s*([^]*?)\s*\)\s*;/i);
  if (!m) return null;
  const inner = m[1];

  // Split at top-level commas (depth-tracked, ignoring commas in quotes/parens)
  const parts: string[] = [];
  let depth = 0, start = 0, inSingleQuote = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'") inSingleQuote = !inSingleQuote;
    else if (!inSingleQuote && ch === '(') depth++;
    else if (!inSingleQuote && ch === ')') depth--;
    else if (!inSingleQuote && depth === 0 && ch === ',') {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());

  const keys: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const km = parts[i].match(/^'([^']+)'$/);
    if (km) keys.push(km[1]);
  }
  return keys.length > 0 ? keys : null;
}

const _AUDIT_COLS  = new Set([
  'id',
  'inserted_at', 'modified_at', 'inserted_by', 'modified_by',
  'created_at',  'updated_at',  'created_by',  'updated_by',
]);
const _AUDIT_ORDER = [
  'inserted_at', 'inserted_by', 'modified_at', 'modified_by',
  'created_at',  'created_by',  'updated_at',  'updated_by',
];
// Values to inject for each known audit column instead of reading from the payload
const _AUDIT_VALUE: Record<string, string> = {
  inserted_at: 'NOW()', modified_at: 'NOW()',
  created_at:  'NOW()', updated_at:  'NOW()',
  inserted_by: 'audit_user', modified_by: 'audit_user',
  created_by:  'audit_user', updated_by:  'audit_user',
};

function buildBulkInsertDDL(form: FormState, dbCols: DbColMeta[]): string {
  const schema = form.db_schema || 'public';
  const obj    = form.db_object || 'table_name';
  const fnName = `insert_${obj.replace(/[^a-z0-9]/gi, '_')}`;

  if (!dbCols.length) {
    return `-- Select a schema / object to generate the DDL`;
  }

  // ── 1. CREATE TABLE ───────────────────────────────────────

  // Column width for alignment
  const allNames  = ['id', ...dbCols.map(c => c.name)];
  const maxLen    = Math.max(...allNames.map(n => n.length));
  const pad       = (s: string) => s.padEnd(maxLen + 2);

  // Separate user cols from audit cols so audit goes at the end
  const userCols  = dbCols.filter(c => !_AUDIT_COLS.has(c.name));
  const auditCols = _AUDIT_ORDER.map(n => dbCols.find(c => c.name === n)).filter(Boolean) as DbColMeta[];
  const hasId     = dbCols.some(c => c.name === 'id');

  const colLines: string[] = [];

  // id — use existing definition or synthesise BIGSERIAL
  if (hasId) {
    const idCol = dbCols.find(c => c.name === 'id')!;
    const isBigserial = /bigint|int8/.test(idCol.type.toLowerCase());
    colLines.push(`    ${pad('id')}${isBigserial ? 'bigserial' : pgType(idCol.type)} primary key`);
  } else {
    colLines.push(`    ${pad('id')}bigserial  primary key`);
  }

  for (const c of userCols) {
    const nullable = c.nullable ? '' : ' not null';
    colLines.push(`    ${pad(c.name)}${pgType(c.type)}${nullable}`);
  }

  const auditDefaults: Record<string, string> = {
    inserted_at: ' not null default now()',
    modified_at: ' not null default now()',
    created_at:  ' not null default now()',
    updated_at:  ' not null default now()',
    inserted_by: '',
    modified_by: '',
    created_by:  '',
    updated_by:  '',
  };
  for (const c of auditCols) {
    colLines.push(`    ${pad(c.name)}${pgType(c.type)}${auditDefaults[c.name] ?? ''}`);
  }

  const createTable = [
    `CREATE TABLE IF NOT EXISTS ${schema}.${obj}`,
    `(`,
    colLines.join(',\n'),
    `);`,
  ].join('\n');

  // ── 2. BULK INSERT FUNCTION ───────────────────────────────

  // Writable cols = user cols (no id, no audit)
  const sel      = new Set(form.columns);
  const writeCols = form.columns.length > 0
    ? userCols.filter(c => sel.has(c.name))
    : userCols;

  const sp8      = ' '.repeat(8);
  const typeList = writeCols.map(c => `${sp8}${c.name} ${pgType(c.type)}`).join(',\n');

  // INSERT column list = writeCols + only the audit columns that actually exist
  const insertCols = [
    ...writeCols.map(c => `${sp8}${c.name}`),
    ...auditCols.map(c => `${sp8}${c.name}`),
  ].join(',\n');

  // SELECT list = recordset cols + injected audit values for each present audit col
  const selectCols = [
    ...writeCols.map(c => `${sp8}${c.name}`),
    ...auditCols.map(c => `${sp8}${_AUDIT_VALUE[c.name] ?? 'NULL'}`),
  ].join(',\n');

  const fnEmpty = writeCols.length === 0
    ? `-- No writable columns — nothing to insert`
    : [
        `CREATE OR REPLACE FUNCTION ${schema}.${fnName}(data jsonb, audit_user text DEFAULT NULL)`,
        `RETURNS void AS $$`,
        `BEGIN`,
        `    INSERT INTO ${schema}.${obj} (`,
        insertCols,
        `    )`,
        `    SELECT`,
        selectCols,
        `    FROM jsonb_to_recordset(data) AS x(`,
        typeList,
        `    );`,
        `END;`,
        `$$ LANGUAGE plpgsql;`,
      ].join('\n');

  return [
    `-- ── Table ─────────────────────────────────────────────`,
    createTable,
    ``,
    `-- ── Bulk Insert Function ──────────────────────────────`,
    fnEmpty,
  ].join('\n');
}

function typeHint(name: string, typeMap: Record<string, unknown>): string {
  const raw = typeMap[name];
  const t   = (typeof raw === 'string' ? raw : '').toLowerCase();
  if (!t)                                  return '<value>';
  if (t.includes('int'))                   return '<integer>';
  if (/num|float|dec|real|double/.test(t)) return '<number>';
  if (t.includes('bool'))                  return '<boolean>';
  if (/date|time/.test(t))                 return '<datetime>';
  if (t.includes('json'))                  return '<object>';
  if (t.includes('uuid'))                  return '<uuid>';
  return '<string>';
}

function getAuthHints(resource: ApiResource): { header: string; value: string }[] {
  const cfg = resource.auth_config ?? {};
  switch (resource.auth_type) {
    case 'bearer':  return [{ header: 'Authorization', value: `${cfg.prefix || 'Bearer'} ${cfg.token || '<token>'}` }];
    case 'basic':   return [{ header: 'Authorization', value: `Basic ${btoa(`${cfg.username || '<user>'}:${cfg.password || '<pass>'}`)}` }];
    case 'api_key': {
      const n = cfg.key_name || 'X-Api-Key', v = cfg.key_value || '<key>';
      return cfg.location === 'query' ? [{ header: `?${n}`, value: v }] : [{ header: n, value: v }];
    }
    default: return [];
  }
}

function buildSpec(
  form:           FormState,
  dbCols:         DbColMeta[],
  fnResponseKeys: string[] | null,
): Record<string, unknown> {
  const path    = form.url_path || '/...';

  const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
  form.headers.filter(h => h.name.trim()).forEach(h => {
    hdrs[h.name.trim()] = h.value.trim() || '<required>';
  });

  const envelope = (data: unknown) => ({ success: true, data, error: null });

  // ── Service type — Python service, no SQL ──────────────────────────────────
  if (form.db_type === 'service') {
    let bodySchema: Record<string, unknown> = {};
    try { bodySchema = form.body_schema ? JSON.parse(form.body_schema) : {}; } catch { /* invalid */ }
    let svcResponse: unknown = { ok: true };
    try {
      const parsed = form.service_response ? JSON.parse(form.service_response) : null;
      if (parsed !== null) svcResponse = parsed;
    } catch { /* invalid json — keep default */ }
    return {
      endpoint:    `${form.method} ${path}`,
      ...(form.name        ? { name:        form.name }        : {}),
      ...(form.description ? { description: form.description } : {}),
      service:     form.db_object || '<service_name>',
      headers:     hdrs,
      ...(Object.keys(bodySchema).length > 0 ? { body: bodySchema } : {}),
      response:    envelope(svcResponse),
    };
  }

  const op = ACTION_OP_MAP[form.engine_action];

  // Function write: any function op that isn't select
  const isFnWrite = form.db_type === 'function' && op !== 'select';

  // Active columns — what was selected in the form
  const colSet     = new Set(form.columns);
  const activeCols = form.columns.length > 0 ? dbCols.filter(c => colSet.has(c.name)) : dbCols;
  const typeMap    = Object.fromEntries(activeCols.map(c => [c.name, c.type]));

  // Shape objects used in request / response examples
  const rowShape   = Object.fromEntries(activeCols.map(c => [c.name, typeHint(c.name, typeMap)]));
  const rowExample = activeCols.length ? rowShape : { '<field>': '<value>' };

  // Filters (for select / update / delete)
  const filterShape: Record<string, string> = {};
  form.filters.filter(f => f.column.trim()).forEach(f => {
    filterShape[f.column] = typeHint(f.column, typeMap);
  });
  const hasFilter = Object.keys(filterShape).length > 0;

  let body:        Record<string, unknown> | undefined;
  let queryParams: Record<string, unknown> | undefined;
  let responseData: unknown;

  if (op === 'select') {
    if (form.db_type === 'function' && form.config_returns === 'jsonb') {
      // Scalar-JSONB path: POST body → call_jsonb_function
      // p_filters → body.filters, p_sort → body.sort, p_lang → body.lang
      // p_limit/p_offset → body.limit/offset; p_with_total comes from config, not caller
      let fnParams: Record<string, unknown> = {};
      try { fnParams = form.body_schema ? JSON.parse(form.body_schema) : {}; } catch { /* invalid */ }
      const callerBody: Record<string, unknown> = {};
      // Always show filters key if p_filters is in the signature — it's a valid body field
      // even when no form.filters are configured (the function accepts any filterable column)
      if ('p_filters' in fnParams) {
        callerBody['filters'] = hasFilter ? filterShape : { '<column>': '<value>' };
      }
      if ('p_id'   in fnParams) callerBody['id']   = '<uuid>';
      if ('p_sort' in fnParams) callerBody['sort']  = [{ field: '<column>', dir: 'asc' }];
      if ('p_lang' in fnParams) callerBody['lang']  = 'en';
      callerBody['limit']  = form.default_limit || 25;
      callerBody['offset'] = 0;
      body = callerBody;

      // Scalar object returned by the function
      if (fnResponseKeys && fnResponseKeys.length > 0) {
        responseData = Object.fromEntries(fnResponseKeys.map(k => [k, k === 'ok' ? true : 0]));
      } else {
        responseData = activeCols.length ? rowShape : { '<field>': '<value>' };
      }

    } else if (form.db_type === 'function') {
      // Table-valued function SELECT (non-jsonb): body.filters contains function param values.
      // execute_get extracts param values from filters by matching body_schema keys.
      let fnParams: Record<string, unknown> = {};
      try { fnParams = form.body_schema ? JSON.parse(form.body_schema) : {}; } catch { /* invalid */ }
      const fnTypeMap = Object.fromEntries(Object.entries(fnParams).map(([k, v]) => [k, String(v)]));
      const fnParamShape = Object.fromEntries(
        Object.entries(fnParams).map(([k]) => [k, typeHint(k, fnTypeMap)])
      );
      const hasFnParams = Object.keys(fnParamShape).length > 0;
      if (form.method === 'GET') {
        queryParams = {
          ...(hasFnParams ? fnParamShape : {}),
          limit:  form.default_limit || 20,
          offset: 0,
        };
      } else {
        body = {
          ...(hasFnParams ? { filters: fnParamShape } : {}),
          limit:  form.default_limit || 20,
          offset: 0,
        };
      }
      responseData = activeCols.length ? [rowShape] : ['<row>'];

    } else {
      // Table / view SELECT: GET → query string params, POST → body with filters
      if (form.method === 'GET') {
        queryParams = {
          ...(hasFilter ? filterShape : {}),
          limit:  form.default_limit || 20,
          offset: 0,
        };
      } else {
        body = {
          ...(hasFilter ? { filters: filterShape } : {}),
          limit:  form.default_limit || 20,
          offset: 0,
        };
      }
      // execute_get returns a plain list; ok() wraps it as data
      responseData = activeCols.length ? [rowShape] : ['<row>'];
    }

  } else if (op === 'insert') {
    if (isFnWrite) {
      // execute_function_write: body.data → p_data jsonb (always an array)
      body = { data: [rowExample] };
      responseData = fnResponseKeys?.length
        ? Object.fromEntries(fnResponseKeys.map(k => [k, k === 'ok' ? true : 0]))
        : { ok: true };
    } else {
      // execute_post: body.data → single object; RETURNING gives back the row
      body = { data: rowExample };
      responseData = rowExample;
    }

  } else if (op === 'update') {
    if (isFnWrite) {
      // execute_function_write: body.data → p_data jsonb (array)
      body = { data: [rowExample] };
      responseData = fnResponseKeys?.length
        ? Object.fromEntries(fnResponseKeys.map(k => [k, k === 'ok' ? true : 0]))
        : { ok: true };
    } else {
      // execute_patch: body.patch_data + body.filters; RETURNING gives updated rows
      body = {
        ...(hasFilter ? { filters: filterShape } : {}),
        patch_data: rowExample,
      };
      responseData = activeCols.length ? [rowShape] : ['<row>'];
    }

  } else {
    // delete
    if (isFnWrite) {
      // execute_function_write: body.filters → p_filter jsonb
      body = { filters: hasFilter ? filterShape : {} };
      responseData = fnResponseKeys?.length
        ? Object.fromEntries(fnResponseKeys.map(k => [k, k === 'ok' ? true : 0]))
        : { ok: true };
    } else {
      // execute_delete: body.filters; returns deleted count
      body = hasFilter ? { filters: filterShape } : undefined;
      responseData = { deleted: 1 };
    }
  }

  // For function endpoints with raw_response=true the gateway returns the function
  // result directly without the {success, data, error} wrapper.
  const useRaw = form.db_type === 'function' && form.config_raw_response;

  return {
    endpoint:    `${form.method} /api/v1/run${path}`,
    ...(form.name        ? { name:        form.name }        : {}),
    ...(form.description ? { description: form.description } : {}),
    headers:     hdrs,
    ...(queryParams      ? { query_params: queryParams }     : {}),
    ...(body             ? { body }                          : {}),
    response:    useRaw ? responseData : envelope(responseData),
  };
}

// ── JSON tokenizer + renderer ─────────────────────────────────────────────────

type JTok = { t: 'key' | 'str' | 'num' | 'bool' | 'null' | 'p'; v: string };

function tokenize(src: string): JTok[] {
  const out: JTok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') { if (src[j] === '\\') j++; j++; }
      const str = src.slice(i, j + 1);
      let k = j + 1;
      while (k < src.length && src[k] === ' ') k++;
      if (src[k] === ':') {
        out.push({ t: 'key', v: str });
        out.push({ t: 'p', v: src.slice(j + 1, k + 1) });
        i = k + 1;
      } else {
        out.push({ t: 'str', v: str });
        i = j + 1;
      }
    } else if (/[\d-]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[\d.eE+\-]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
    } else if (src.startsWith('true', i))  { out.push({ t: 'bool', v: 'true'  }); i += 4; }
      else if (src.startsWith('false', i)) { out.push({ t: 'bool', v: 'false' }); i += 5; }
      else if (src.startsWith('null', i))  { out.push({ t: 'null', v: 'null'  }); i += 4; }
      else { out.push({ t: 'p', v: ch }); i++; }
  }
  return out;
}

const TOK_CLS: Record<JTok['t'], string> = {
  key:  'text-violet-400',
  str:  'text-emerald-300',
  num:  'text-sky-400',
  bool: 'text-amber-400',
  null: 'text-gray-500',
  p:    'text-gray-500',
};

function ColoredJson({ value }: { value: unknown }) {
  const tokens = tokenize(JSON.stringify(value, null, 2));
  return (
    <pre className="font-mono text-[11px] leading-[1.65] overflow-auto">
      {tokens.map((tok, i) => <span key={i} className={TOK_CLS[tok.t]}>{tok.v}</span>)}
    </pre>
  );
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
      {children}
    </p>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
      <span className={`mt-0.5 ml-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function AuthBadge({ type }: { type: AuthType }) {
  const M: Record<AuthType, { label: string; cls: string }> = {
    none:    { label: 'No Auth',  cls: 'bg-gray-100 text-gray-500' },
    bearer:  { label: 'Bearer',   cls: 'bg-purple-100 text-purple-700' },
    basic:   { label: 'Basic',    cls: 'bg-amber-100 text-amber-700' },
    api_key: { label: 'API Key',  cls: 'bg-blue-100 text-blue-700' },
    oauth2:  { label: 'OAuth2',   cls: 'bg-green-100 text-green-700' },
  };
  const { label, cls } = M[type] ?? M.none;
  return <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>{label}</span>;
}

// ── FilterBuilder ─────────────────────────────────────────────────────────────

function FilterBuilder({ filters, dbCols, onAdd, onRemove, onChange }: {
  filters:  FilterRow[];
  dbCols:   DbColMeta[];
  onAdd:    () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, k: keyof FilterRow, v: string | string[]) => void;
}) {
  return (
    <div>
      {filters.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Filter size={20} className="text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-400 dark:text-gray-500">No filters — all rows returned (subject to pagination)</p>
        </div>
      ) : (
        <div className="mb-3">
          <div className="grid grid-cols-[1fr_150px_1fr_32px] gap-2 px-1 mb-2">
            <span className="text-[11px] text-gray-400">Column</span>
            <span className="text-[11px] text-gray-400">Operator</span>
            <span className="text-[11px] text-gray-400">Example value</span>
          </div>
          <div className="space-y-2">
            {filters.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_150px_1fr_32px] gap-2 items-center">
                {dbCols.length > 0 ? (
                  <select className="input py-1.5 text-sm font-mono" value={f.column} onChange={e => onChange(i, 'column', e.target.value)}>
                    <option value="">— column —</option>
                    {dbCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                ) : (
                  <input className="input py-1.5 text-sm font-mono" placeholder="column_name" value={f.column} onChange={e => onChange(i, 'column', e.target.value)} />
                )}
                <select className="input py-1.5 text-sm" value={f.operators[0] ?? 'eq'} onChange={e => onChange(i, 'operators', [e.target.value])}>
                  {OPERATOR_GROUPS.map(g => (
                    <optgroup key={g.label} label={g.label}>
                      {g.ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input className="input py-1.5 text-sm" placeholder="example" value={f.label} onChange={e => onChange(i, 'label', e.target.value)} />
                <button onClick={() => onRemove(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={onAdd} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
        <Plus size={14} /> Add filter
      </button>
    </div>
  );
}

// ── ColumnPicker ──────────────────────────────────────────────────────────────

function ColumnPicker({ selected, dbCols, onToggle, onAll, onClear }: {
  selected: string[];
  dbCols:   DbColMeta[];
  onToggle: (name: string, on: boolean) => void;
  onAll:    () => void;
  onClear:  () => void;
}) {
  if (dbCols.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-2">
        <Columns size={14} /> Select a schema and object to configure output columns.
      </p>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {selected.length === 0
            ? <span className="text-amber-600 dark:text-amber-500">All {dbCols.length} columns will be returned</span>
            : <><span className="font-semibold text-indigo-600 dark:text-indigo-400">{selected.length}</span> of {dbCols.length} selected</>
          }
        </span>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={onAll} className="text-indigo-600 dark:text-indigo-400 hover:underline">All</button>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <button onClick={onClear} className="text-gray-400 hover:text-gray-600 hover:underline">Clear</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-950/40">
        {dbCols.map(col => {
          const on = selected.includes(col.name);
          return (
            <label key={col.name}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs select-none transition-colors
                ${on ? 'bg-indigo-50 dark:bg-indigo-900/25 text-indigo-800 dark:text-indigo-200'
                     : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800/50'}`}>
              <input type="checkbox" className="rounded text-indigo-600 border-gray-300 dark:border-gray-600" checked={on}
                onChange={e => onToggle(col.name, e.target.checked)} />
              <span className="font-mono flex-1 min-w-0 truncate">{col.name}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                {col.type?.split('(')[0]?.split(' ')[0]}
              </span>
            </label>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map(name => (
            <span key={name} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-mono bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
              {name}
              <button type="button" onClick={() => onToggle(name, false)}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 leading-none">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ExtraFieldsTable ──────────────────────────────────────────────────────────

function ExtraFieldsTable({ extras, onAdd, onRemove, onChange }: {
  extras:   ExtraField[];
  onAdd:    () => void;
  onRemove: (i: number) => void;
  onChange: (i: number, k: keyof ExtraField, v: string) => void;
}) {
  return (
    <div>
      {extras.length > 0 && (
        <div className="mb-3">
          <div className="grid grid-cols-[110px_1fr_1fr_32px] gap-2 px-1 mb-1.5">
            <span className="text-[11px] text-gray-400">Type</span>
            <span className="text-[11px] text-gray-400">Read from</span>
            <span className="text-[11px] text-gray-400">Output as</span>
          </div>
          <div className="space-y-2">
            {extras.map((e, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr_1fr_32px] gap-2 items-center">
                <select className="input py-1.5 text-sm" value={e.type} onChange={ev => onChange(i, 'type', ev.target.value)}>
                  <option value="static">Static</option>
                  <option value="field">From result</option>
                </select>
                <input className="input py-1.5 text-sm font-mono"
                  placeholder={e.type === 'field' ? 'record_count or rows.field' : 'hardcoded value'}
                  value={e.value} onChange={ev => onChange(i, 'value', ev.target.value)} />
                <input className="input py-1.5 text-sm font-mono" placeholder="output_key"
                  value={e.key} onChange={ev => onChange(i, 'key', ev.target.value)} />
                <button onClick={() => onRemove(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={onAdd} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
        <Plus size={14} /> Add field
      </button>
    </div>
  );
}

// ── Tab views ─────────────────────────────────────────────────────────────────

interface TabProps {
  form:           FormState;
  dbCols:         DbColMeta[];
  resources:      ApiResource[];
  fnResponseKeys: string[] | null;
  set:            <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

function ConfigureTab({ form, dbCols, set }: TabProps) { // fnResponseKeys unused here
  if (form.db_type === 'service') {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-3">
        <Zap size={20} className="text-indigo-400" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Service endpoint</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
          Executes custom Python logic — no SQL filters to configure.<br />
          Define the input contract in the <strong>Details</strong> tab.
        </p>
      </div>
    );
  }

  const add    = () => set('filters', [...form.filters, { column: '', label: '', operators: ['eq'] }]);
  const remove = (i: number) => set('filters', form.filters.filter((_, x) => x !== i));
  const change = (i: number, k: keyof FilterRow, v: string | string[]) =>
    set('filters', form.filters.map((f, x) => x === i ? { ...f, [k]: v } : f));

  const isList = form.engine_action === 'list';

  const heading =
    form.engine_action === 'delete' ? 'Delete Conditions' :
    form.engine_action === 'update' ? 'Match Conditions'  : 'Query Filters';

  return (
    <div className="space-y-7">

      {/* Pagination — shown for list only; function endpoints manage limits in Details tab */}
      {isList && form.db_type !== 'function' && (
        <div>
          <FL>Pagination</FL>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none shrink-0">
                <Toggle checked={form.pagination_enabled} onChange={() => set('pagination_enabled', !form.pagination_enabled)} />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Pagination</span>
              </label>
              {form.pagination_enabled && (
                <>
                  <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Default</span>
                    <input type="number" min={1} max={form.max_limit} className="input py-1 text-sm w-16 text-center"
                      value={form.default_limit} onChange={e => set('default_limit', Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Max</span>
                    <input type="number" min={form.default_limit} className="input py-1 text-sm w-16 text-center"
                      value={form.max_limit} onChange={e => set('max_limit', Math.max(form.default_limit, parseInt(e.target.value) || form.default_limit))} />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
              <code className="font-mono font-semibold">record_count</code>
              <span>always returned via <code className="font-mono">COUNT(*) OVER()</code></span>
            </div>
          </div>
        </div>
      )}

      {/* Request body fields — insert / bulk-insert / sync / upsert */}
      {form.engine_action === 'insert' ? (
        <div>
          <FL>Request Body Fields</FL>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            Select which fields are accepted in the <code className="font-mono">data</code> payload.
            {form.db_type === 'function' && ' These define the array items sent to the function.'}
          </p>
          <ColumnPicker
            selected={form.columns}
            dbCols={dbCols}
            onToggle={(name, on) => set('columns', on ? [...form.columns, name] : form.columns.filter(c => c !== name))}
            onAll={() => set('columns', dbCols.map(c => c.name))}
            onClear={() => set('columns', [])}
          />
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Filter size={13} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{heading}</span>
            {form.engine_action === 'delete' && (
              <span className="ml-auto text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-0.5">
                Irreversible — use filters carefully
              </span>
            )}
          </div>
          <FilterBuilder filters={form.filters} dbCols={dbCols} onAdd={add} onRemove={remove} onChange={change} />
        </div>
      )}
    </div>
  );
}

function ResponseTab({ form, dbCols, fnResponseKeys, set }: TabProps) {
  if (form.db_type === 'service') {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-3">
        <Zap size={20} className="text-indigo-400" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Service response</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
          The response shape is defined by the service's <code className="font-mono text-gray-500">execute()</code> return value.<br />
          See the API Contract panel for the response envelope.
        </p>
      </div>
    );
  }

  const toggleCol   = (name: string, on: boolean) =>
    set('columns', on ? [...form.columns, name] : form.columns.filter(c => c !== name));
  const addExtra    = () => set('response_extras', [...form.response_extras, { key: '', type: 'static', value: '' }]);
  const removeExtra = (i: number) => set('response_extras', form.response_extras.filter((_, x) => x !== i));
  const changeExtra = (i: number, k: keyof ExtraField, v: string) =>
    set('response_extras', form.response_extras.map((e, x) => x === i ? { ...e, [k]: v } : e));

  const isFnWrite = form.db_type === 'function' && form.engine_action === 'insert';

  return (
    <div className="space-y-7">
      {isFnWrite ? (
        <div>
          <FL>Function Response</FL>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            This endpoint calls a PL/pgSQL function. The response shape is fixed by the function's{' '}
            <code className="font-mono">RETURN jsonb_build_object(...)</code> statement — not by selected columns.
          </p>
          {fnResponseKeys && fnResponseKeys.length > 0 ? (
            <pre className="rounded-lg bg-gray-950 dark:bg-black text-emerald-400 text-xs font-mono p-4 overflow-x-auto border border-gray-800">
              {JSON.stringify(
                { success: true, data: Object.fromEntries(fnResponseKeys.map(k => [k, k === 'ok' ? true : 0])), error: null },
                null, 2
              )}
            </pre>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-500 py-2">
              Response shape will be read from the function definition once the function exists in the database.
            </p>
          )}
        </div>
      ) : (
        <div>
          <FL>Output Columns</FL>
          <ColumnPicker
            selected={form.columns} dbCols={dbCols}
            onToggle={toggleCol}
            onAll={() => set('columns', dbCols.map(c => c.name))}
            onClear={() => set('columns', [])}
          />
        </div>
      )}

      {form.engine_action === 'list' && (
        <div>
          <FL>Response Array Key</FL>
          <div className="flex items-center gap-3">
            <input
              className="input w-36 font-mono text-sm"
              placeholder="rows"
              value={form.response_key}
              onChange={e => set('response_key', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            />
            <code className="text-xs text-gray-400 dark:text-gray-500 truncate">
              {`{ "success": true, "data": [{...}], "error": null }`}
            </code>
          </div>
        </div>
      )}

      <div>
        <FL>Extra Response Fields</FL>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Append values to every response. <span className="font-semibold text-gray-500 dark:text-gray-400">From result</span> reads an existing key (e.g. <code className="font-mono">record_count</code>, <code className="font-mono">rows.amount</code>). <span className="font-semibold text-gray-500 dark:text-gray-400">Static</span> is hardcoded.
        </p>
        <ExtraFieldsTable extras={form.response_extras} onAdd={addExtra} onRemove={removeExtra} onChange={changeExtra} />
      </div>
    </div>
  );
}

function AuthTab({ form, dbCols: _dc, resources, set }: TabProps) {
  const res   = resources.find((r: ApiResource) => r.code === form.resource_code);
  const hints = res ? getAuthHints(res) : [];

  const addHdr    = () => set('headers', [...form.headers, { name: '', value: '' }]);
  const removeHdr = (i: number) => set('headers', form.headers.filter((_, x) => x !== i));
  const changeHdr = (i: number, k: keyof HeaderRow, v: string) =>
    set('headers', form.headers.map((h, x) => x === i ? { ...h, [k]: v } : h));

  return (
    <div className="space-y-6">
      {hints.length > 0 && (
        <div>
          <FL>Auth Headers (required)</FL>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {hints.map(h => (
              <div key={h.header} className="flex items-center gap-3 px-3 py-2 text-xs font-mono">
                <Key size={11} className="text-gray-400 shrink-0" />
                <span className="text-gray-500 dark:text-gray-400 shrink-0 min-w-[9rem]">{h.header}</span>
                <span className="text-gray-800 dark:text-gray-200 break-all">{h.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <FL>Custom Request Headers</FL>
        {form.headers.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No custom headers.</p>
        ) : (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-[1fr_1fr_32px] gap-2 px-1 mb-1">
              <span className="text-[11px] text-gray-400">Header name</span>
              <span className="text-[11px] text-gray-400">Value</span>
            </div>
            {form.headers.map((h, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                <input className="input py-1.5 text-sm font-mono" placeholder="X-Header" value={h.name} onChange={e => changeHdr(i, 'name', e.target.value)} />
                <input className="input py-1.5 text-sm" placeholder="value" value={h.value} onChange={e => changeHdr(i, 'value', e.target.value)} />
                <button onClick={() => removeHdr(i)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button onClick={addHdr} className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700">
          <Plus size={14} /> Add header
        </button>
      </div>
    </div>
  );
}

// ── FieldListEditor ───────────────────────────────────────────────────────────

function FieldListEditor({ label, description, fields, dbCols, onChange }: {
  label:       string;
  description: string;
  fields:      string[];
  dbCols:      DbColMeta[];
  onChange:    (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const listId = `fl-${label.replace(/\W+/g, '-').toLowerCase()}`;

  const add = (name: string) => {
    const t = name.trim();
    if (!t || fields.includes(t)) return;
    onChange([...fields, t]);
    setInput('');
  };

  const remove = (name: string) => onChange(fields.filter(f => f !== name));

  const suggestions = dbCols.filter(c => !fields.includes(c.name));

  return (
    <div>
      <FL>{label}</FL>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{description}</p>

      {/* Existing field chips */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {fields.map(f => (
            <span key={f} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-mono bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
              {f}
              <button type="button" onClick={() => remove(f)}
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-violet-200 dark:hover:bg-violet-800 leading-none">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input: text field with datalist autocomplete when columns are known */}
      <div className="flex items-center gap-2">
        <input
          className="input py-1 text-sm font-mono flex-1"
          placeholder="field_name"
          value={input}
          list={suggestions.length > 0 ? listId : undefined}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map(c => <option key={c.name} value={c.name} />)}
          </datalist>
        )}
        <button
          type="button"
          onClick={() => add(input)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shrink-0"
        >
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

function DetailsTab({ form, dbCols, set }: TabProps) {
  const [bodyErr,     setBodyErr]     = useState('');
  const [responseErr, setResponseErr] = useState('');
  const [editing,     setEditing]     = useState(false);

  // Service endpoints: always show both request + response schema editors
  if (form.db_type === 'service') {
    return (
      <div className="space-y-6">
        <div>
          <FL>Request Schema</FL>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Documents the expected input fields. Shown in the API Contract panel.
          </p>
          <textarea rows={6} className={`input w-full font-mono text-sm resize-y ${bodyErr ? 'border-red-400' : ''}`}
            value={form.body_schema}
            onChange={e => { set('body_schema', e.target.value); setBodyErr(''); }}
            placeholder={'{\n  "prices": [100.00, 250.00],\n  "tax_rate": 0.21\n}'} />
          {bodyErr && <div className="flex items-center gap-1.5 mt-1 text-red-600 text-xs"><AlertCircle size={12} /> {bodyErr}</div>}
        </div>
        <div>
          <FL>Response Schema</FL>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Documents the shape returned by <code className="font-mono">execute()</code>. Shown in the API Contract panel.
          </p>
          <textarea rows={8} className={`input w-full font-mono text-sm resize-y ${responseErr ? 'border-red-400' : ''}`}
            value={form.service_response}
            onChange={e => { set('service_response', e.target.value); setResponseErr(''); }}
            placeholder={'{\n  "tax_rate": 0.21,\n  "items": []\n}'} />
          {responseErr && <div className="flex items-center gap-1.5 mt-1 text-red-600 text-xs"><AlertCircle size={12} /> {responseErr}</div>}
        </div>
      </div>
    );
  }

  // Function endpoints: parameter table (read) with optional edit toggle
  if (form.db_type === 'function') {
    let params: [string, string][] = [];
    let bodyJsonErr = '';
    try {
      const parsed = JSON.parse(form.body_schema || '{}');
      params = Object.entries(parsed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
    } catch { bodyJsonErr = 'Invalid JSON'; }


    if (!editing) {
      return (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <FL>Function Parameters</FL>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Edit
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Auto-populated from the database function signature when the endpoint is saved.
            </p>
            {params.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No parameters — select a function to auto-populate, or click Edit to enter manually.
              </p>
            ) : (
              <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2 w-1/2">Parameter</th>
                      <th className="text-left px-3 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {params.map(([name, type]) => (
                      <tr key={name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 text-violet-700 dark:text-violet-400">{name}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {form.engine_action === 'list' && (
            <div>
              <FL>Runtime Config</FL>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Controls how the gateway routes and executes this function. Click Edit to change.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs ${
                  form.config_returns
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  returns: {form.config_returns || '(none)'}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs ${
                  form.config_raw_response
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  raw_response: {String(form.config_raw_response)}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  default_limit: {form.default_limit}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  max_limit: {form.max_limit}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs ${
                  form.include_total
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  include_total: {String(form.include_total)}
                </span>
              </div>
            </div>
          )}


        </div>
      );
    }

    // ── Edit mode ────────────────────────────────────────────────────────────
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-1">
            <FL>Body Schema (JSON)</FL>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Done
            </button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            Auto-populated from the function signature on save. Manual edits are preserved — clear to re-introspect.
          </p>
          <textarea
            rows={8}
            className={`input w-full font-mono text-sm resize-y ${bodyJsonErr ? 'border-red-400' : ''}`}
            value={form.body_schema}
            onChange={e => { set('body_schema', e.target.value); setBodyErr(''); }}
            placeholder={'{\n  "p_filters": "jsonb",\n  "p_limit": "integer"\n}'}
          />
          {bodyJsonErr && (
            <div className="flex items-center gap-1.5 mt-1 text-red-600 text-xs">
              <AlertCircle size={12} /> {bodyJsonErr}
            </div>
          )}
        </div>

        {form.engine_action === 'list' && (
        <div className="space-y-4">
          <FL>Runtime Config</FL>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">Returns</label>
            <input
              type="text"
              className="input w-28 font-mono text-sm"
              value={form.config_returns}
              onChange={e => set('config_returns', e.target.value.trim())}
              placeholder="jsonb"
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              <code className="font-mono">jsonb</code> routes to the scalar-JSONB path. Leave empty for table-valued functions.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">Raw response</label>
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={form.config_raw_response}
              onChange={e => set('config_raw_response', e.target.checked)}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Return the function result directly without the <code className="font-mono">{'{success, data}'}</code> envelope
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">Default limit</label>
            <input
              type="number"
              min={1}
              max={form.max_limit}
              className="input w-24 font-mono text-sm text-center"
              value={form.default_limit}
              onChange={e => set('default_limit', Math.max(1, parseInt(e.target.value) || 1))}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">rows per page when caller omits <code className="font-mono">limit</code></span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">Max limit</label>
            <input
              type="number"
              min={form.default_limit}
              className="input w-24 font-mono text-sm text-center"
              value={form.max_limit}
              onChange={e => set('max_limit', Math.max(form.default_limit, parseInt(e.target.value) || form.default_limit))}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">hard ceiling — caller cannot exceed this</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300 w-36 shrink-0">Include total</label>
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={form.include_total}
              onChange={e => set('include_total', e.target.checked)}
            />
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Passes <code className="font-mono">p_with_total=true</code> to the function — adds record count to the response
            </span>
          </div>
        </div>
        )}

        {form.engine_action === 'list' && (
          <div className="space-y-6">
            <FieldListEditor
              label="Filter Fields"
              description="Whitelist of fields the caller may pass in p_filters. Leave empty to allow all."
              fields={form.filter_fields}
              dbCols={dbCols}
              onChange={v => set('filter_fields', v)}
            />

            <div>
              <FL>Default Sort</FL>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Applied when the caller omits p_sort. Multiple fields sorted in the order listed.
              </p>
              <datalist id="det-sort-fields">
                {dbCols.map(c => <option key={c.name} value={c.name} />)}
              </datalist>
              {form.sort_fields.length > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-[1fr_90px_28px] gap-2 px-0.5 mb-1">
                    <span className="text-[11px] text-gray-400">Field</span>
                    <span className="text-[11px] text-gray-400">Direction</span>
                  </div>
                  {form.sort_fields.map((sf, i) => (
                    <div key={i} className="grid grid-cols-[1fr_90px_28px] gap-2 items-center">
                      <input
                        className="input h-7 text-xs font-mono"
                        placeholder="field_name"
                        list="det-sort-fields"
                        value={sf.field}
                        onChange={e => set('sort_fields', form.sort_fields.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                      />
                      <select
                        className="input h-7 text-xs"
                        value={sf.direction}
                        onChange={e => set('sort_fields', form.sort_fields.map((x, j) => j === i ? { ...x, direction: e.target.value as 'asc' | 'desc' } : x))}
                      >
                        <option value="asc">asc ↑</option>
                        <option value="desc">desc ↓</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => set('sort_fields', form.sort_fields.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => set('sort_fields', [...form.sort_fields, { field: '', direction: 'asc' }])}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus size={11} /> Add sort field
              </button>
            </div>

            <div>
              <FL>Static Filters</FL>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                Always applied — merged into p_filters on every request.
              </p>
              {form.static_filters.length > 0 && (
                <div className="space-y-2 mb-3">
                  <div className="grid grid-cols-[1fr_1fr_28px] gap-2 px-0.5 mb-1">
                    <span className="text-[11px] text-gray-400">Field</span>
                    <span className="text-[11px] text-gray-400">Value</span>
                  </div>
                  {form.static_filters.map((sf, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                      <input
                        className="input h-7 text-xs font-mono"
                        placeholder="is_active"
                        value={sf.field}
                        onChange={e => set('static_filters', form.static_filters.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                      />
                      <input
                        className="input h-7 text-xs font-mono"
                        placeholder="true"
                        value={sf.value}
                        onChange={e => set('static_filters', form.static_filters.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                      />
                      <button
                        type="button"
                        onClick={() => set('static_filters', form.static_filters.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => set('static_filters', [...form.static_filters, { field: '', value: '' }])}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Plus size={11} /> Add filter
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const showBody = ['POST', 'PUT', 'PATCH'].includes(form.method);
  if (!showBody) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <FileText size={20} className="text-gray-300 dark:text-gray-600 mb-2.5" />
        <p className="text-sm text-gray-400 dark:text-gray-500">No body schema for GET / DELETE requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <FL>Body Schema</FL>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Reference documentation only — not enforced at runtime.</p>
        <textarea rows={8} className={`input w-full font-mono text-sm resize-y ${bodyErr ? 'border-red-400' : ''}`}
          value={form.body_schema}
          onChange={e => { set('body_schema', e.target.value); setBodyErr(''); }}
          placeholder={'{\n  "name": "string"\n}'} />
        {bodyErr && <div className="flex items-center gap-1.5 mt-1 text-red-600 text-xs"><AlertCircle size={12} /> {bodyErr}</div>}
      </div>
    </div>
  );
}

// ── Contract Preview ──────────────────────────────────────────────────────────

type PreviewTab = 'contract' | 'ddl';

const PREVIEW_TABS: { id: PreviewTab; label: string }[] = [
  { id: 'contract', label: 'API Contract' },
  { id: 'ddl',      label: 'Bulk Insert DDL' },
];

function SyntaxDDL({ src }: { src: string }) {
  const lines = src.split('\n');
  const kw = /^(CREATE|OR|REPLACE|FUNCTION|RETURNS|AS|BEGIN|INSERT|INTO|SELECT|FROM|END|LANGUAGE|void)\b/i;
  return (
    <pre className="font-mono text-[11px] leading-[1.65] overflow-auto">
      {lines.map((line, li) => {
        const trimmed = line.trimStart();
        const indent  = line.slice(0, line.length - trimmed.length);
        // Colour keywords at the start of the trimmed line
        const match = trimmed.match(/^([A-Z_]+)(.*)/i);
        if (!match || !kw.test(trimmed)) {
          // Could be column list or type list — highlight type names at end
          const colType = line.match(/^(\s+)(\w+)\s+(\w+)(,?)$/);
          if (colType) {
            return (
              <span key={li} className="block">
                {colType[1]}
                <span className="text-violet-400">{colType[2]}</span>
                {' '}
                <span className="text-sky-400">{colType[3]}</span>
                <span className="text-gray-500">{colType[4]}</span>
                {'\n'}
              </span>
            );
          }
          return <span key={li} className="block text-gray-300">{line}{'\n'}</span>;
        }
        return (
          <span key={li} className="block">
            {indent}<span className="text-amber-400 font-semibold">{match[1]}</span>
            <span className="text-gray-300">{match[2]}</span>{'\n'}
          </span>
        );
      })}
    </pre>
  );
}

function ContractPreview({ form, dbCols, fnResponseKeys }: { form: FormState; dbCols: DbColMeta[]; fnResponseKeys: string[] | null }) {
  const [tab, setTab]     = useState<PreviewTab>('contract');
  const [copied, setCopied] = useState(false);

  const spec = buildSpec(form, dbCols, fnResponseKeys);
  const ddl  = buildBulkInsertDDL(form, dbCols);

  const copy = () => {
    const text = tab === 'contract' ? JSON.stringify(spec, null, 2) : ddl;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl flex flex-col overflow-hidden h-full">
      {/* Terminal chrome */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
        </div>
        <div className="flex items-center gap-1 ml-3">
          {PREVIEW_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors
                ${tab === t.id
                  ? 'bg-gray-800 text-gray-200'
                  : 'text-gray-600 hover:text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={copy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors ml-auto">
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {tab === 'contract'
          ? <ColoredJson value={spec} />
          : <SyntaxDDL src={ddl} />
        }
      </div>
      {tab === 'ddl' && form.db_object && (
        <div className="px-4 py-2 border-t border-gray-800 shrink-0">
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Audit columns (<span className="font-mono text-gray-500">inserted_at/by, modified_at/by</span>) are injected automatically by the function.
            {' '}Register the function in the engine, then call it via <span className="font-mono text-gray-500">POST /api/v1/run/{form.db_schema || 'schema'}/fn/insert_{form.db_object.replace(/[^a-z0-9]/gi, '_')}</span>.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FN_PREFIXES = /^fn_(list|get|insert|update|delete|upsert|sync|search|bulk_insert|bulk[-_]insert)_/i;
const FN_GENERIC  = /^fn_/i;
const VIEW_PREFIX = /^v_/i;
const OP_PREFIXES = /^(sync|insert|update|delete|upsert|list|get|search|bulk_insert|bulk[-_]insert)_/i;

function deriveBaseTable(objName: string): string {
  return objName
    .replace(FN_PREFIXES,  '')
    .replace(FN_GENERIC,   '')
    .replace(VIEW_PREFIX,  '')
    .replace(OP_PREFIXES,  '');
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EndpointFormPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isEdit   = !!id;

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [activeTab, setTab]   = useState<TabId>('request');
  const [urlEdited, setUrlEd] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [nameFilter, setNameFilter] = useState<string>('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  // ── Queries ──
  const { data: existing } = useQuery({
    queryKey: QK.gwEndpoint(Number(id)),
    queryFn:  () => endpointsApi.get(Number(id)),
    enabled:  isEdit,
  });
  const { data: resourcesPage } = useQuery({
    queryKey: ['api-bridge-resources'],
    queryFn:  () => apiBridgeResourcesApi.list({ is_active: true, page_size: 999 }),
    staleTime: 30_000,
  });
  const resources = resourcesPage?.rows ?? [];
  const { data: engineObjects = [] } = useQuery({
    queryKey: ['engine-objects'],
    queryFn:  engineApi.listObjects,
    staleTime: 30_000,
  });
  const { data: allSchemas = [] } = useQuery({
    queryKey: QK.gwSchemas(),
    queryFn:  schemaBrowserApi.schemas,
  });
  const { data: registeredServices = [] } = useQuery({
    queryKey: ['gateway-services'],
    queryFn:  gatewayServicesApi.list,
    staleTime: 30_000,
  });
  const { data: dbObjects = [] } = useQuery({
    queryKey: QK.gwObjects(form.db_schema),
    queryFn:  () => schemaBrowserApi.objects(form.db_schema),
    enabled:  !!form.db_schema,
  });
  // Fetch the full object definition (DDL + columns) for any db_type to auto-discover
  // request fields and response shape. For functions: parse prosrc. For views/tables: use columns.
  const { data: objectDef } = useQuery({
    queryKey: ['endpoint-object-def', form.db_schema, form.db_object, form.db_type],
    queryFn:  () => schemaBrowserApi.objectDef(form.db_schema, form.db_object, form.db_type),
    enabled:  !!form.db_schema && !!form.db_object && !!form.db_type,
    staleTime: 5 * 60 * 1000,
  });

  // Memoize parsed values so derived arrays have stable references — avoids stale-closure
  // bugs in useEffect deps and prevents re-running regex on every keystroke.
  const fnJtrCols = useMemo<DbColMeta[] | null>(
    () => objectDef?.source ? parseJtrFields(objectDef.source) : null,
    [objectDef],
  );
  const fnResponseKeys = useMemo<string[] | null>(
    () => objectDef?.source ? parseFnReturnKeys(objectDef.source) : null,
    [objectDef],
  );
  const defCols = useMemo<DbColMeta[]>(
    () => (objectDef?.columns ?? []).map(c => ({ name: c.name, type: c.type, nullable: c.nullable })),
    [objectDef],
  );
  // Parsed function argument types — used to auto-populate body_schema
  const fnArgSchema = useMemo<Record<string, string> | null>(
    () => (form.db_type === 'function' && objectDef?.arguments)
      ? parseFnArguments(objectDef.arguments)
      : null,
    [form.db_type, objectDef],
  );

  // Fallback for write-functions that have no JTR clause: look up the underlying base table.
  const { data: baseTableCols = [] } = useQuery({
    queryKey: QK.gwColumns(form.db_schema, nameFilter, 'table'),
    queryFn:  () => schemaBrowserApi.columns(form.db_schema, nameFilter, 'table'),
    enabled:  form.db_type === 'function' && !fnJtrCols && !!form.db_schema && !!nameFilter,
    staleTime: 5 * 60 * 1000,
  });

  const dbCols = useMemo<DbColMeta[]>(
    () =>
      fnJtrCols && fnJtrCols.length > 0 ? fnJtrCols
      : defCols.length > 0              ? defCols
      : (baseTableCols as DbColMeta[]),
    [fnJtrCols, defCols, baseTableCols],
  );

  // Auto-populate body_schema from function argument list (only when currently empty/default)
  useEffect(() => {
    if (!fnArgSchema || Object.keys(fnArgSchema).length === 0) return;
    setForm(prev => {
      let current: Record<string, unknown> = {};
      try { current = JSON.parse(prev.body_schema); } catch { /* invalid json – treat as empty */ }
      if (Object.keys(current).length > 0) return prev;
      return { ...prev, body_schema: JSON.stringify(fnArgSchema, null, 2) };
    });
  }, [fnArgSchema]);

  // ── Load existing ──
  useEffect(() => {
    if (!existing) return;
    const opToAction: Record<string, EngineAction> = {
      select: 'list', insert: 'insert', update: 'update', delete: 'delete',
    };
    const rawCols = existing.columns ?? [];
    const cols: string[] = rawCols.map((c: unknown) =>
      typeof c === 'string' ? c : (c as Record<string, string>)?.name ?? ''
    ).filter(Boolean);

    setForm({
      name:               existing.name,
      url_path:           existing.url_path,
      method:             existing.method,
      operation_type:     existing.operation_type ?? '',
      engine_action:      opToAction[existing.operation_type ?? ''] ?? 'list',
      resource_code:      existing.resource_code ?? '',
      description:        existing.description ?? '',
      status:             existing.status,
      db_schema:          existing.db_schema ?? '',
      db_object:          existing.db_object ?? '',
      db_type:            existing.db_type   ?? '',
      headers:            existing.headers   ?? [],
      body_schema:        JSON.stringify(existing.body_schema ?? {}, null, 2),
      filters:            (existing.filters ?? []).map((f: FilterRow) => ({ column: f.column, label: f.label ?? '', operators: f.operators })),
      columns:            cols,
      response_key:       existing.response_key   ?? 'rows',
      pagination_enabled: existing.pagination_enabled ?? true,
      default_limit:      existing.default_limit  ?? 20,
      max_limit:          existing.max_limit       ?? 100,
      include_total:      existing.include_total   ?? false,
      count_limit:        existing.count_limit     ?? 10000,
      response_extras:    (existing.response_extras ?? []).map((e: ExtraField) => ({ key: e.key, type: e.type ?? 'static', value: e.value })),
      service_response:    JSON.stringify((existing.config as Record<string, unknown>)?.service_response ?? {}, null, 2),
      config_returns:      (existing.returns as string) ?? ((existing.config as Record<string, unknown>)?.returns as string) ?? '',
      config_raw_response: Boolean(existing.raw_response ?? (existing.config as Record<string, unknown>)?.raw_response),
      sort_fields: ((existing.sort_fields ?? []) as unknown[]).map(sf =>
        typeof sf === 'object' && sf !== null
          ? { field: (sf as Record<string, string>).field ?? '', direction: ((sf as Record<string, string>).direction as 'asc' | 'desc') ?? 'asc' }
          : { field: String(sf), direction: 'asc' as const }
      ),
      filter_fields:       (existing.filter_fields ?? []) as string[],
      static_filters:      Object.entries(existing.static_filters ?? {})
        .map(([field, value]) => ({ field, value: String(value) })),
    });
    setUrlEd(true);
    // Restore filter UI from saved values
    if (existing.db_type) setTypeFilter(existing.db_type);
    if (existing.db_object) setNameFilter(deriveBaseTable(existing.db_object));
  }, [existing]);

  // When dbCols loads (or changes) and no columns are selected yet, auto-select all.
  // Functional form of setForm avoids the stale-closure on form.columns.
  useEffect(() => {
    if (dbCols.length === 0) return;
    setForm(prev => {
      if (prev.columns.length > 0) return prev;
      return { ...prev, columns: dbCols.map(c => c.name) };
    });
  }, [dbCols]);

  // URL auto-fill
  useEffect(() => {
    if (form.db_object && !urlEdited) {
      const path = form.db_type === 'service'
        ? `/services/${form.db_object}`
        : `/gateway/${form.db_object}/${form.engine_action}`;
      set('url_path', path);
    }
  }, [form.db_object, form.db_type, form.engine_action, urlEdited]);

  // Name auto-fill when object is first selected — functional form avoids stale closure
  // on engine_action and name.
  useEffect(() => {
    setForm(prev => {
      if (!prev.db_object || prev.name) return prev;
      const obj = prev.db_object.replace(/^v_/, '').replace(/_/g, ' ');
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      return { ...prev, name: `${cap(prev.engine_action)} ${obj.split(' ').map(cap).join(' ')}` };
    });
  }, [form.db_object]);

  // ── Mutation ──
  const saveMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit ? endpointsApi.update(Number(id), payload) : endpointsApi.create(payload),
    onSuccess: () => {
      toast.success(isEdit ? 'Endpoint updated' : 'Endpoint created');
      qc.invalidateQueries({ queryKey: QK.gwEndpoints() });
      if (isEdit) qc.removeQueries({ queryKey: QK.gwEndpoint(Number(id)) });
      navigate('/gateway/endpoints');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSave = () => {
    if (!form.name.trim())       { toast.error('Endpoint name is required');         return; }
    if (!form.url_path.trim())   { toast.error('Endpoint URL path is required');     return; }

    let parsedBody: Record<string, unknown> = {};
    try { parsedBody = form.body_schema.trim() ? JSON.parse(form.body_schema) : {}; }
    catch { toast.error('Invalid JSON in Body Schema (Request tab)'); setTab('request'); return; }

    let parsedServiceResponse: Record<string, unknown> | null = null;
    if (form.db_type === 'service' && form.service_response.trim() && form.service_response.trim() !== '{}') {
      try { parsedServiceResponse = JSON.parse(form.service_response); }
      catch { toast.error('Invalid JSON in Response Schema (Request tab)'); setTab('request'); return; }
    }

    saveMut.mutate({
      name:               form.name.trim(),
      url_path:           form.url_path.trim(),
      method:             form.method,
      operation_type:     ACTION_OP_MAP[form.engine_action],
      description:        form.description.trim() || undefined,
      status:             form.status,
      resource_code:      form.resource_code || undefined,
      db_schema:          form.db_schema || undefined,
      db_object:          form.db_object || undefined,
      db_type:            form.db_type   || undefined,
      headers:            form.headers.filter(h => h.name.trim()),
      body_schema:        parsedBody,
      filters:            form.filters.filter(f => f.column.trim()),
      columns:            form.columns,
      response_key:       form.response_key || 'rows',
      pagination_enabled: form.pagination_enabled,
      default_limit:      form.default_limit,
      max_limit:          form.max_limit,
      include_total:      form.include_total,
      count_limit:        form.count_limit,
      response_extras:    form.response_extras.filter(e => e.key.trim()),
      ...(parsedServiceResponse !== null ? { service_response: parsedServiceResponse } : {}),
      ...(form.db_type === 'function' ? {
        config_returns:      form.config_returns,
        config_raw_response: form.config_raw_response,
        sort_fields:         form.sort_fields,
        filter_fields:       form.filter_fields,
        static_filters:      Object.fromEntries(
          form.static_filters
            .filter(sf => sf.field.trim())
            .map(sf => {
              const v = sf.value.trim();
              const parsed: unknown = v === 'true' ? true : v === 'false' ? false
                : (!isNaN(Number(v)) && v !== '') ? Number(v) : v;
              return [sf.field.trim(), parsed];
            })
        ),
      } : {}),
    });
  };

  const handleAction = (a: EngineAction) => {
    set('engine_action', a);
    if (!(METHOD_ALLOWED_ACTIONS[form.method] ?? []).includes(a)) set('method', ACTION_DEFAULT_METHOD[a]);
  };

  const handleMethod = (m: HttpMethod) => {
    set('method', m);
    const allowed = METHOD_ALLOWED_ACTIONS[m] ?? [];
    if (!allowed.includes(form.engine_action)) set('engine_action', allowed[0] ?? 'list');
  };

  const selObj  = engineObjects.find((o: EngineObject) => o.code === `${form.db_schema}.${form.db_object}`);
  const selRes  = resources.find((r: ApiResource) => r.code === form.resource_code);
  const base    = selRes?.base_url?.replace(/\/$/, '') ?? window.location.origin;
  const fullUrl = form.url_path ? `${base}/api/v1/run${form.url_path}` : '';

  const tabProps: TabProps = { form, dbCols, resources, fnResponseKeys, set };

  // ── Render ────────────────────────────────────────────────────────────────
  const statusCls =
    form.status === 'active'     ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700'
    : form.status === 'deprecated' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
    :                               'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Sticky header — back, title, status, save */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center gap-3 max-w-[1600px] mx-auto">
          <button onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
            <ChevronLeft size={18} />
          </button>
          <span className="flex-1 min-w-0 text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
            {form.name || (isEdit ? 'Edit Endpoint' : 'New Endpoint')}
          </span>
          <select value={form.status} onChange={e => set('status', e.target.value as EndpointStatus)}
            className={`text-xs font-medium rounded-full px-3 py-1 border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${statusCls}`}>
            <option value="draft">● draft</option>
            <option value="active">● active</option>
            <option value="deprecated">● deprecated</option>
          </select>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="btn-primary text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 px-6 py-5 max-w-[1600px] mx-auto">

        {/* LEFT — three cards stacked */}
        <div className="space-y-4 min-w-0">

          {/* ── Block 1: Identity ── */}
          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <FL>Name</FL>
                <input
                  type="text"
                  className="input w-full font-medium"
                  placeholder="e.g. List Countries"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>
              <div>
                <FL>Description</FL>
                <textarea
                  className="input w-full resize-none"
                  rows={2}
                  placeholder="What does this endpoint do?"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                />
              </div>
              <div>
                <FL>URI Resource</FL>
                <select className="input w-full" value={form.resource_code}
                  onChange={e => set('resource_code', e.target.value)}>
                  <option value="">Platform default (no resource)</option>
                  {resources.map((r: ApiResource) =>
                    <option key={r.code} value={r.code}>{r.name} — {r.base_url}</option>
                  )}
                </select>
                {selRes && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    {selRes.base_url?.replace(/\/$/, '')}
                    <span className="mx-1.5 text-gray-300">·</span>
                    <AuthBadge type={selRes.auth_type} />
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* ── Block 2: Method, Operation, Schema, Object, URL ── */}
          <Card className="p-5 space-y-5">

            {/* Row 1 — HTTP Method + Operation (same row) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FL>HTTP Method</FL>
                <div className={`flex items-center rounded-lg border overflow-hidden transition-colors ${METHOD_SELECT_BORDER[form.method]}`}>
                  <span className={`px-2.5 text-[10px] font-black font-mono tracking-wider shrink-0 py-[9px] border-r ${METHOD_SELECT_BADGE[form.method]}`}>
                    {form.method}
                  </span>
                  <select
                    value={form.method}
                    onChange={e => handleMethod(e.target.value as HttpMethod)}
                    className="flex-1 min-w-0 appearance-none bg-transparent text-sm font-medium px-2.5 py-2 focus:outline-none cursor-pointer text-gray-700 dark:text-gray-300"
                  >
                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown size={13} className="mr-2.5 text-gray-400 shrink-0 pointer-events-none" />
                </div>
              </div>
              <div>
                <FL>Operation</FL>
                <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <span className="px-2.5 text-gray-400 shrink-0 py-[9px] border-r border-gray-200 dark:border-gray-700">
                    {form.engine_action === 'list'   && <ListIcon size={13} />}
                    {form.engine_action === 'insert' && <Plus size={13} />}
                    {form.engine_action === 'update' && <Pencil size={13} />}
                    {form.engine_action === 'delete' && <Trash2 size={13} />}
                  </span>
                  <select
                    value={form.engine_action}
                    onChange={e => handleAction(e.target.value as EngineAction)}
                    className="flex-1 min-w-0 appearance-none bg-transparent text-sm font-medium px-2.5 py-2 focus:outline-none cursor-pointer text-gray-700 dark:text-gray-300"
                  >
                    {ENGINE_ACTIONS.map(a => {
                      const allowed = (METHOD_ALLOWED_ACTIONS[form.method] ?? []).includes(a);
                      return (
                        <option key={a} value={a} disabled={!allowed}>
                          {ACTION_LABEL[a]}{!allowed ? ' (not allowed)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown size={13} className="mr-2.5 text-gray-400 shrink-0 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Schema / Table search / Type / Object — switches to service picker */}
            {typeFilter === 'service' ? (
              /* ── Service mode ─────────────────────────────── */
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <div>
                  <FL>Type</FL>
                  <select className="input w-full" value={typeFilter}
                    onChange={e => {
                      setTypeFilter(e.target.value);
                      set('db_object', ''); set('db_type', ''); set('db_schema', ''); set('columns', []);
                      setNameFilter('');
                    }}>
                    <option value="">All</option>
                    <option value="table">Table</option>
                    <option value="view">View</option>
                    <option value="function">Function</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <FL>Service</FL>
                  <select className="input w-full" value={form.db_object}
                    onChange={e => {
                      set('db_object', e.target.value);
                      set('db_type', 'service');
                      set('db_schema', '');
                      set('columns', []);
                      setUrlEd(false);
                    }}>
                    <option value="">— select service —</option>
                    {(registeredServices as ServiceDef[]).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  {form.db_object && (registeredServices as ServiceDef[]).find(s => s.name === form.db_object)?.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 pl-0.5">
                      {(registeredServices as ServiceDef[]).find(s => s.name === form.db_object)?.description}
                    </p>
                  )}
                  {registeredServices.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 pl-0.5">
                      No services registered — add a class to services/loader.py.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* ── DB object mode ───────────────────────────── */
              <div className="grid grid-cols-[160px_1fr_130px_1fr] gap-3">
                <div>
                  <FL>Schema</FL>
                  <select className="input w-full" value={form.db_schema}
                    onChange={e => {
                      set('db_schema', e.target.value);
                      set('db_object', ''); set('db_type', ''); set('columns', []);
                      setTypeFilter(''); setNameFilter('');
                    }}>
                    <option value="">Schema…</option>
                    {(allSchemas as string[]).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <FL>Table</FL>
                  <select className="input w-full" value={nameFilter} disabled={!form.db_schema}
                    onChange={e => {
                      setNameFilter(e.target.value);
                      if (form.db_object && !form.db_object.includes(e.target.value)) {
                        set('db_object', ''); set('db_type', ''); set('columns', []);
                      }
                    }}>
                    <option value="">All…</option>
                    {(dbObjects as { name: string; type: string }[])
                      .filter(o => o.type === 'table')
                      .map(o => o.name)
                      .sort()
                      .map(n => <option key={n} value={n}>{n}</option>)
                    }
                  </select>
                </div>
                <div>
                  <FL>Type</FL>
                  <select className="input w-full" value={typeFilter}
                    onChange={e => {
                      const val = e.target.value;
                      setTypeFilter(val);
                      if (val && form.db_type && form.db_type !== val) {
                        set('db_object', ''); set('db_type', ''); set('columns', []);
                      }
                    }}>
                    <option value="">All</option>
                    <option value="table">Table</option>
                    <option value="view">View</option>
                    <option value="function">Function</option>
                    <option value="service">Service</option>
                  </select>
                </div>
                <div>
                  <FL>Object</FL>
                  <select className="input w-full" value={form.db_object} disabled={!form.db_schema}
                    onChange={e => {
                      const o = (dbObjects as { name: string; type: string }[]).find(x => x.name === e.target.value);
                      set('db_object', e.target.value);
                      set('db_type', o?.type ?? 'table');
                      set('columns', []);
                      setUrlEd(false);
                      if (e.target.value) setNameFilter(deriveBaseTable(e.target.value));
                    }}>
                    <option value="">Object…</option>
                    {(dbObjects as { name: string; type: string }[])
                      .filter(o =>
                        (!typeFilter || o.type === typeFilter) &&
                        (!nameFilter || o.name === nameFilter || o.name.includes(nameFilter))
                      )
                      .map(o => <option key={o.name} value={o.name}>{o.name} ({o.type})</option>)
                    }
                  </select>
                </div>
              </div>
            )}
            {typeFilter !== 'service' && !selObj && form.db_object && (
              <p className="text-xs text-amber-600 dark:text-amber-500 -mt-3 pl-0.5">
                Not in engine registry — will be registered on save.
              </p>
            )}

            {/* URL path */}
            <div>
              <FL>Endpoint URL</FL>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <span className={`flex items-center px-3 text-[11px] font-bold font-mono border-r border-gray-200 dark:border-gray-700 shrink-0 ${METHOD_PILL[form.method]}`}>
                  {form.method}
                </span>
                <input
                  value={form.url_path}
                  onChange={e => { set('url_path', e.target.value); setUrlEd(true); }}
                  placeholder="/gateway/object/action"
                  className="flex-1 min-w-0 font-mono text-sm px-3 py-2.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                />
                {form.url_path && (
                  <button onClick={() => navigator.clipboard.writeText(fullUrl || form.url_path)}
                    className="px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border-l border-gray-200 dark:border-gray-700 transition-colors shrink-0"
                    title="Copy full URL">
                    <Copy size={13} />
                  </button>
                )}
              </div>
              {fullUrl && (
                <p className="text-[11px] font-mono text-gray-400 truncate mt-1 pl-0.5">{fullUrl}</p>
              )}
            </div>
          </Card>

          {/* ── Block 3: Tabs ── */}
          <Card>
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-1">
              {FORM_TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                    ${activeTab === id
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {activeTab === 'request'  && <DetailsTab   {...tabProps} />}
              {activeTab === 'response' && <ResponseTab  {...tabProps} />}
              {activeTab === 'query'    && <ConfigureTab {...tabProps} />}
              {activeTab === 'auth'     && <AuthTab      {...tabProps} />}
            </div>
          </Card>
        </div>

        {/* RIGHT — contract preview (sticky) */}
        <div className="xl:sticky xl:top-[61px] xl:self-start xl:h-[calc(100vh-77px)] flex flex-col min-w-0">
          <ContractPreview form={form} dbCols={dbCols} fnResponseKeys={fnResponseKeys} />
        </div>
      </div>
    </div>
  );
}
