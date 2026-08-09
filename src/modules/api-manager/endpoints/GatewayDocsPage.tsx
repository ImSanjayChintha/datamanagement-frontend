import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, Eye, EyeOff, Search, X,
  FileText, FlaskConical,
} from 'lucide-react';
import { endpointsApi, schemaBrowserApi } from './api';
import type { ApiEndpoint, DbColumn, FunctionDef } from '@/types/gateway';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';

// ── Colour maps ───────────────────────────────────────────────────────────────

const METHOD_CLS: Record<string, string> = {
  GET:    'bg-sky-100     text-sky-700     dark:bg-sky-900/40    dark:text-sky-300',
  POST:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  PUT:    'bg-indigo-100  text-indigo-700  dark:bg-indigo-900/40  dark:text-indigo-300',
  PATCH:  'bg-amber-100   text-amber-700   dark:bg-amber-900/40   dark:text-amber-300',
  DELETE: 'bg-rose-100    text-rose-700    dark:bg-rose-900/40    dark:text-rose-300',
};

const STATUS_CLS: Record<string, string> = {
  active:     'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  draft:      'bg-gray-100   text-gray-500    dark:bg-gray-700       dark:text-gray-400',
  deprecated: 'bg-rose-50    text-rose-600    dark:bg-rose-900/30    dark:text-rose-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SYSTEM_COLS = new Set(['inserted_at', 'modified_at', 'inserted_by', 'modified_by', 'created_at', 'updated_at']);

function pgTypeToExample(type?: string): unknown {
  if (!type) return 'string';
  const t = type.toLowerCase();
  if (t.includes('int') || t === 'bigint' || t === 'smallint') return 0;
  if (t.includes('numeric') || t.includes('decimal') || t.includes('float') || t.includes('double')) return 0.0;
  if (t === 'boolean' || t === 'bool') return true;
  if (t === 'date') return '2024-01-01';
  if (t.includes('timestamp')) return '2024-01-01T00:00:00Z';
  if (t === 'uuid') return '00000000-0000-0000-0000-000000000000';
  if (t === 'jsonb' || t === 'json') return {};
  if (t.includes('array') || t.endsWith('[]')) return [];
  return 'string';
}

function normaliseEpCols(ep: ApiEndpoint, schemaCols: DbColumn[]): DbColumn[] {
  const raw = ep.columns as unknown as (string | { name: string; type?: string })[];
  if (raw.length === 0) return schemaCols;
  const byName = new Map(schemaCols.map(c => [c.name, c]));
  return raw
    .map(c => {
      const name = typeof c === 'string' ? c : c.name;
      return byName.get(name) ?? { name, type: undefined, nullable: true };
    })
    .filter(c => c.name);
}

function detectFnOp(dbObject: string): 'insert' | 'upsert' | 'sync' | 'delete' | 'bulk_insert' | 'update' | 'other' {
  const obj = dbObject.toLowerCase().replace(/^fn_/, '');
  if (obj.startsWith('upsert_'))                                        return 'upsert';
  if (obj.startsWith('sync_'))                                          return 'sync';
  if (obj.startsWith('bulk_insert_') || obj.startsWith('bulk-insert_')) return 'bulk_insert';
  if (obj.startsWith('insert_'))                                        return 'insert';
  if (obj.startsWith('delete_'))                                        return 'delete';
  if (obj.startsWith('update_'))                                        return 'update';
  return 'other';
}

function filterExample(ep: ApiEndpoint): object {
  if (ep.filters.length > 0) {
    return Object.fromEntries(
      ep.filters.flatMap(f => [
        [f.column, 'value'],
        [`${f.column}__op`, f.operators?.[0] ?? 'eq'],
      ])
    );
  }
  return { id: 1, id__op: 'eq' };
}

function rowExample(cols: DbColumn[]): Record<string, unknown> {
  return Object.fromEntries(cols.map(c => [c.name, pgTypeToExample(c.type)]));
}

const _FN_WRITE_OPS = /^(upsert|sync|bulk_insert|bulk[-_]insert|insert|delete|update)_/;

function isFunctionWriteEp(ep: ApiEndpoint): boolean {
  const op = ep.operation_type ?? 'select';
  if (op === 'select') return false;
  if (ep.db_type === 'function') return true;
  const obj = (ep.db_object ?? '').toLowerCase().replace(/^fn_/, '');
  if (_FN_WRITE_OPS.test(obj)) return true;
  const seg = (ep.url_path ?? '').split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  return /^(upsert|sync|bulk[-_]?insert|bulk_insert)$/.test(seg);
}

function buildRequestExample(ep: ApiEndpoint, cols: DbColumn[]): object {
  const op              = ep.operation_type ?? 'select';
  const isFunctionWrite = isFunctionWriteEp(ep);
  const writable        = cols.filter(c => !SYSTEM_COLS.has(c.name));

  if (isFunctionWrite) {
    const fnOp = detectFnOp(ep.db_object ?? '');
    if (fnOp === 'delete') return { filters: filterExample(ep) };
    const row = writable.length > 0 ? rowExample(writable) : { code: 'string', name: 'string' };
    return { data: [row] };
  }
  if (op === 'select') return { filters: filterExample(ep), limit: 25, offset: 0, sort: [{ column: 'id', direction: 'asc' }] };
  if (op === 'insert') {
    const data = writable.length > 0 ? rowExample(writable) : { name: 'string' };
    return { data };
  }
  if (op === 'update') {
    const patch_data = writable.length > 0 ? rowExample(writable.slice(0, 4)) : { name: 'new value' };
    return { filters: filterExample(ep), patch_data };
  }
  if (op === 'delete') return { filters: filterExample(ep) };
  return {};
}

function parseFnReturnShape(source: string): Record<string, unknown> | null {
  const match = source.match(/return\s+jsonb_build_object\s*\(\s*([^)]+)\s*\)\s*;/i);
  if (!match) return null;
  const tokens = match[1].split(',').map(t => t.trim());
  const keys: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const m = tokens[i].match(/^'([^']+)'$/);
    if (m) keys.push(m[1]);
  }
  if (keys.length === 0) return null;
  return Object.fromEntries(keys.map(k => {
    if (k === 'ok')          return [k, true];
    if (k.includes('error')) return [k, null];
    return [k, 0];
  }));
}

