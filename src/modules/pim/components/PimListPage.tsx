import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { cellValue, toStr } from '@/lib/formatting';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TableDef {
  has_label: boolean;
  fields:    ToolkitField[];
  options:   ToolkitFieldOption[];
}

export interface PimEntityApi {
  meta: () => Promise<TableDef>;
  list: (p: {
    filters?: Record<string, unknown>;
    sort?:    { field: string; direction: 'asc' | 'desc' }[];
    limit?:   number;
    offset?:  number;
  }) => Promise<{ rows: Row[]; total: number }>;
  delete: (id: string | number) => Promise<unknown>;
}

export interface PimListPageProps {
  entityCode:  string;
  title:       string;
  schemaLabel: string;
  basePath:    string;
  api:         PimEntityApi;
  deleteLabel: string;
  newLabel:    string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PimListPage({
  entityCode, title, schemaLabel, basePath, api, deleteLabel, newLabel,
}: PimListPageProps) {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [page,         setPage]         = useState(1);
  const [pageSize,     setPageSize]     = useState(100);
  const [colFilters,   setColFilters]   = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [visibleCols,      setVisibleCols]      = useState<string[]>([]);
  const [deleting,         setDeleting]         = useState<string | number | null>(null);
  const colsInitialized = useRef(false);

  // Reset all per-entity state when the entity changes (component stays mounted across navigation)
  useEffect(() => {
    colsInitialized.current = false;
    setVisibleCols([]);
    setColFilters({});
    setPage(1);
  }, [entityCode]);

  useEffect(() => { setPage(1); }, [colFilters, showInactive]);

  // ── Queries ──

  // Page definition is required — drives which columns appear and in what order
  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey:  ['toolkit-page-def', entityCode],
    queryFn:   () => pageDefsApi.get(entityCode),
    staleTime: 0,
    retry:     false,
  });

  // Toolkit field metadata — optional, used for labels and type-aware cell rendering
  const { data: tableDef } = useQuery<TableDef>({
    queryKey:  ['toolkit-table', entityCode],
    queryFn:   api.meta,
    staleTime: 5 * 60_000,
    retry:     false,
    enabled:   !!pageDef,
  });

  // Static filters from page definition — always applied, but showInactive can override is_active
  const staticFilters = useMemo(() => {
    const sf = pageDef?.list_config?.static_filters;
    if (!sf || typeof sf !== 'object') return {} as Record<string, unknown>;
    return { ...(sf as Record<string, unknown>) };
  }, [pageDef]);

  const sortFields = useMemo(
    () => (pageDef?.list_config?.sort_fields ?? []) as { field: string; direction: 'asc' | 'desc' }[],
    [pageDef],
  );

  const pageSizeOptions = useMemo(() => {
    const dl = pageDef?.list_config?.default_limit;
    const ml = pageDef?.list_config?.max_limit;
    if (!dl) return [100, 200, 300];
    if (!ml || ml <= dl) return [dl];
    const steps: number[] = [];
    for (let s = dl; s <= ml; s += dl) steps.push(s);
    if (steps[steps.length - 1] !== ml) steps.push(ml);
    return steps;
  }, [pageDef]);

  // Build the filter_op map from the page def columns
  const filterOpMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of pageDef?.list_config?.columns ?? []) {
      if (c.filter_op) m.set(c.code, c.filter_op);
    }
    return m;
  }, [pageDef]);

  // Merge static filters + is_active toggle + user column filters into p_filters.
  // toolkit.fn_where format: plain value = eq, {"op": "...", "value": ...} = explicit operator.
  const serverFilters = useMemo(() => {
    const flat: Record<string, unknown> = {
      ...staticFilters,
      ...(!showInactive ? { is_active: true } : {}),
    };
    for (const [k, v] of Object.entries(colFilters)) {
      if (!v) continue;
      const op = filterOpMap.get(k) ?? 'eq';
      flat[k] = op === 'eq' ? v : { op, value: op === 'ilike' ? `%${v}%` : v };
    }
    return flat;
  }, [staticFilters, showInactive, colFilters, filterOpMap]);

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey:        ['pim-list', entityCode, showInactive, page, pageSize, colFilters, [...filterOpMap.entries()]],
    queryFn:         () => api.list({ filters: serverFilters as Record<string, unknown>, sort: sortFields.length ? sortFields : undefined, limit: pageSize, offset: (page - 1) * pageSize }),
    enabled:         !!pageDef,
    placeholderData: prev => prev,
  });

  const rows  = result?.rows  ?? [];
  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // ── Delete ──

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => api.delete(id),
    onSuccess: () => {
      toast.success(`${deleteLabel} deleted`);
      qc.invalidateQueries({ queryKey: ['pim-list', entityCode] });
      setDeleting(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  // ── Columns — built entirely from the page definition ──

  const allDataColumns = useMemo<AdminTableColumn<Row>[]>(() => {
    const defCols = pageDef?.list_config?.columns ?? [];
    if (!defCols.length) return [];

    const fieldMap = new Map((tableDef?.fields ?? []).map((f: ToolkitField) => [f.code, f]));

    return defCols.map(c => {
      const f       = fieldMap.get(c.code);
      const dataKey = c.bindkey || c.code;  // bindkey overrides where data is read from
      const header  = c.label || f?.label || c.code.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
      return {
        key:    c.code,
        header,
        width:  150,
        render: (row: Row) => {
          const v = row[dataKey];
          if (v == null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
          if (typeof v === 'object') {
            return <span className="block truncate">{toStr(v) ?? '—'}</span>;
          }
          if (f) {
            const opts = (tableDef?.options ?? []).filter((o: ToolkitFieldOption) => o.field_id === f.id);
            return <span className="block truncate">{cellValue(row, f, opts)}</span>;
          }
          return <span className="block truncate">{String(v)}</span>;
        },
      };
    });
  }, [pageDef, tableDef]);

  const actionsCol = useMemo<AdminTableColumn<Row>>(() => ({
    key: '__actions', header: '', width: 80, noResize: true,
    render: row => (
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); navigate(`${basePath}/${row.id}/edit`); }}
          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
          title="Edit"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); setDeleting(row.id as string | number); }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    ),
  }), [basePath, navigate]);

  // Initialise visible columns and page size from the page definition (once per page def load)
  useEffect(() => {
    if (colsInitialized.current || !pageDef?.list_config?.columns?.length) return;
    colsInitialized.current = true;
    setVisibleCols(
      pageDef.list_config.columns
        .filter(c => c.visible)
        .sort((a, b) => a.order - b.order)
        .map(c => c.code),
    );
    if (pageDef.list_config.default_limit) {
      setPageSize(pageDef.list_config.default_limit);
    }
  }, [pageDef]);

  const configOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    (pageDef?.list_config?.columns ?? []).forEach(c => map.set(c.code, c.order));
    return map;
  }, [pageDef]);

  const displayCols = useMemo(() => {
    if (!visibleCols.length) return allDataColumns;
    const visible = allDataColumns.filter(c => visibleCols.includes(c.key));
    visible.sort((a, b) => (configOrderMap.get(a.key) ?? 9999) - (configOrderMap.get(b.key) ?? 9999));
    return visible;
  }, [allDataColumns, visibleCols, configOrderMap]);

  const tableColumns = [...displayCols, actionsCol];

  // ── Filters ──

  const handleFilterChange = (colKey: string, val: string) => {
    if (colKey.startsWith('__') || !filterOpMap.has(colKey)) return;
    setColFilters(prev => {
      if (!val.trim()) { const n = { ...prev }; delete n[colKey]; return n; }
      return { ...prev, [colKey]: val };
    });
  };

  // Only expose filter inputs for columns that have a filter_op configured
  const tableFilters: Record<string, string> = {};
  for (const col of displayCols) {
    if (!col.key.startsWith('__') && filterOpMap.has(col.key)) {
      tableFilters[col.key] = colFilters[col.key] ?? '';
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingDef) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!pageDef?.list_config?.columns?.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Contact Administrator to define the Page Definition for{' '}
          <strong className="text-gray-700 dark:text-gray-200">{title}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">

      <div className="flex items-center gap-3 shrink-0 border-b border-gray-200 dark:border-gray-700 pb-3">
        <h1 className="pim-title flex-1 min-w-0">{title}</h1>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0 group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            <div className={`w-7 h-4 rounded-full transition-colors duration-200 ${showInactive ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${showInactive ? 'translate-x-3' : ''}`} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
            Show inactive
          </span>
        </label>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* New button */}
        <button
          onClick={() => navigate(`${basePath}/new`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
        >
          <Plus size={13} strokeWidth={2.5} />
          {newLabel}
        </button>
      </div>

      <AdminTable<Row>
        columns={tableColumns}
        rows={rows}
        rowKey={row => String(row.id)}
        total={total}
        page={page}
        pageSize={pageSize}
        pages={pages}
        onPage={setPage}
        onPageSize={s => { setPageSize(s); setPage(1); }}
        pageSizes={pageSizeOptions}
        isLoading={isLoading}
        isFetching={isFetching}
        filters={tableFilters}
        onFilterChange={handleFilterChange}
        onRowClick={row => navigate(`${basePath}/${row.id}/edit`)}
        emptyMessage={`No ${deleteLabel}s found`}
        columnSelector={{
          all:      allDataColumns.map(c => ({ key: c.key, header: c.header })),
          visible:  visibleCols,
          onChange: setVisibleCols,
        }}
        className="flex-1 min-h-0"
      />

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleteLabel}`}
        message={`This will permanently delete this ${deleteLabel}. Continue?`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting !== null && deleteMut.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
