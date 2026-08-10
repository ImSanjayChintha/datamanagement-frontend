import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, ChevronRight, Loader2, Pencil, Trash2,
  Package, X, Users, FolderTree,
  Download,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { cellValue, toStr } from '@/lib/formatting';
import { QK } from '@/lib/queryKeys';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { makeEntityApi, pimCategoriesApi } from '@/modules/pim/api';
import { catLabel } from './CategoryPicker';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import { toolkitExportApi } from '@/modules/toolkit/core/api';
// ── API instances ─────────────────────────────────────────────────────────────

const productsApi = makeEntityApi('products', 'products');
const familiesApi = makeEntityApi('families', 'families');

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TreeNode {
  id: number;
  code: string;
  name: string;
  raw: Row;
  isExpanded: boolean;
  isLoading: boolean;
  hasChildren: boolean;
  childrenLoaded: boolean;
  children: TreeNode[];
}

type FlatNode = TreeNode & { depth: number };

// ── Tree helpers ──────────────────────────────────────────────────────────────

function resolveName(row: Row): string {
  for (const key of ['name', 'label', 'title', 'code']) {
    const v = row[key];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      const en = o.en ?? o.EN;
      if (en) return String(en);
      const first = Object.values(o).find(x => x);
      if (first) return String(first);
    }
  }
  return `#${row.id}`;
}

function toTreeNode(row: Row, hasChildren = false): TreeNode {
  return {
    id: row.id as number, code: String(row.code ?? row.id),
    name: resolveName(row), raw: row,
    isExpanded: false, isLoading: false,
    hasChildren, childrenLoaded: false, children: [],
  };
}

function updateNodeDeep(nodes: TreeNode[], id: number, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map(n => {
    if (n.id === id) return fn(n);
    if (n.children.length) return { ...n, children: updateNodeDeep(n.children, id, fn) };
    return n;
  });
}

function flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.isExpanded) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

async function fetchCategoryLevel(parentCode: string | null): Promise<TreeNode[]> {
  const res = await pimCategoriesApi.list({ filters: { parent_code: parentCode }, limit: 300 });
  if (res.rows.length === 0) return [];
  const nodes = res.rows.map(r => toTreeNode(r, false));
  try {
    const codes = nodes.map(n => n.code);
    const childCheck = await pimCategoriesApi.list({
      filters: { parent_code: { op: 'in', value: codes } }, limit: 500,
    });
    const withChildren = new Set(childCheck.rows.map(r => String(r.parent_code)));
    return nodes.map(n => ({ ...n, hasChildren: withChildren.has(n.code) }));
  } catch {
    return nodes.map(n => ({ ...n, hasChildren: true }));
  }
}

// ── Category tree panel ───────────────────────────────────────────────────────

