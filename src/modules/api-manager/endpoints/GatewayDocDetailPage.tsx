import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { QK } from '@/lib/queryKeys';
import { endpointsApi } from './api';
import { EndpointDetail } from './GatewayDocsPage';
import Spinner from '@/components/ui/Spinner';

export default function GatewayDocDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ep, isLoading } = useQuery({
    queryKey: QK.gwEndpoint(Number(id)),
    queryFn:  () => endpointsApi.get(Number(id)),
    enabled:  !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!ep) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500 dark:text-gray-400">Endpoint not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* ── Back header ── */}
      <header className="shrink-0 flex items-center gap-3 px-5 py-2.5
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate('/gateway/docs')}
          aria-label="Back"
          className="p-1.5 -ml-1 rounded text-gray-400
                     hover:text-gray-700 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 leading-none mb-0.5 truncate">
            {ep.url_path}
          </p>
          <h1 className="pim-title truncate">{ep.name}</h1>
        </div>
      </header>

      {/* ── Detail content ── */}
      <div className="flex-1 overflow-y-auto">
        <EndpointDetail ep={ep} onClose={() => navigate('/gateway/docs')} fullPage />
      </div>

    </div>
  );
}
