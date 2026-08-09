import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Download, Copy, Check, FlaskConical, FileText } from 'lucide-react';

export default function GatewayOpenApiPage() {
  const navigate = useNavigate();
  const [spec,    setSpec]    = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);

  const fetchSpec = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/gateway/openapi.json?all=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSpec(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load spec');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSpec(); }, [fetchSpec]);

  const specStr = spec ? JSON.stringify(spec, null, 2) : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(specStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950">

      {/* Toolbar */}
      <div className="shrink-0 border-b border-gray-800 bg-gray-900 px-4 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/gateway/docs')}
            className="p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-100">OpenAPI Spec</h1>
            <p className="text-xs text-gray-400">Raw OpenAPI 3.0 JSON — all endpoints</p>
          </div>

          <div className="ml-4 flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/gateway/docs')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <FileText size={12} /> Docs
            </button>
            <button
              type="button"
              onClick={() => navigate('/gateway/swagger')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <FlaskConical size={12} /> Swagger UI
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!spec}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <a
            href="/api/v1/gateway/openapi.json?all=1"
            download="gateway-openapi.json"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <Download size={13} /> Download
          </a>
          <button
            onClick={fetchSpec}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm animate-pulse">
            <RefreshCw size={14} className="animate-spin" /> Loading spec…
          </div>
        )}
        {error && (
          <div className="text-rose-400 text-sm bg-rose-950/40 border border-rose-800 rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {spec && (
          <pre className="text-[12px] font-mono leading-relaxed text-gray-200 whitespace-pre">
            {specStr}
          </pre>
        )}
      </div>
    </div>
  );
}
