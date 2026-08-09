import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Globe, FileJson, FlaskConical,
  Search, X,
} from 'lucide-react';
import { QK } from '@/lib/queryKeys';
import { endpointsApi } from './api';
import type { HttpMethod, EndpointStatus, ApiEndpoint } from '@/types/gateway';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';

// ── Style maps ────────────────────────────────────────────────────────────────

const METHOD_CLS: Record<HttpMethod, string> = {
  GET:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  POST:   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUT:    'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  PATCH:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DELETE: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const OP_CLS: Record<string, string> = {
  select: 'text-sky-600 dark:text-sky-400',
  insert: 'text-emerald-600 dark:text-emerald-400',
  update: 'text-amber-600 dark:text-amber-400',
  delete: 'text-red-500 dark:text-red-400',
};

const STATUS_DOT: Record<EndpointStatus, string> = {
  active:     'bg-emerald-500',
  draft:      'bg-gray-400 dark:bg-gray-500',
  deprecated: 'bg-red-500',
};

const STATUS_TABS = [
  { value: '',           label: 'All'        },
  { value: 'active',     label: 'Active'     },
  { value: 'draft',      label: 'Draft'      },
  { value: 'deprecated', label: 'Deprecated' },
];

const PAGE_SIZES = [25, 50, 100];

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

export default function EndpointsPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const [search,       setSearch]    = useState('');
  const [statusFilter, setStatus]    = useState('');
  const [page,         setPage]      = useState(1);
  const [pageSize,     setPageSize]  = useState(25);
  const [deletingId,   setDeleting]  = useState<number | null>(null);

  const q = useDebounce(search, 300);

  useEffect(() => { setPage(1); }, [q, statusFilter]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['gw-endpoints', { search: q, status: statusFilter, page, pageSize }],
    queryFn:  () => endpointsApi.list({
      search:    q           || undefined,
      status:    statusFilter || undefined,
      page,
      page_size: pageSize,
    }),
    placeholderData: (prev) => prev,
  });

  const rows  = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.gwEndpoints() });

  const deleteMut = useMutation({
    mutationFn: (id: number) => endpointsApi.delete(id),
    onSuccess: () => { toast.success('Endpoint deleted'); invalidate(); setDeleting(null); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      endpointsApi.setStatus(id, status),
    onSuccess: invalidate,
    onError:   (e: Error) => toast.error(e.message),
  });

  // ── Column definitions ─────────────────────────────────────────────────────

  const columns: AdminTableColumn<ApiEndpoint>[] = [
    {
      key: 'method',
      header: 'Method',
      width: 80,
      minWidth: 70,
      render: ep => (
        <span className={`inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${METHOD_CLS[ep.method]}`}>
          {ep.method}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name / Path',
      width: 300,
      render: ep => (
        <button
          onClick={() => navigate(`/gateway/endpoints/${ep.id}/edit`)}
          className="block text-left w-full min-w-0"
        >
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate leading-snug text-[12px]">
            {ep.name}
          </p>
          <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate leading-snug mt-0.5">
            {ep.url_path}
          </p>
        </button>
      ),
    },
    {
      key: 'db_object',
      header: 'DB Object',
      width: 220,
      render: ep => ep.db_object ? (
        <span className="font-mono text-[11px] flex items-baseline gap-0.5 min-w-0">
          <span className="text-gray-400 dark:text-gray-500 shrink-0">{ep.db_schema}.</span>
          <span className="text-gray-700 dark:text-gray-300 truncate">{ep.db_object}</span>
          {ep.db_type && (
            <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-600 font-sans shrink-0">
              {ep.db_type}
            </span>
          )}
        </span>
      ) : (
        <span className="text-gray-300 dark:text-gray-700">—</span>
      ),
    },
    {
      key: 'operation_type',
      header: 'Operation',
      width: 100,
      render: ep => ep.operation_type ? (
        <span className={`text-[11px] font-medium font-mono ${OP_CLS[ep.operation_type] ?? 'text-gray-400'}`}>
          {ep.operation_type}
        </span>
      ) : (
        <span className="text-gray-300 dark:text-gray-700 text-[11px]">—</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: ep => (
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ep.status as EndpointStatus] ?? 'bg-gray-400'}`} />
          <select
            value={ep.status}
            onChange={e => statusMut.mutate({ id: ep.id, status: e.target.value })}
            className="appearance-none text-[12px] font-medium bg-transparent text-gray-600 dark:text-gray-400 cursor-pointer focus:outline-none"
          >
            <option value="active">active</option>
            <option value="draft">draft</option>
            <option value="deprecated">deprecated</option>
          </select>
        </div>
      ),
    },
    {
      key: '_actions',
      header: '',
      width: 80,
      minWidth: 80,
      noResize: true,
      headerClass: 'w-[80px]',
      render: ep => (
        <div className="flex items-center gap-0.5 justify-end">
          <button
            onClick={() => navigate(`/gateway/endpoints/${ep.id}/edit`)}
            className="p-1.5 rounded text-gray-300 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          {deletingId === ep.id ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteMut.mutate(ep.id)}
                disabled={deleteMut.isPending}
                className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-60"
              >
                {deleteMut.isPending ? '…' : 'Del'}
              </button>
              <button
                onClick={() => setDeleting(null)}
                className="text-[10px] px-1 py-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleting(ep.id)}
              className="p-1.5 rounded text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="px-6 pt-3 pb-6 flex flex-col h-full gap-4">

      {/* ── Page header ── */}
      <div className="page-header mb-0">
        <h1 className="pim-title">API Endpoints</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/gateway/docs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0"
          >
            <FileJson size={13} /> API Docs
          </Link>
          <Link
            to="/gateway/swagger"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0"
          >
            <FlaskConical size={13} /> Swagger
          </Link>
          <button
            onClick={() => navigate('/gateway/endpoints/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} /> New Endpoint
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, path, object…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 pr-7 py-1.5 text-[13px] w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-0.5">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                statusFilter === t.value
                  ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <AdminTable<ApiEndpoint>
        columns={columns}
        rows={rows}
        rowKey={ep => ep.id}
        className="flex-1 min-h-0"
        total={total}
        page={page}
        pages={pages}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={s => { setPageSize(s); setPage(1); }}
        pageSizes={PAGE_SIZES}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyIcon={<Globe size={28} />}
        emptyMessage={
          search || statusFilter
            ? 'No endpoints match your filters.'
            : 'No endpoints yet — create your first one.'
        }
      />
    </div>
  );
}
