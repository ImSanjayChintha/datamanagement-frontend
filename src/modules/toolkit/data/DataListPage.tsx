import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';
import { toolkitTablesApi, toolkitDataApi } from '@/modules/toolkit/core/api';
import { QK } from '@/lib/queryKeys';
import { DISPLAY_TYPES, cellValue } from '@/lib/formatting';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';

const PAGE_SIZE = 25;

interface Props {
  tableCode?: string;
  basePath?: string;
  backPath?: string;
}

export default function DataListPage({ tableCode: tcProp, basePath, backPath }: Props = {}) {
  const { tableCode: tcParam } = useParams<{ tableCode: string }>();
  const tableCode = tcProp ?? tcParam;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: tableDef, isLoading: loadingMeta } = useQuery({
    queryKey: QK.table(tableCode!),
    queryFn: () => toolkitTablesApi.getByCode(tableCode!),
    enabled: !!tableCode,
  });

  const fields = (tableDef?.fields ?? []).filter(
    f => !f.is_system && DISPLAY_TYPES.has(f.field_type),
  );
  const displayFields = fields.slice(0, 5);

  const { data: rows = [], isLoading: loadingData } = useQuery({
    queryKey: QK.data(tableCode!, search, showInactive, page),
    queryFn: () =>
      toolkitDataApi.list(tableCode!, {
        search:    search || undefined,
        is_active: showInactive ? undefined : true,
        limit:     PAGE_SIZE,
        offset:    page * PAGE_SIZE,
      }),
    enabled: !!tableCode,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => toolkitDataApi.delete(tableCode!, id, true),
    onSuccess: () => {
      toast.success('Record deleted');
      qc.invalidateQueries({ queryKey: QK.data(tableCode!) });
      setDeleting(null);
    },
    onError: () => toast.error('Delete failed'),
  });

  const listPath = basePath ?? `/toolkit/tables/${tableCode}/data`;
  const backHref = backPath ?? '/toolkit';

  if (loadingMeta) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!tableDef) return <p className="text-red-500">Table not found: {tableCode}</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={backHref} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="page-title">
            {tableDef.icon && <span className="mr-2">{tableDef.icon}</span>}
            {tableDef.label}
          </h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">{tableCode}</p>
        </div>
        <Link to={`${listPath}/new`} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New record
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loadingData ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-12">#</th>
                {tableDef.has_label && (
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Label</th>
                )}
                {displayFields.map(f => (
                  <th key={f.id} className="text-left px-4 py-3 font-medium text-gray-500">{f.label}</th>
                ))}
                <th className="text-center px-4 py-3 font-medium text-gray-500 w-16">Active</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + displayFields.length + (tableDef.has_label ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No records found
                  </td>
                </tr>
              ) : (
                (rows as Record<string, unknown>[]).map(row => (
                  <tr key={String(row.id)} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{String(row.id)}</td>
                    {tableDef.has_label && (
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {String(row.label ?? row.code ?? '—')}
                      </td>
                    )}
                    {displayFields.map(f => (
                      <td key={f.id} className="px-4 py-3 text-gray-600">
                        {cellValue(row, f, (tableDef.options ?? []).filter(o => o.field_id === f.id))}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${row.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`${listPath}/${row.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleting(Number(row.id))}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(rows.length === PAGE_SIZE || page > 0) && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={rows.length < PAGE_SIZE}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete record"
        message="This will deactivate the record (soft delete). Continue?"
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting !== null && deleteMut.mutate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