function buildResponseExample(ep: ApiEndpoint, cols: DbColumn[], fnDef?: FunctionDef | null): object {
  const op              = ep.operation_type ?? 'select';
  const isFunctionWrite = isFunctionWriteEp(ep);
  const envelope        = (data: unknown) => ({ success: true, data, error: null });
  const writable        = cols.filter(c => !SYSTEM_COLS.has(c.name));

  if (isFunctionWrite) {
    const fnOp = detectFnOp(ep.db_object ?? '');
    if (fnDef?.source) {
      const parsed = parseFnReturnShape(fnDef.source);
      if (parsed) return envelope(parsed);
    }
    switch (fnOp) {
      case 'upsert':      return envelope({ ok: true, inserted: 1, updated: 2, upserted: 3 });
      case 'sync':        return envelope({ ok: true, inserted: 1, updated: 2, deactivated: 0, upserted: 3 });
      case 'insert':
      case 'bulk_insert': return envelope({ ok: true, inserted: 2 });
      case 'delete':      return envelope({ ok: true, deleted: 1 });
      default:            return envelope({ ok: true });
    }
  }
  if (op === 'select') {
    const row = cols.length > 0 ? rowExample(cols) : { id: 1, name: 'string' };
    return envelope([row]);
  }
  if (op === 'insert') {
    const row = writable.length > 0 ? { id: 1, ...rowExample(writable) } : { id: 1, name: 'string' };
    return envelope(row);
  }
  if (op === 'update') {
    const row = writable.length > 0 ? { id: 1, ...rowExample(writable.slice(0, 3)) } : { id: 1, name: 'string' };
    return envelope([row]);
  }
  if (op === 'delete') return envelope({ deleted: 1 });
  return envelope({ ok: true });
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────

function CodeBlock({ value }: { value: object }) {
  return (
    <pre className="text-xs font-mono bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

const FN_OP_PREFIXES  = /^fn_(list|get|insert|update|delete|upsert|sync|search|bulk_insert|bulk[-_]insert)_/i;
const BARE_OP_PREFIXES = /^(upsert|sync|bulk_insert|bulk[-_]insert|insert|update|delete|list|get|search)_/i;

function deriveBaseObj(objName: string): string {
  return objName
    .replace(FN_OP_PREFIXES, '')
    .replace(/^fn_/i, '')
    .replace(/^v_/i, '')
    .replace(BARE_OP_PREFIXES, '');
}

export function EndpointDetail({ ep, onClose, fullPage }: { ep: ApiEndpoint; onClose: () => void; fullPage?: boolean }) {
  const isFnWrite = isFunctionWriteEp(ep);

  const { data: schemaCols = [] } = useQuery({
    queryKey: ['doc-cols', ep.db_schema, ep.db_object, ep.db_type],
    queryFn:  () => schemaBrowserApi.columns(ep.db_schema!, ep.db_object!, ep.db_type),
    enabled:  !!ep.db_schema && !!ep.db_object,
    staleTime: 5 * 60 * 1000,
  });

  const baseObj = deriveBaseObj(ep.db_object ?? '');
  const needsBaseTable = isFnWrite && (schemaCols as DbColumn[]).length === 0 && !!ep.db_schema && !!baseObj && baseObj !== ep.db_object;

  const { data: baseTableCols = [] } = useQuery({
    queryKey: ['doc-cols', ep.db_schema, baseObj, 'table'],
    queryFn:  () => schemaBrowserApi.columns(ep.db_schema!, baseObj, 'table'),
    enabled:  needsBaseTable,
    staleTime: 5 * 60 * 1000,
  });

  const fnName = useMemo(() => {
    if (!isFnWrite || !ep.db_schema || !ep.db_object) return null;
    const obj = ep.db_object.toLowerCase();
    if (/^(fn_)?(upsert|sync|bulk_insert|bulk[-_]insert|insert|delete|update)_/.test(obj)) return ep.db_object;
    const seg = (ep.url_path ?? '').split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
    if (seg && seg !== obj) return `${seg}_${obj}`;
    return null;
  }, [ep.db_object, ep.url_path, ep.db_schema, isFnWrite]);

  const { data: fnDef } = useQuery({
    queryKey: ['doc-fn-def', ep.db_schema, fnName],
    queryFn:  () => schemaBrowserApi.functionDef(ep.db_schema!, fnName!),
    enabled:  !!fnName && !!ep.db_schema,
    staleTime: 10 * 60 * 1000,
  });

  const rawSchemaCols = ((schemaCols as DbColumn[]).length > 0 ? schemaCols : baseTableCols) as DbColumn[];
  const effectiveCols = useMemo(() => normaliseEpCols(ep, rawSchemaCols), [ep, rawSchemaCols]);
  const reqExample  = useMemo(() => buildRequestExample(ep, effectiveCols), [ep, effectiveCols]);
  const respExample = useMemo(() => buildResponseExample(ep, effectiveCols, fnDef as FunctionDef | null | undefined), [ep, effectiveCols, fnDef]);

  const mc = METHOD_CLS[ep.method] ?? '';

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* detail header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <span className={`shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded ${mc}`}>
          {ep.method}
        </span>
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate flex-1 min-w-0">
          {ep.url_path}
        </span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 hidden md:block truncate max-w-xs">
          {ep.name}
        </span>
        {ep.status !== 'active' && (
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${STATUS_CLS[ep.status] ?? ''}`}>
            {ep.status}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* meta row */}
      <div className="px-4 py-2 bg-gray-50/60 dark:bg-gray-800/20 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-gray-400 dark:text-gray-500">
        {ep.description && <span className="font-sans text-gray-500 dark:text-gray-400 not-italic">{ep.description}</span>}
        {ep.db_schema      && <span>schema: <span className="text-gray-700 dark:text-gray-300">{ep.db_schema}</span></span>}
        {ep.db_object      && <span>object: <span className="text-gray-700 dark:text-gray-300">{ep.db_object}</span></span>}
        {ep.db_type        && <span>type: <span className="text-gray-700 dark:text-gray-300">{ep.db_type}</span></span>}
        {ep.operation_type && <span>op: <span className="text-gray-700 dark:text-gray-300">{ep.operation_type}</span></span>}
      </div>

      {/* request / response */}
      <div className={`grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700 overflow-auto ${fullPage ? '' : 'max-h-80'}`}>

        {/* Request */}
        <div className="px-4 py-3 space-y-3 overflow-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Request body</p>

          {ep.headers.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Required headers</p>
              <div className="flex flex-wrap gap-1">
                {ep.headers.map((h, i) => (
                  <span key={i} className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 text-gray-600 dark:text-gray-300">
                    {h.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ep.filters.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">Available filters</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-1 pr-4 font-medium text-gray-500 dark:text-gray-400">Field</th>
                    <th className="pb-1 font-medium text-gray-500 dark:text-gray-400">Operators</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {ep.filters.map((f, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-0.5 pr-4 font-mono">{f.label || f.column}</td>
                      <td className="py-0.5 text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                        {f.operators?.join(', ') || 'eq'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isFnWrite && effectiveCols.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">data[] item fields</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-1 pr-4 font-medium text-gray-500 dark:text-gray-400">Field</th>
                    <th className="pb-1 font-medium text-gray-500 dark:text-gray-400">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {effectiveCols.filter(c => !SYSTEM_COLS.has(c.name)).map((c, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-0.5 pr-4 font-mono">{c.name}</td>
                      <td className="py-0.5 text-gray-500 dark:text-gray-400 font-mono text-[10px]">{c.type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <CodeBlock value={reqExample} />
        </div>

        {/* Response */}
        <div className="px-4 py-3 space-y-3 overflow-auto">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Response</p>
            {(fnDef as FunctionDef | null | undefined)?.return_type && (
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                returns {(fnDef as FunctionDef).return_type}
              </span>
            )}
          </div>

          {!isFnWrite && effectiveCols.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">Fields</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-1 pr-4 font-medium text-gray-500 dark:text-gray-400">Column</th>
                    <th className="pb-1 font-medium text-gray-500 dark:text-gray-400">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {effectiveCols.map((c, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-0.5 pr-4 font-mono">{c.name}</td>
                      <td className="py-0.5 text-gray-500 dark:text-gray-400 font-mono text-[10px]">{c.type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <CodeBlock value={respExample} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GatewayDocsPage() {
  const navigate = useNavigate();

  const [search,       setSearch]    = useState('');
  const [statusFilter, setStatus]    = useState('active');
  const [page,         setPage]      = useState(1);
  const [pageSize,     setPageSize]  = useState(25);
  const [refreshKey,   setRefreshKey] = useState(0);

  const q = useDebounce(search, 300);

  useEffect(() => { setPage(1); }, [q, statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['gateway-docs-endpoints', { search: q, status: statusFilter, page, pageSize, refreshKey }],
    queryFn:  () => endpointsApi.list({
      search:    q            || undefined,
      status:    statusFilter || undefined,
      page,
      page_size: pageSize,
    }),
    placeholderData: (prev) => prev,
  });

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;


  // ── Column definitions ────────────────────────────────────────────────────

  const columns: AdminTableColumn<ApiEndpoint>[] = useMemo(() => [
    {
      key:      'method',
      header:   'Method',
      width:    80,
      minWidth: 70,
      noResize: true,
      render: ep => (
        <span className={`inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_CLS[ep.method] ?? ''}`}>
          {ep.method}
        </span>
      ),
    },
    {
      key:    'name',
      header: 'Name / Path',
      width:  300,
      render: ep => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate leading-snug text-[12px]">
            {ep.name}
          </p>
          <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate leading-snug mt-0.5">
            {ep.url_path}
          </p>
        </div>
      ),
    },
    {
      key:    'db_object',
      header: 'DB Object',
      width:  220,
      render: ep => ep.db_object ? (
        <span className="font-mono text-[11px] flex items-baseline gap-0.5 min-w-0">
          <span className="text-gray-400 dark:text-gray-500 shrink-0">{ep.db_schema}.</span>
          <span className="text-gray-700 dark:text-gray-300 truncate">{ep.db_object}</span>
          {ep.db_type && (
            <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-600 font-sans shrink-0">{ep.db_type}</span>
          )}
        </span>
      ) : (
        <span className="text-gray-300 dark:text-gray-700">—</span>
      ),
    },
    {
      key:      'status',
      header:   'Status',
      width:    90,
      minWidth: 80,
      noResize: true,
      render: ep => (
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_CLS[ep.status] ?? ''}`}>
          {ep.status}
        </span>
      ),
    },
  ], []);

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-4">

      {/* ── Header ── */}
      <div className="page-header mb-0">
        <h1 className="pim-title">API Documentation</h1>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/gateway/swagger')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <FlaskConical size={12} /> Swagger UI
          </button>
          <button
            type="button"
            onClick={() => navigate('/gateway/openapi')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <FileText size={12} /> OpenAPI Spec
          </button>
          <button
            type="button"
            onClick={() => setStatus(s => s === '' ? 'active' : '')}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors ${
              statusFilter === ''
                ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400'
                : 'border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
            }`}
          >
            {statusFilter === '' ? <Eye size={13} /> : <EyeOff size={13} />}
            {statusFilter === '' ? 'All statuses' : 'Active only'}
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="shrink-0">
        <div className="relative w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search endpoints…"
            className="input pl-8 pr-3 py-1.5 w-full"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <AdminTable
        columns={columns}
        rows={rows}
        rowKey={ep => ep.id}
        total={total}
        page={page}
        pageSize={pageSize}
        pages={pages}
        onPage={setPage}
        onPageSize={setPageSize}
        isLoading={isLoading}
        isFetching={isFetching}
        onRowClick={ep => navigate(`/gateway/docs/${ep.id}`)}
        scrollKey={`${q}-${statusFilter}-${page}`}
        emptyMessage="No endpoints found"
        className="flex-1 min-h-0"
      />
    </div>
  );
}
