import { useCallback, useEffect, useRef, useState, type ReactNode, type Key } from 'react';
import { ChevronLeft, ChevronRight, Columns } from 'lucide-react';
import { clsx } from 'clsx';
import Spinner from './Spinner';

// ── FilterInput ───────────────────────────────────────────────────────────────
// Maintains its own local typing state; only notifies the parent on Enter.
// Syncs back to the applied value when the parent resets it (e.g. entity change).

function FilterInput({ applied, onApply }: { applied: string; onApply: (v: string) => void }) {
  const [local, setLocal] = useState(applied);

  useEffect(() => { setLocal(applied); }, [applied]);

  return (
    <input
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onApply(local);
        if (e.key === 'Escape') { setLocal(''); onApply(''); }
      }}
      placeholder="filter… ↵"
      className="w-full px-1.5 py-0.5 text-[11px] rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-normal"
    />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminTableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  /** Default initial width in px. Defaults to 150. */
  width?: number;
  /** Minimum width during resize. Defaults to 60. */
  minWidth?: number;
  /** Disable the drag-resize handle on this column. */
  noResize?: boolean;
  render?: (row: T, index: number) => ReactNode;
  headerClass?: string;
  cellClass?: string;
}

export interface ColumnSelectorConfig {
  all:     { key: string; header: string }[];
  visible: string[];
  onChange:(keys: string[]) => void;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => Key;

  // pagination
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  pageSizes?: number[];

  // loading
  isLoading?: boolean;
  isFetching?: boolean;
  /** Text shown under the spinner during the very first load (no columns yet). */
  loadingMessage?: string;

  // per-column filters — when provided, a second sticky header row with filter inputs appears
  filters?: Record<string, string>;
  onFilterChange?: (col: string, val: string) => void;

  // empty state
  emptyIcon?: ReactNode;
  emptyMessage?: string;

  // when this key changes, the scroll position resets to top
  scrollKey?: Key;

