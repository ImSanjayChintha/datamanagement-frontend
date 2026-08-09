import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cable, Zap, ExternalLink, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { endpointsApi } from '@/modules/api-manager/endpoints/api';
import type { ApiEndpoint } from '@/types/gateway';
import { QK } from '@/lib/queryKeys';
import { buildEndpointTemplates } from './apiTemplates';

interface Props {
  tableId:   number;
  tableCode: string;
  schema:    string;
  label:     string;
}

function statusIcon(status: ApiEndpoint['status']) {
  if (status === 'active')     return <CheckCircle size={12} className="text-emerald-500" />;
  if (status === 'deprecated') return <AlertCircle size={12} className="text-red-500" />;
  return <Clock size={12} className="text-gray-400" />;
}

function methodBadge(method: string) {
  return (
    <span className={clsx(
      'font-mono text-[10px] font-bold px-1.5 py-0.5 rounded',
      method === 'GET'    && 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400',
      method === 'POST'   && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
      method === 'PUT'    && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      method === 'DELETE' && 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
      !['GET','POST','PUT','DELETE'].includes(method) && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    )}>
      {method}
    </span>
  );
}

export default function ApiTab({ tableId, tableCode, schema, label }: Props) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gateway-endpoints-for-table', tableCode],
    queryFn: async () => {
      const res = await endpointsApi.list({ search: `/gateway/${tableCode}/`, page_size: 50 });
      return res.rows.filter(r => r.url_path.startsWith(`/gateway/${tableCode}/`));
    },
    staleTime: 0,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    const templates = buildEndpointTemplates(schema, tableCode, label);
    let created = 0;
    let skipped = 0;
    for (const tpl of templates) {
      try {
        await endpointsApi.create(tpl);
        created++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
          skipped++;
        } else {
          toast.error(`Failed to create "${tpl.name}": ${msg}`);
        }
      }
    }
    await refetch();
    qc.invalidateQueries({ queryKey: QK.gwEndpoints() });
    setGenerating(false);
    if (created > 0) toast.success(`${created} endpoint${created > 1 ? 's' : ''} created${skipped ? ` (${skipped} already existed)` : ''}`);
    else if (skipped > 0) toast(`All endpoints already exist`, { icon: 'ℹ️' });
  };

  const endpoints = data ?? [];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cable size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Gateway Endpoints</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded"
          >
            <Zap size={12} />
            {generating ? 'Generating…' : endpoints.length > 0 ? 'Regenerate API' : 'Generate API'}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Generates standard gateway endpoints (list, upsert, insert, delete) for{' '}
        <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{schema}.{tableCode}</code>.
        Existing endpoints are not overwritten.
      </p>

      {/* Endpoint list */}
      {isLoading ? (
        <div className="text-xs text-gray-400 py-4 text-center">Loading…</div>
      ) : endpoints.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-600">
          <Cable size={28} strokeWidth={1.5} />
          <p className="text-sm">No endpoints yet. Click <strong>Generate API</strong> to create them.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {endpoints.map(ep => (
            <div key={ep.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <div className="flex-none">{statusIcon(ep.status)}</div>
              <div className="flex-none">{methodBadge(ep.method)}</div>
              <code className="flex-1 text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                {ep.url_path}
              </code>
              <span className="flex-none text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                {ep.name}
              </span>
              <a
                href={`/gateway/endpoints/${ep.id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none text-gray-400 hover:text-violet-600 dark:hover:text-violet-400"
                title="Open in Gateway"
              >
                <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
