import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Wifi, CheckCircle2, XCircle,
  Shield, ShieldOff, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QK } from '@/lib/queryKeys';
import { apiBridgeResourcesApi } from '@/modules/api-manager/resources/api';
import type { ApiResource, TestConnectionResult } from '@/types/apiBridge';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';

const PAGE_SIZES = [100, 200, 300];

const AUTH_BADGE: Record<string, { label: string; cls: string }> = {
  none:    { label: 'None',    cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'     },
  bearer:  { label: 'Bearer',  cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'  },
  basic:   { label: 'Basic',   cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400' },
  api_key: { label: 'API Key', cls: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400' },
  oauth2:  { label: 'OAuth2',  cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' },
};

export default function ResourcesListPage() {
  const qc = useQueryClient();

  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState(PAGE_SIZES[0]);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [testingId, setTestingId]       = useState<number | null>(null);
  const [testResult, setTestResult]     = useState<{
    resource: ApiResource;
    result: TestConnectionResult;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: QK.apiBridgeResources(debouncedSearch || undefined, page),
    queryFn:  () => apiBridgeResourcesApi.list({
      search:    debouncedSearch || undefined,
      page,
      page_size: pageSize,
    }),
    placeholderData: prev => prev,
  });

  const resources = data?.rows ?? [];
  const total     = data?.total ?? 0;
  const pages     = data?.pages ?? 1;

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiBridgeResourcesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.apiBridgeResources() });
      setDeletingId(null);
      toast.success('Resource deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleTest(resource: ApiResource) {
    setTestingId(resource.id);
    try {
      const result = await apiBridgeResourcesApi.testConnection(resource.id);
      setTestResult({ resource, result });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTestingId(null);
    }
  }

  const deletingResource = resources.find(r => r.id === deletingId);

  // ── Column definitions ─────────────────────────────────────────────────────

  const columns: AdminTableColumn<ApiResource>[] = [
    {
      key: 'name',
      header: 'Resource',
      width: 220,
      render: r => (
        <>
          <div className="text-[12px] font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">
            {r.name}
          </div>
          <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono truncate">{r.code}</div>
        </>
      ),
    },
    {
      key: 'base_url',
      header: 'Base URL',
      width: 260,
      render: r => (
        <span className="text-[11px] text-gray-600 dark:text-gray-400 font-mono truncate block">
          {r.base_url}
        </span>
      ),
    },
    {
      key: 'auth_type',
      header: 'Auth',
      width: 110,
      render: r => {
        const auth = AUTH_BADGE[r.auth_type] ?? AUTH_BADGE.none;
        return (
          <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${auth.cls}`}>
            {auth.label}
          </span>
        );
      },
    },
    {
      key: 'timeout_seconds',
      header: 'Timeout / SSL',
      width: 120,
      render: r => (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{r.timeout_seconds}s</span>
          {r.ssl_verify ? (
            <Shield size={12} className="text-green-500" />
          ) : (
            <ShieldOff size={12} className="text-orange-400" />
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 90,
      render: r => (
        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          r.is_active
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'
        }`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: '_actions',
      header: '',
      width: 100,
      minWidth: 100,
      noResize: true,
      render: r => {
        const isTesting = testingId === r.id;
        return (
          <div className="flex items-center gap-0.5 justify-end">
            <button
              onClick={() => handleTest(r)}
              disabled={isTesting}
              title="Test connection"
              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40"
            >
              {isTesting ? <Spinner size="sm" /> : <Wifi size={14} />}
            </button>
            <Link
              to={`/api-bridge/resources/${r.id}/edit`}
              title="Edit"
              className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Pencil size={14} />
            </Link>
            <button
              onClick={() => setDeletingId(r.id)}
              title="Delete"
              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full px-6 pt-3 pb-6 gap-4">

        {/* Header */}
        <div className="page-header shrink-0 mb-0">
          <h1 className="pim-title">API Resources</h1>
          <Link
            to="/api-bridge/resources/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            New Resource
          </Link>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-8 py-1.5 text-sm w-full"
              placeholder="Search by name, code or URL…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <AdminTable<ApiResource>
          columns={columns}
          rows={resources}
          rowKey={r => r.id}
          total={total}
          page={page}
          pages={pages}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={s => { setPageSize(s); setPage(1); }}
          pageSizes={PAGE_SIZES}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyIcon={<Wifi size={36} />}
          emptyMessage={
            debouncedSearch
              ? 'No resources match your search.'
              : 'No API resources configured yet.'
          }
          className="flex-1 min-h-0"
        />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deletingId !== null}
        title="Delete Resource"
        message={`Delete "${deletingResource?.name ?? ''}"? Any endpoints using this connection will stop working.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deletingId !== null && deleteMut.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      {/* Test result modal */}
      {testResult && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setTestResult(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              {testResult.result.success ? (
                <CheckCircle2 size={22} className="text-green-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={22} className="text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {testResult.result.success ? 'Connection successful' : 'Connection failed'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{testResult.resource.name}</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-1">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{testResult.result.message}</p>
              {testResult.result.status_code != null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">HTTP {testResult.result.status_code}</p>
              )}
              {testResult.result.response_time_ms != null && (
                <p className="text-xs text-gray-400 dark:text-gray-500">{testResult.result.response_time_ms} ms</p>
              )}
            </div>

            <button
              onClick={() => setTestResult(null)}
              className="btn-primary w-full mt-4 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