  onRowClick?: (row: T, index: number) => void;
  columnSelector?: ColumnSelectorConfig;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_COL_W    = 150;
const DEFAULT_PG_SIZES = [25, 50, 100];

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count, cols }: { count: number; cols: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <tr key={i} className="border-b border-gray-100 dark:border-gray-800/60 animate-pulse">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="px-3 py-2.5">
              <div className={clsx(
                'h-3.5 rounded bg-gray-100 dark:bg-gray-800',
                j === 0 ? 'w-14' : j === 1 ? 'w-36' : 'w-20',
              )} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Smart page-number list ────────────────────────────────────────────────────

function buildPageNums(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  if (page <= 4)  return [1, 2, 3, 4, 5, '…', pages];
  if (page >= pages - 3) return [1, '…', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, '…', page - 1, page, page + 1, '…', pages];
}

// ── Column selector popover ───────────────────────────────────────────────────

function ColumnSelectorButton({ all, visible, onChange }: ColumnSelectorConfig) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (key: string) =>
    onChange(visible.includes(key) ? visible.filter(k => k !== key) : [...visible, key]);

  const hiddenCount = all.length - visible.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Show/hide columns"
        className={clsx(
          'flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors',
          open
            ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
            : 'border-black/40 text-black hover:border-black/70',
        )}
      >
        <Columns size={11} />
        {hiddenCount > 0 && <span className="tabular-nums">{hiddenCount} hidden</span>}
      </button>

      {open && (
        <div className="absolute bottom-full mb-1.5 right-0 z-50 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Columns
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <button onClick={() => onChange(all.map(c => c.key))} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                All
              </button>
              <span className="text-gray-300 dark:text-gray-600">·</span>
              <button onClick={() => onChange([])} className="text-gray-400 hover:underline">
                None
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {all.map(col => (
              <label key={col.key}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none">
                <input
                  type="checkbox"
                  checked={visible.includes(col.key)}
                  onChange={() => toggle(col.key)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 w-3.5 h-3.5"
                />
                <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate">{col.header}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AdminTable ────────────────────────────────────────────────────────────────

export default function AdminTable<T>({
  columns, rows, rowKey,
  total, page, pageSize, pages,
  onPage, onPageSize,
  pageSizes = DEFAULT_PG_SIZES,
  isLoading = false, isFetching = false, loadingMessage,
  filters, onFilterChange,
  emptyIcon, emptyMessage = 'No results found',
  scrollKey,
  onRowClick,
  columnSelector,
  className,
}: AdminTableProps<T>) {

  const [colWidths,   setColWidths]   = useState<Record<string, number>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const dragRef     = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const hasFilters = !!onFilterChange;
  const noColumns  = columns.length === 0;

  const totalTableW = columns.reduce(
    (s, c) => s + (colWidths[c.key] ?? (c.width ?? DEFAULT_COL_W)),
    0,
  );

  // Reset scroll when scrollKey changes (e.g. table selection in SQL console)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [scrollKey]);

  const startResize = useCallback((
    col: string, clientX: number, thWidth: number, minW: number,
  ) => {
    dragRef.current = { col, startX: clientX, startW: thWidth };
    setResizingCol(col);

    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const newW = Math.max(minW, dragRef.current.startW + (e.clientX - dragRef.current.startX));
      setColWidths(prev => ({ ...prev, [dragRef.current!.col]: newW }));
    };
    const onUp = () => {
      dragRef.current = null;
      setResizingCol(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, []);

  const goTo = (p: number) => onPage(Math.max(1, Math.min(Math.max(1, pages), p)));
  const nums  = buildPageNums(page, Math.max(1, pages));

  return (
    <div className={clsx(
      'flex flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900',
      resizingCol && 'select-none cursor-col-resize',
      className,
    )}>

      {/* ── Scrollable table area ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative">

        {/* Overlay spinner — only when loading with no columns available yet */}
        {isLoading && noColumns && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-900 z-10">
            <Spinner size="lg" />
            {loadingMessage && (
              <span className="text-sm text-gray-400">{loadingMessage}</span>
            )}
          </div>
        )}

        <table
          className="text-[12px] border-collapse"
          style={{
            tableLayout: 'fixed',
            width: totalTableW > 0 ? totalTableW : undefined,
            minWidth: '100%',
          }}
        >
          <colgroup>
            {columns.map(col => (
              <col key={col.key} style={{ width: colWidths[col.key] ?? (col.width ?? DEFAULT_COL_W) }} />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-10">
            {/* Column-name row */}
            <tr className="border-b border-gray-300" style={{ backgroundColor: '#b8b8b8' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={clsx(
                    'relative px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest',
                    'text-black overflow-hidden',
                    col.headerClass,
                  )}
                >
                  <span className="block truncate pr-2">{col.header}</span>
                  {!col.noResize && (
                    <div
                      className={clsx(
                        'absolute inset-y-0 right-0 w-1.5 cursor-col-resize transition-colors',
                        resizingCol === col.key
                          ? 'bg-indigo-500'
                          : 'hover:bg-indigo-400 bg-transparent',
                      )}
                      onMouseDown={e => {
                        e.preventDefault();
                        const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement;
                        startResize(col.key, e.clientX, th.offsetWidth, col.minWidth ?? 60);
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>

            {/* Per-column filter row (optional) — only renders an input when the column key is present in filters */}
            {hasFilters && !noColumns && (
              <tr className="bg-gray-50/80 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                {columns.map(col => (
                  <th key={col.key} className="px-1.5 py-1 overflow-hidden">
                    {filters && col.key in filters ? (
                      <FilterInput
                        applied={filters[col.key]}
                        onApply={v => onFilterChange!(col.key, v)}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {isLoading && !noColumns ? (
              <SkeletonRows count={Math.min(pageSize, 8)} cols={columns.length} />
            ) : isFetching && rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columns.length)} className="py-12 text-center">
                  <Spinner size="lg" />
                </td>
              </tr>
            ) : !isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, columns.length)} className="py-16 text-center">
                  {emptyIcon && (
                    <div className="flex justify-center mb-3 text-gray-200 dark:text-gray-700">
                      {emptyIcon}
                    </div>
                  )}
                  <p className="text-[13px] text-gray-400 dark:text-gray-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  className={clsx(
                    'group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-3 py-2 text-gray-900 dark:text-gray-100 overflow-hidden',
                        col.cellClass,
                      )}
                    >
                      {col.render
                        ? col.render(row, i)
                        : (
                          <div className="truncate">
                            {String((row as Record<string, unknown>)[col.key] ?? '')}
                          </div>
                        )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-t border-gray-300 text-[11px] text-black" style={{ backgroundColor: '#b8b8b8' }}>

        {/* Left: row count + page-size selector + fetch spinner */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums whitespace-nowrap font-bold">
            {total === 0 ? 'No results' : `${from}–${to} of ${total.toLocaleString()}`}
          </span>
          <select
            value={pageSize}
            onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}
            className="border border-gray-400 rounded px-1 py-0.5 text-[11px] text-black focus:outline-none focus:ring-1 focus:ring-indigo-400"
            style={{ backgroundColor: '#b8b8b8' }}
          >
            {pageSizes.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
          {isFetching && !isLoading && <Spinner size="sm" />}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Column selector */}
        {columnSelector && (
          <ColumnSelectorButton
            all={columnSelector.all}
            visible={columnSelector.visible}
            onChange={columnSelector.onChange}
          />
        )}

        {/* Right: prev / page buttons / next */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={13} />
          </button>

          {nums.map((n, i) =>
            n === '…' ? (
              <span key={`e${i}`} className="w-7 text-center">…</span>
            ) : (
              <button
                key={n}
                onClick={() => goTo(n as number)}
                className={clsx(
                  'min-w-[28px] h-6 px-1 rounded text-[11px] font-bold transition-colors',
                  n === page
                    ? 'bg-indigo-500 text-white'
                    : 'text-black hover:bg-black/10',
                )}
              >
                {n}
              </button>
            )
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= pages}
            className="p-1 rounded hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
