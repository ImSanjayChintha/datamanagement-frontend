import { useState, useEffect, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Eye, Database, Table2, X, Search } from 'lucide-react';
import { schemaBrowserApi } from '@/modules/api-manager/endpoints/api';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import Spinner from '@/components/ui/Spinner';
import { clsx } from 'clsx';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TableEntry { name: string; type: 'table' | 'view' | string }

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COL_W = 150;
const PAGE_SIZES    = [100, 200, 300];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ISO_DATE_RE     = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatDateValue(raw: string): string {
  if (ISO_DATETIME_RE.test(raw)) {
    const [datePart, timePart] = raw.split('T');
    const [y, m, d] = datePart.split('-');
    return `${d}-${m}-${y} ${timePart.slice(0, 5)}`;
  }
  if (ISO_DATE_RE.test(raw)) {
    const [y, m, d] = raw.split('-');
    return `${d}-${m}-${y}`;
  }
  return raw;
}

function cellDisplay(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return formatDateValue(String(v));
}

function isNull(v: unknown) { return v === null || v === undefined; }

// ── Main component ────────────────────────────────────────────────────────────

export default function SqlConsolePage() {
  const [schema,        setSchema]        = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [page,          setPage]          = useState(1);
  const [limit,         setLimit]         = useState(100);
  const [tableSearch,   setTableSearch]   = useState('');
  const [draftFilters,  setDraftFilters]  = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // ── Debounce column filters ────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => { setActiveFilters(draftFilters); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [draftFilters]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const handleSchemaChange = useCallback((s: string) => {
    setSchema(s); setSelectedTable(''); setDraftFilters({}); setActiveFilters({});
    setPage(1); setTableSearch('');
  }, []);

  const handleSelectTable = useCallback((name: string) => {
    setSelectedTable(name); setDraftFilters({}); setActiveFilters({}); setPage(1);
  }, []);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: schemas = [], isLoading: loadingSchemas } = useQuery({
    queryKey: ['db-schemas'],
    queryFn:  schemaBrowserApi.schemas,
    staleTime: 60_000,
  });

  const { data: allObjects = [], isLoading: loadingTables } = useQuery({
    queryKey: ['db-objects', schema],
    queryFn:  () => schemaBrowserApi.objects(schema),
    enabled:  !!schema,
    staleTime: 30_000,
  });

  const filteredTableList = (allObjects as TableEntry[])
    .filter(o => o.type === 'table' || o.type === 'view')
    .filter(t => !tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase()));

  const {
    data: tableData,
    isFetching: loadingData,
    isLoading: tableLoading,
  } = useQuery({
    queryKey:        ['table-data', schema, selectedTable, page, limit, activeFilters],
    queryFn:         () => schemaBrowserApi.tableData(schema, selectedTable, page, limit, activeFilters),
    enabled:         !!schema && !!selectedTable,
    staleTime:       0,
    placeholderData: keepPreviousData,
  });

  const dbColumns = tableData?.columns ?? [];
  const dbRows    = tableData?.rows    ?? [];
  const total     = tableData?.total   ?? 0;
  const pages     = Math.max(1, Math.ceil(total / limit));

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== '');

  // ── Build column definitions for AdminTable ────────────────────────────────

  const adminCols: AdminTableColumn<Record<string, unknown>>[] = dbColumns.map(col => ({
    key:    col,
    header: col,
    width:  DEFAULT_COL_W,
    render: (row: Record<string, unknown>) => {
      const v = row[col];
      return (
        <div
          className="truncate tabular-nums"
          title={isNull(v) ? 'NULL' : cellDisplay(v)}
        >
          {isNull(v) ? (
            <span className="text-gray-300 dark:text-gray-600 italic">NULL</span>
          ) : typeof v === 'boolean' ? (
            <span className={v ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400'}>
              {String(v)}
            </span>
          ) : (
            cellDisplay(v)
          )}
        </div>
      );
    },
  }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="absolute inset-0 flex gap-4 overflow-hidden">

      {/* Left panel */}
      <div className="w-52 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="px-3 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Schema</label>
          {loadingSchemas ? <Spinner size="sm" /> : (
            <select
              value={schema}
              onChange={e => handleSchemaChange(e.target.value)}
              className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— select —</option>
              {schemas.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {schema && (
          <div className="px-3 pt-2.5 pb-2">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="filter tables…"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700/50 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!schema && <p className="px-3 py-6 text-xs text-gray-400 text-center">Select a schema</p>}
          {schema && loadingTables && <div className="flex justify-center py-6"><Spinner size="sm" /></div>}
          {schema && !loadingTables && filteredTableList.length === 0 && (
            <p className="px-3 py-6 text-xs text-gray-400 text-center">No tables found</p>
          )}
          {filteredTableList.map(t => (
            <button
              key={t.name}
              onClick={() => handleSelectTable(t.name)}
              className={clsx(
                'w-full flex items-center justify-between gap-1.5 px-3 py-1.5 text-left text-xs transition-colors group',
                selectedTable === t.name
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50',
              )}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                {t.type === 'view'
                  ? <Database size={11} className="shrink-0 text-purple-400" />
                  : <Table2   size={11} className="shrink-0 text-gray-400" />}
                <span className="truncate">{t.name}</span>
              </span>
              <Eye size={12} className={clsx(
                'shrink-0 transition-opacity',
                selectedTable === t.name ? 'opacity-100 text-indigo-500' : 'opacity-0 group-hover:opacity-60',
              )} />
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-4 pr-6 pt-5">
        {!selectedTable ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 gap-3">
            <Eye size={40} strokeWidth={1} />
            <span className="text-sm">Select a table to browse its data</span>
          </div>
        ) : (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {schema}.{selectedTable}
                </h2>
                {loadingData && !tableLoading && <Spinner size="sm" />}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setDraftFilters({}); setActiveFilters({}); setPage(1); }}
                  className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <X size={11} /> Clear filters
                </button>
              )}
            </div>

            {/* Data grid */}
            <AdminTable<Record<string, unknown>>
              className="flex-1 min-h-0"
              columns={adminCols}
              rows={dbRows}
              rowKey={(_, i) => i}
              total={total}
              page={page}
              pages={pages}
              pageSize={limit}
              onPage={setPage}
              onPageSize={l => { setLimit(l); setPage(1); }}
              pageSizes={PAGE_SIZES}
              isLoading={tableLoading}
              isFetching={loadingData}
              loadingMessage={`Loading ${selectedTable}…`}
              filters={draftFilters}
              onFilterChange={(col, val) =>
                setDraftFilters(prev => ({ ...prev, [col]: val }))
              }
              scrollKey={selectedTable}
              emptyMessage="No rows match the current filters"
            />
          </>
        )}
      </div>
    </div>
  );
}
