import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, LayoutTemplate, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { PageDef } from '@/types/toolkit';
import { pageDefsApi } from './api';

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PageDefsListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search,    setSearch]   = useState('');
  const [page,      setPage]     = useState(1);
  const [pageSize,  setPageSize] = useState(25);
  const [deleting,  setDeleting] = useState<PageDef | null>(null);

  const q = useDebounce(search, 300);
  useEffect(() => { setPage(1); }, [q]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['toolkit-page-defs', { search: q, page, pageSize }],
    queryFn:  () => pageDefsApi.list({ search: q || undefined, page, page_size: pageSize }),
    placeholderData: prev => prev,
  });

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const deleteMut = useMutation({
    mutationFn: (id: number) => pageDefsApi.delete(id),
    onSuccess: () => {
      toast.success('Page definition deleted');
      qc.invalidateQueries({ queryKey: ['toolkit-page-defs'] });
      setDeleting(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: AdminTableColumn<PageDef>[] = [
    {
      key: 'nav_order',
      header: 'Order',
      width: 60,
      minWidth: 50,
      cellClass: 'text-gray-400 font-mono',
      render: p => <span>{p.nav_order}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      width: 140,
      render: p => (
        <span className="font-mono text-indigo-600 dark:text-indigo-400">{p.code}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      width: 180,
      render: p => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{p.title}</span>
      ),
    },
    {
      key: 'nav_section',
      header: 'Section',
      width: 100,
      render: p => (
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wide">{p.nav_section}</span>
      ),
    },
    {
      key: 'list_endpoint',
      header: 'List endpoint',
      width: 220,
      render: p => (
        <span className="font-mono text-xs text-gray-500 truncate block">
          {p.list_endpoint || <span className="text-gray-300 italic">—</span>}
        </span>
      ),
    },
    {
      key: 'table_code',
      header: 'Schema.Table',
      width: 160,
      render: p => (
        <span className="font-mono text-xs text-gray-500">{p.table_code}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 80,
      noResize: true,
      render: p => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
          p.is_active
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {p.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: '_actions',
      header: '',
      width: 72,
      noResize: true,
      render: p => (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); navigate(`/toolkit/page-defs/${p.code}/edit`); }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); setDeleting(p); }}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="page-header px-6 pt-3 shrink-0">
        <h1 className="pim-title">Page Definitions</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-8 pr-7 py-1.5 text-xs w-56"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => navigate('/toolkit/page-defs/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            New page
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 px-6 pb-6 pt-4 flex flex-col">
        <AdminTable<PageDef>
          className="flex-1 min-h-0"
          columns={columns}
          rows={rows}
          rowKey={p => p.id}
          total={total}
          page={page}
          pageSize={pageSize}
          pages={pages}
          onPage={setPage}
          onPageSize={s => { setPageSize(s); setPage(1); }}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyIcon={<LayoutTemplate size={40} strokeWidth={1} />}
          emptyMessage={search ? 'No page definitions match your search.' : 'No page definitions yet.'}
          onRowClick={p => navigate(`/toolkit/page-defs/${p.code}/edit`)}
        />
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete page definition"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
