import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Key, Lock, Globe, ChevronRight } from 'lucide-react';
import { engineApi, type EngineObject } from './api';
import { apiBridgeResourcesApi } from '@/modules/api-manager/resources/api';
import type { ApiResource, AuthType } from '@/types/apiBridge';

// ── Constants ─────────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type EngineAction = 'list' | 'insert' | 'update' | 'delete';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE'];

const METHOD_STYLE: Record<HttpMethod, string> = {
  GET:    'bg-emerald-100 text-emerald-700 ring-emerald-300',
  POST:   'bg-blue-100 text-blue-700 ring-blue-300',
  PATCH:  'bg-yellow-100 text-yellow-700 ring-yellow-300',
  DELETE: 'bg-red-100 text-red-700 ring-red-300',
};

// Engine actions allowed per HTTP method
const METHOD_ACTIONS: Record<HttpMethod, EngineAction[]> = {
  GET:    ['list'],
  POST:   ['insert', 'list', 'update', 'delete'],
  PATCH:  ['update'],
  DELETE: ['delete'],
};

// Suggested default action for each method
const METHOD_DEFAULT_ACTION: Record<HttpMethod, EngineAction> = {
  GET:    'list',
  POST:   'insert',
  PATCH:  'update',
  DELETE: 'delete',
};

// Suggested HTTP method for each action
const ACTION_DEFAULT_METHOD: Record<EngineAction, HttpMethod> = {
  list:   'GET',
  insert: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
};