function CategoryTree({
  selectedCode, onSelect,
}: {
  selectedCode: string | null;
  onSelect: (code: string | null, name: string) => void;
}) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loadingRoot, setLoadingRoot] = useState(true);

  useEffect(() => {
    fetchCategoryLevel(null)
      .then(nodes => { setRoots(nodes); setLoadingRoot(false); })
      .catch(() => { toast.error('Failed to load categories'); setLoadingRoot(false); });
  }, []);

  async function toggleExpand(node: FlatNode, e: React.MouseEvent) {
    e.stopPropagation();
    if (node.isExpanded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: false })));
      return;
    }
    if (node.childrenLoaded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: true })));
      return;
    }
    setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: true })));
    try {
      const children = await fetchCategoryLevel(node.code);
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({
        ...n, isLoading: false, isExpanded: children.length > 0,
        hasChildren: children.length > 0, childrenLoaded: true, children,
      })));
    } catch {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: false })));
    }
  }

  const flat = useMemo(() => flattenTree(roots), [roots]);

  if (loadingRoot) {
    return <div className="flex justify-center py-4"><Spinner size="sm" /></div>;
  }
  if (flat.length === 0) {
    return <p className="px-4 py-3 text-xs text-gray-400 italic">No categories found</p>;
  }

  return (
    <div className="overflow-y-auto">
      {flat.map(node => {
        const active = selectedCode === node.code;
        return (
          <div
            key={node.id}
            style={{ paddingLeft: 12 + node.depth * 10, height: 34 }}
            className={clsx(
              'flex items-center gap-1.5 cursor-pointer select-none transition-colors',
              'border-b border-gray-50 dark:border-gray-800/50',
              active
                ? 'bg-violet-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60',
            )}
            onClick={() => onSelect(node.code, node.name)}
          >
            <button
              className={clsx(
                'shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors',
                active ? 'hover:bg-violet-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700',
                !node.hasChildren && 'invisible',
              )}
              onClick={e => toggleExpand(node, e)}
            >
              {node.isLoading
                ? <Loader2 size={10} className="animate-spin" />
                : <ChevronRight size={10} className={clsx('transition-transform', node.isExpanded && 'rotate-90')} />
              }
            </button>
            <span className="truncate text-[12px]">{node.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const ENTITY = 'products';

export default function ProductsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── Left panel state ──

  const [filterType, setFilterType] = useState<'all' | 'family' | 'category'>('family');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedCatLbl, setSelectedCatLbl] = useState('');

  // ── Table state ──

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | number | null>(null);
  const colsInitialized = useRef(false);

  useEffect(() => { setPage(1); }, [filterType, selectedFamily, selectedCat, colFilters, showInactive]);

  // ── Page definition — drives columns ──

  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey: QK.pageDef(ENTITY),
    queryFn: () => pageDefsApi.get(ENTITY),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: tableDef } = useQuery({
    queryKey: ['toolkit-table', ENTITY],
    queryFn: productsApi.meta,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !!pageDef,
  });

  // ── Families for left panel ──

  const { data: familyRes } = useQuery({
    queryKey: ['pim-families-all'],
    queryFn: () => familiesApi.list({ limit: 200, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });
  const families = useMemo(() => (familyRes?.rows ?? []) as Row[], [familyRes]);

  // ── Initialise visible cols + page size from page def (once) ──

  useEffect(() => {
    if (colsInitialized.current || !pageDef?.list_config?.columns?.length) return;
    colsInitialized.current = true;
    setVisibleCols(
      pageDef.list_config.columns
        .filter((c: { visible: boolean }) => c.visible)
        .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
        .map((c: { code: string }) => c.code),
    );
    if (pageDef.list_config.default_limit) setPageSize(pageDef.list_config.default_limit);
  }, [pageDef]);

  // ── Filters — merge page def static filters + left panel filter + column filters ──

  const staticFilters = useMemo(() => {
    const sf = pageDef?.list_config?.static_filters;
    return (sf && typeof sf === 'object') ? { ...(sf as Record<string, unknown>) } : {};
  }, [pageDef]);

  const filterOpMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of pageDef?.list_config?.columns ?? []) {
      if (c.filter_op) m.set(c.code, c.filter_op);
    }
    return m;
  }, [pageDef]);

  const serverFilters = useMemo(() => {
    const flat: Record<string, unknown> = {
      ...staticFilters,
      ...(!showInactive ? { is_active: true } : {}),
    };
    if (filterType === 'family' && selectedFamily) flat.family_code = selectedFamily;
    if (filterType === 'category' && selectedCat) flat.categories_code = { op: 'any', value: selectedCat };
    for (const [k, v] of Object.entries(colFilters)) {
      if (!v) continue;
      const op = filterOpMap.get(k) ?? 'eq';
      flat[k] = op === 'eq' ? v : { op, value: op === 'ilike' ? `%${v}%` : v };
    }
    return flat;
  }, [staticFilters, showInactive, filterType, selectedFamily, selectedCat, colFilters, filterOpMap]);

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

  // ── Products query ──

  const { data: result, isLoading, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['pim-products', serverFilters, page, pageSize],
    queryFn: () => productsApi.list({ filters: serverFilters, sort: sortFields.length ? sortFields : undefined, limit: pageSize, offset: (page - 1) * pageSize }),
    enabled: !!pageDef,
    placeholderData: prev => prev,
    staleTime: 0,
  });

  // When showing placeholder (stale data from previous filter), clear rows so
  // AdminTable renders a spinner instead of the previous category's data.
  const rows = (isPlaceholderData ? [] : result?.rows ?? []) as Row[];
  const total = isPlaceholderData ? 0 : result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // ── Export Template ──
  const exportMut = useMutation({
    mutationFn: () => {
      const endpoint = (pageDef?.export_endpoint ?? '').trim();
      if (!selectedFamily) throw new Error('Select a family first');
      if (!endpoint) throw new Error('Export endpoint is not configured for this page');
      return toolkitExportApi.template({
        family_code: selectedFamily,
        endpoint,
      });
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `products-${selectedFamily}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    },
    onError: (e: Error) => toast.error(e.message || 'Download failed'),
  });


  // ── Delete ──

  const deleteMut = useMutation({
    mutationFn: (id: string | number) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['pim-products'] });
      setDeleting(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  // ── Columns — built from page definition ──

  const allDataColumns = useMemo<AdminTableColumn<Row>[]>(() => {
    const defCols = pageDef?.list_config?.columns ?? [];
    if (!defCols.length) return [];
    const fieldMap = new Map(
      ((tableDef as { fields?: ToolkitField[] } | undefined)?.fields ?? []).map((f: ToolkitField) => [f.code, f]),
    );
    return defCols.map((c: { code: string; bindkey?: string }) => {
      const f = fieldMap.get(c.code);
      const dataKey = c.bindkey || c.code;
      const header = (f as ToolkitField | undefined)?.label
        ?? c.code.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
      return {
        key: c.code,
        header,
        width: 150,
        render: (row: Row) => {
          const v = row[dataKey];
          if (v == null) return <span className="text-gray-400 dark:text-gray-500">—</span>;
          if (typeof v === 'object') return <span className="block truncate">{toStr(v) ?? '—'}</span>;
          if (f) {
            const opts = ((tableDef as { options?: ToolkitFieldOption[] } | undefined)?.options ?? [])
              .filter((o: ToolkitFieldOption) => o.field_id === (f as ToolkitField).id);
            return <span className="block truncate">{cellValue(row, f as ToolkitField, opts)}</span>;
          }
          return <span className="block truncate">{String(v)}</span>;
        },
      } as AdminTableColumn<Row>;
    });
  }, [pageDef, tableDef]);

  const actionsCol = useMemo<AdminTableColumn<Row>>(() => ({
    key: '__actions', header: '', width: 80, noResize: true,
    render: row => (
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); navigate(`/pim/products/${row.id}/edit`); }}
          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
          title="Edit"
        ><Pencil size={13} /></button>
        <button
          onClick={e => { e.stopPropagation(); setDeleting(row.id as string | number); }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title="Delete"
        ><Trash2 size={13} /></button>
      </div>
    ),
  }), [navigate]);

  const configOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    (pageDef?.list_config?.columns ?? []).forEach((c: { code: string; order: number }) => map.set(c.code, c.order));
    return map;
  }, [pageDef]);

  const displayCols = useMemo(() => {
    if (!visibleCols.length) return allDataColumns;
    const visible = allDataColumns.filter(c => visibleCols.includes(c.key));
    visible.sort((a, b) => (configOrderMap.get(a.key) ?? 9999) - (configOrderMap.get(b.key) ?? 9999));
    return visible;
  }, [allDataColumns, visibleCols, configOrderMap]);

  const tableColumns = [...displayCols, actionsCol];

  const handleFilterChange = (colKey: string, val: string) => {
    if (colKey.startsWith('__') || !filterOpMap.has(colKey)) return;
    setColFilters(prev => {
      if (!val.trim()) { const n = { ...prev }; delete n[colKey]; return n; }
      return { ...prev, [colKey]: val };
    });
  };

  const tableFilters: Record<string, string> = {};
  for (const col of displayCols) {
    if (!col.key.startsWith('__') && filterOpMap.has(col.key)) {
      tableFilters[col.key] = colFilters[col.key] ?? '';
    }
  }

  // ── Active filter label for header ──

  const activeFilterLabel = useMemo(() => {
    if (filterType === 'family' && selectedFamily) return catLabel(families.find(f => f.code === selectedFamily)?.name) || selectedFamily;
    if (filterType === 'category' && selectedCat) return selectedCatLbl || selectedCat;
    return null;
  }, [filterType, selectedFamily, selectedCat, selectedCatLbl, families]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ════════════════════════════════════════════════════════
          LEFT NAVIGATION PANEL
          ════════════════════════════════════════════════════════ */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">

        {/* Panel header — All Products + mode toggle */}
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">

          <button
            onClick={() => { setFilterType('all'); setSelectedFamily(null); setSelectedCat(null); }}
            className="w-full flex items-center gap-3 px-4 py-3 transition-colors bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600"
          >
            <Package size={15} className="text-white" />
            <span className="text-sm font-semibold">All Products</span>
            {total > 0 && (
              <span className="ml-auto text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">{total}</span>
            )}
          </button>

          {/* Family / Category segmented toggle */}
          <div className="px-3 pb-3">
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
              <button
                onClick={() => {
                  setFilterType(selectedFamily ? 'family' : 'all');
                  setSelectedCat(null);
                }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                  filterType !== 'category'
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                <Users size={11} />
                Family
              </button>
              <button
                onClick={() => { setFilterType('category'); setSelectedFamily(null); }}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors',
                  filterType === 'category'
                    ? 'bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                <FolderTree size={11} />
                Category
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content — Family list OR Category tree */}
        <div className="flex-1 overflow-y-auto">
          {filterType !== 'category' ? (
            <div className="py-1">
              {families.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400 italic">No families found</p>
              ) : families.map(f => {
                const fcode = f.code as string;
                const active = filterType === 'family' && selectedFamily === fcode;
                return (
                  <button
                    key={fcode}
                    onClick={() => { setFilterType('family'); setSelectedFamily(fcode); }}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-4 py-2 transition-colors text-left',
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20',
                    )}
                  >
                    <span className={clsx(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      active ? 'bg-indigo-200' : 'bg-indigo-400',
                    )} />
                    <span className="text-[12px] font-medium truncate">{catLabel(f.name)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <CategoryTree
              selectedCode={selectedCat}
              onSelect={(code, name) => { setSelectedCat(code); setSelectedCatLbl(name); }}
            />
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MAIN CONTENT
          ════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="shrink-0 flex items-center gap-4 px-6 py-3
                           bg-white dark:bg-gray-900
                           border-b border-gray-200 dark:border-gray-800">

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
              Products
            </h1>
            {activeFilterLabel && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {filterType === 'family' ? 'Family:' : 'Category:'}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {activeFilterLabel}
                  <button
                    onClick={() => { setFilterType('all'); setSelectedFamily(null); setSelectedCat(null); }}
                    className="ml-0.5 p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Show inactive toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              <div className={clsx('w-7 h-4 rounded-full transition-colors', showInactive ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600')} />
              <div className={clsx('absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform', showInactive && 'translate-x-3')} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Show inactive</span>
          </label>

          <button
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            title={selectedFamily ? 'Download Template' : 'Select a family first'}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
             border border-gray-200 dark:border-gray-700
             text-gray-600 dark:text-gray-300
             hover:bg-gray-50 dark:hover:bg-gray-800
             transition-colors shadow-sm shrink-0
             disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download Template
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          <button
            onClick={() => navigate('/pim/products/new')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
                       bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white
                       transition-colors shadow-sm shrink-0"
          >
            <Plus size={14} />
            New Product
          </button>
        </header>

        {/* Table / states */}
        {loadingDef ? (
          <div className="flex items-center justify-center flex-1">
            <Spinner size="lg" />
          </div>
        ) : !pageDef?.list_config?.columns?.length ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No page definition found for <strong>products</strong> — configure it in Page Manager.
            </p>
          </div>
        ) : (
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
            onRowClick={row => navigate(`/pim/products/${row.id}/edit`)}
            emptyMessage="No products found"
            columnSelector={{
              all: allDataColumns.map(c => ({ key: c.key, header: c.header })),
              visible: visibleCols,
              onChange: setVisibleCols,
            }}
            className="flex-1 min-h-0"
          />
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete product"
        message="This will permanently delete this product. Continue?"
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting !== null && deleteMut.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
