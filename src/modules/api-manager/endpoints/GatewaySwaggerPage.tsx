import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, FileText, Code2 } from 'lucide-react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function GatewaySwaggerPage() {
  const navigate = useNavigate();
  const [specKey, setSpecKey] = useState(0);

  return (
    <div className="flex flex-col h-screen">

      {/* Toolbar */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/gateway/docs')}
            className="p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">Swagger UI</h1>
            <p className="text-xs text-gray-500">Interactive API explorer — all endpoints</p>
          </div>

          <div className="ml-4 flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/gateway/docs')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText size={12} /> Docs
            </button>
            <button
              type="button"
              onClick={() => navigate('/gateway/openapi')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Code2 size={12} /> OpenAPI Spec
            </button>
          </div>
        </div>

        <button
          onClick={() => setSpecKey(k => k + 1)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Swagger UI — all endpoints including drafts */}
      <div className="flex-1 overflow-auto">
        <SwaggerUI
          key={specKey}
          url="/api/v1/gateway/openapi.json?all=1"
          docExpansion="list"
          displayRequestDuration
          tryItOutEnabled
        />
      </div>
    </div>
  );
}