const ACTION_LABELS: Record<EngineAction, string> = {
  list:   'List',
  insert: 'Insert',
  update: 'Update',
  delete: 'Delete',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function AuthBadge({ type }: { type: AuthType }) {
  const map: Record<AuthType, { label: string; cls: string }> = {
    none:    { label: 'No Auth',  cls: 'bg-gray-100 text-gray-500'    },
    bearer:  { label: 'Bearer',   cls: 'bg-purple-100 text-purple-700' },
    basic:   { label: 'Basic',    cls: 'bg-amber-100 text-amber-700'   },
    api_key: { label: 'API Key',  cls: 'bg-blue-100 text-blue-700'     },
    oauth2:  { label: 'OAuth2',   cls: 'bg-green-100 text-green-700'   },
  };
  const { label, cls } = map[type] ?? map.none;
  return <span className={`badge font-medium ${cls}`}>{label}</span>;
}

function authHint(resource: ApiResource): { header: string; value: string }[] {
  const cfg = resource.auth_config ?? {};
  switch (resource.auth_type) {
    case 'bearer': {
      const prefix = cfg.prefix || 'Bearer';
      const token  = cfg.token  || '<token>';
      return [{ header: 'Authorization', value: `${prefix} ${token}` }];
    }
    case 'basic': {
      const user = cfg.username || '<username>';
      const pass = cfg.password || '<password>';
      return [{ header: 'Authorization', value: `Basic ${btoa(`${user}:${pass}`)}` }];
    }
    case 'api_key': {
      const name = cfg.key_name  || 'X-Api-Key';
      const val  = cfg.key_value || '<key>';
      if (cfg.location === 'query') return [{ header: `?${name}`, value: val }];
      return [{ header: name, value: val }];
    }
    default:
      return [];
  }
}

function buildBodyPreview(action: EngineAction, obj: EngineObject | undefined): string {
  if (!obj) return '';
  switch (action) {
    case 'list':
      return JSON.stringify({ filters: {}, limit: 25, offset: 0 }, null, 2);
    case 'get':
      return JSON.stringify({ pk: '<value>' }, null, 2);
    case 'insert':
      return JSON.stringify({ data: { '<field>': '<value>' } }, null, 2);
    case 'update':
      return JSON.stringify({ pk: '<value>', data: { '<field>': '<value>' } }, null, 2);
    case 'delete':
      return JSON.stringify({ pk: '<value>' }, null, 2);
    default:
      return '';
  }
}

function buildResponsePreview(action: EngineAction): string {
  const row = { id: 1, '<field>': '<value>' };
  switch (action) {
    case 'list':
      return JSON.stringify({ ok: true, rows: [row], total: 1, limit: 25, offset: 0 }, null, 2);
    case 'get':
      return JSON.stringify({ ok: true, row }, null, 2);
    case 'insert':
      return JSON.stringify({ ok: true, row: { id: '<new-id>', '<field>': '<value>' } }, null, 2);
    case 'update':
      return JSON.stringify({ ok: true, row }, null, 2);
    case 'delete':
      return JSON.stringify({ ok: true, affected: 1 }, null, 2);
    default:
      return '';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EngineExplorerPage() {
  const [resourceCode, setResourceCode] = useState('');
  const [apiName,      setApiName]      = useState('');
  const [method,       setMethod]       = useState<HttpMethod>('GET');
  const [action,       setAction]       = useState<EngineAction>('list');
  const [schema,       setSchema]       = useState('');
  const [objectCode,   setObjectCode]   = useState('');
  const [copiedUrl,    setCopiedUrl]    = useState(false);
  const [copiedBody,   setCopiedBody]   = useState(false);

  const { data: objects = [], isLoading: loadingObjects } = useQuery({
    queryKey: ['engine-objects'],
    queryFn:  engineApi.listObjects,
    staleTime: 30_000,
  });

  const { data: resourcesPage, isLoading: loadingResources } = useQuery({
    queryKey: ['api-bridge-resources'],
    queryFn:  () => apiBridgeResourcesApi.list({ is_active: true, page_size: 999 }),
    staleTime: 30_000,
  });
  const resources = resourcesPage?.rows ?? [];

  const schemas = useMemo(
    () => [...new Set(objects.map((o: EngineObject) => o.schema_name))].sort(),
    [objects],
  );

  const filteredObjects = useMemo(
    () => objects.filter((o: EngineObject) => o.schema_name === schema),
    [objects, schema],
  );

  const selectedObj      = objects.find((o: EngineObject) => o.code === objectCode);
  const selectedResource = resources.find((r: ApiResource) => r.code === resourceCode);
  const hints            = selectedResource ? authHint(selectedResource) : [];

  const slug    = selectedObj?.api_slug ?? selectedObj?.object_name ?? '';
  const baseUrl = selectedResource?.base_url?.replace(/\/$/, '') ?? window.location.origin;
  const path    = slug ? `/api/v1/registry/${slug}/${action}` : '';
  const url     = path ? `${baseUrl}${path}` : '';

  const bodyPreview     = buildBodyPreview(action, selectedObj);
  const responsePreview = buildResponsePreview(action);
  const showBody        = method !== 'GET';

  function handleMethodChange(m: HttpMethod) {
    setMethod(m);
    const allowed = METHOD_ACTIONS[m];
    if (!allowed.includes(action)) {
      setAction(METHOD_DEFAULT_ACTION[m]);
    }
  }

  function handleActionChange(a: EngineAction) {
    setAction(a);
    const suggested = ACTION_DEFAULT_METHOD[a];
    if (!METHOD_ACTIONS[method].includes(a)) {
      setMethod(suggested);
    }
  }

  function copy(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">API Builder</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure an engine endpoint — choose a resource, method, action, and object to generate
          the request URL and body.
        </p>
      </div>

      <div className="card p-4 space-y-5">

        {/* ── 1. URI Resource ─────────────────────────────────────────────── */}
        <div>
          <label className="label">URI Resource</label>
          <select
            className="input"
            value={resourceCode}
            onChange={e => setResourceCode(e.target.value)}
            disabled={loadingResources}
          >
            <option value="">
              {loadingResources ? 'Loading…' : 'Platform default (no resource)'}
            </option>
            {resources.map((r: ApiResource) => (
              <option key={r.code} value={r.code}>
                {r.name} — {r.base_url}
              </option>
            ))}
          </select>
          {selectedResource && (
            <p className="helper mt-1">
              Base URL: <span className="font-mono">{selectedResource.base_url}</span>
              <span className="mx-2 text-gray-300">·</span>
              <AuthBadge type={selectedResource.auth_type} />
            </p>
          )}
        </div>

        {/* ── 2. API Name ──────────────────────────────────────────────────── */}
        <div>
          <label className="label">Name of the API</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. List active countries"
            value={apiName}
            onChange={e => setApiName(e.target.value)}
          />
        </div>

        {/* ── 3. HTTP Method ───────────────────────────────────────────────── */}
        <div>
          <label className="label">HTTP Method</label>
          <div className="flex gap-2 flex-wrap">
            {METHODS.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => handleMethodChange(m)}
                className={`px-3 py-1.5 rounded font-mono text-sm font-semibold ring-1 transition-all ${
                  method === m
                    ? METHOD_STYLE[m]
                    : 'bg-gray-50 text-gray-400 ring-gray-200 hover:ring-gray-300 hover:text-gray-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* ── 4. Engine Action ─────────────────────────────────────────────── */}
        <div>
          <label className="label">Action</label>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ACTION_LABELS) as EngineAction[]).map(a => {
              const allowed = METHOD_ACTIONS[method].includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => handleActionChange(a)}
                  disabled={!allowed}
                  className={`px-3 py-1.5 rounded text-sm font-medium ring-1 transition-all ${
                    action === a
                      ? 'bg-indigo-100 text-indigo-700 ring-indigo-300'
                      : allowed
                        ? 'bg-gray-50 text-gray-500 ring-gray-200 hover:ring-gray-300 hover:text-gray-700'
                        : 'bg-gray-50 text-gray-300 ring-gray-100 cursor-not-allowed'
                  }`}
                >
                  {ACTION_LABELS[a]}
                </button>
              );
            })}
          </div>
          <p className="helper mt-1">
            <span className={`badge font-mono font-semibold ${METHOD_STYLE[method]}`}>{method}</span>
            <ChevronRight size={12} className="inline text-gray-300 mx-1" />
            {ACTION_LABELS[action]}
          </p>
        </div>

        {/* ── 5. Schema + Object ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Schema</label>
            <select
              className="input"
              value={schema}
              onChange={e => { setSchema(e.target.value); setObjectCode(''); }}
              disabled={loadingObjects}
            >
              <option value="">{loadingObjects ? 'Loading…' : 'Select schema…'}</option>
              {schemas.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Object</label>
            <select
              className="input"
              value={objectCode}
              onChange={e => setObjectCode(e.target.value)}
              disabled={!schema}
            >
              <option value="">Select object…</option>
              {filteredObjects.map(o => (
                <option key={o.code} value={o.code}>{o.object_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── 6. URL ───────────────────────────────────────────────────────── */}
        <div className={`rounded-md border px-4 py-3 transition-colors ${url ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
          {url ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className={`badge font-mono font-semibold shrink-0 ${METHOD_STYLE[method]}`}>
                {method}
              </span>
              <code className="flex-1 text-sm font-mono text-gray-800 break-all min-w-0">{url}</code>
              <button
                onClick={() => copy(url, setCopiedUrl)}
                className="btn-ghost shrink-0 px-2 py-1"
                title="Copy URL"
              >
                {copiedUrl
                  ? <Check size={14} className="text-emerald-600" />
                  : <Copy size={14} className="text-gray-400" />}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Select schema and object to generate the URL
            </p>
          )}
        </div>

        {path && selectedObj && (
          <p className="helper -mt-3">
            Path: <span className="font-mono">{path}</span>
            <span className="mx-2 text-gray-300">→</span>
            resolves to <span className="font-mono">{selectedObj.code}</span>
            {selectedObj.api_slug && selectedObj.api_slug !== selectedObj.object_name && (
              <span className="ml-1 text-gray-400">(slug: {selectedObj.api_slug})</span>
            )}
          </p>
        )}
      </div>

      {/* ── 7. Auth headers ─────────────────────────────────────────────────── */}
      {selectedResource && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            {selectedResource.auth_type === 'none'
              ? <Globe size={14} className="text-gray-400" />
              : <Lock size={14} className="text-gray-600" />}
            <span className="text-sm font-medium text-gray-700">Required authentication</span>
            <AuthBadge type={selectedResource.auth_type} />
          </div>

          {hints.length > 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 divide-y divide-gray-100">
              {hints.map(h => (
                <div key={h.header} className="flex items-center gap-3 px-3 py-2 text-xs font-mono">
                  <Key size={11} className="text-gray-400 shrink-0" />
                  <span className="text-gray-500 shrink-0 min-w-[10rem]">{h.header}</span>
                  <span className="text-gray-800 break-all">{h.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No authentication headers required.</p>
          )}
        </div>
      )}

      {/* ── 8. Request body ──────────────────────────────────────────────────── */}
      {selectedObj && showBody && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Request body</span>
            <button
              onClick={() => copy(bodyPreview, setCopiedBody)}
              className="btn-ghost px-2 py-1 text-xs flex items-center gap-1 text-gray-400 hover:text-gray-700"
            >
              {copiedBody ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              Copy
            </button>
          </div>
          <pre className="text-xs font-mono bg-gray-50 rounded border border-gray-200 p-3 overflow-x-auto text-gray-800">
            {bodyPreview}
          </pre>
        </div>
      )}

      {/* ── 9. Response shape ────────────────────────────────────────────────── */}
      {selectedObj && (
        <div className="card p-4 space-y-3">
          <span className="text-sm font-medium text-gray-700">Response shape</span>
          <pre className="text-xs font-mono bg-gray-50 rounded border border-gray-200 p-3 overflow-x-auto text-gray-800">
            {responsePreview}
          </pre>
        </div>
      )}
    </div>
  );
}
