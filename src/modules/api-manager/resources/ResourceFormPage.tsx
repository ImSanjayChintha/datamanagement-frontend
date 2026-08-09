import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import { QK } from '@/lib/queryKeys';
import { apiBridgeResourcesApi } from '@/modules/api-manager/resources/api';
import AuthConfigFields from '@/modules/api-manager/resources/components/AuthConfigFields';
import HeadersEditor from '@/modules/api-manager/resources/components/HeadersEditor';
import Spinner from '@/components/ui/Spinner';
import type {
  AuthType, HeaderEntry, ResourceFormState, TestConnectionResult,
} from '@/types/apiBridge';

const AUTH_TYPE_OPTIONS: { value: AuthType; label: string; desc: string }[] = [
  { value: 'none',    label: 'None',    desc: 'No authentication'               },
  { value: 'bearer',  label: 'Bearer',  desc: 'Authorization: Bearer <token>'   },
  { value: 'basic',   label: 'Basic',   desc: 'HTTP Basic (username + password)' },
  { value: 'api_key', label: 'API Key', desc: 'Custom header or query param'     },
  { value: 'oauth2',  label: 'OAuth2',  desc: 'Client credentials flow'          },
];

const EMPTY: ResourceFormState = {
  code:            '',
  name:            '',
  description:     '',
  base_url:        '',
  timeout_seconds: 30,
  auth_type:       'none',
  auth_config:     {},
  default_headers: [],
  ssl_verify:      true,
  is_active:       true,
};

function toCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function headersToArray(headers: Record<string, string>): HeaderEntry[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function arrayToHeaders(entries: HeaderEntry[]): Record<string, string> {
  return Object.fromEntries(
    entries.filter(e => e.key.trim()).map(e => [e.key.trim(), e.value])
  );
}

export default function ResourceFormPage() {
  const { id }       = useParams<{ id: string }>();
  const isEdit       = Boolean(id);
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const [form, setForm]                 = useState<ResourceFormState>(EMPTY);
  const [codeEdited, setCodeEdited]     = useState(false);
  const [testResult, setTestResult]     = useState<TestConnectionResult | null>(null);
  const [testing, setTesting]           = useState(false);
  const hydratedRef                     = useRef(false);

  // Fetch existing resource when editing
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: QK.apiBridgeResource(Number(id)),
    queryFn:  () => apiBridgeResourcesApi.get(Number(id)),
    enabled:  isEdit,
  });

  // Hydrate form from fetched data (once only)
  useEffect(() => {
    if (!existing || hydratedRef.current) return;
    hydratedRef.current = true;
    setForm({
      code:            existing.code,
      name:            existing.name,
      description:     existing.description ?? '',
      base_url:        existing.base_url,
      timeout_seconds: existing.timeout_seconds,
      auth_type:       existing.auth_type,
      auth_config:     existing.auth_config ?? {},
      default_headers: headersToArray(existing.default_headers ?? {}),
      ssl_verify:      existing.ssl_verify,
      is_active:       existing.is_active,
    });
    setCodeEdited(true); // don't auto-derive code when editing
  }, [existing]);

  function set<K extends keyof ResourceFormState>(key: K, value: ResourceFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleNameChange(value: string) {
    set('name', value);
    if (!codeEdited) {
      set('code', toCode(value));
    }
  }

  function handleAuthTypeChange(newType: AuthType) {
    set('auth_type', newType);
    set('auth_config', {}); // reset config when type changes
    setTestResult(null);
  }

  function handleAuthConfigChange(field: string, value: string) {
    setForm(prev => ({
      ...prev,
      auth_config: { ...prev.auth_config, [field]: value },
    }));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        default_headers: arrayToHeaders(form.default_headers),
      };
      if (isEdit) {
        return apiBridgeResourcesApi.update(Number(id), payload);
      }
      return apiBridgeResourcesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.apiBridgeResources() });
      if (isEdit) qc.removeQueries({ queryKey: QK.apiBridgeResource(Number(id)) });
      toast.success(isEdit ? 'Resource updated' : 'Resource created');
      navigate('/api-bridge/resources');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleTest() {
    if (!isEdit) {
      toast.error('Save the resource first to test the connection');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiBridgeResourcesApi.testConnection(Number(id));
      setTestResult(result);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  if (isEdit && loadingExisting) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/api-bridge/resources')}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Resource' : 'New API Resource'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {isEdit ? existing?.name : 'Configure a new external API connection'}
            </p>
          </div>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); saveMut.mutate(); }}
          className="space-y-6"
        >
          {/* ── Row 1: Basic Info + Auth ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Basic Info */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">
                Connection Details
              </h2>

              <div>
                <label className="label block mb-1">Name *</label>
                <input
                  className="input w-full text-sm"
                  value={form.name}
                  placeholder="Shopify Admin API"
                  required
                  onChange={e => handleNameChange(e.target.value)}
                />
              </div>

              <div>
                <label className="label block mb-1">Code *</label>
                <input
                  className="input w-full text-sm font-mono"
                  value={form.code}
                  placeholder="shopify_admin"
                  required
                  onChange={e => {
                    setCodeEdited(true);
                    set('code', toCode(e.target.value));
                  }}
                />
                <p className="helper mt-1">Unique identifier — used in endpoint configs</p>
              </div>

              <div>
                <label className="label block mb-1">Base URL *</label>
                <input
                  type="url"
                  className="input w-full text-sm font-mono"
                  value={form.base_url}
                  placeholder="https://api.example.com/v2"
                  required
                  onChange={e => set('base_url', e.target.value)}
                />
                <p className="helper mt-1">All endpoint paths are appended to this URL</p>
              </div>

              <div>
                <label className="label block mb-1">Description</label>
                <textarea
                  className="input w-full text-sm resize-none"
                  rows={2}
                  value={form.description}
                  placeholder="What does this API provide?"
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1">Timeout (seconds)</label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className="input w-full text-sm"
                    value={form.timeout_seconds}
                    onChange={e => set('timeout_seconds', Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col justify-end gap-2 pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ssl_verify}
                      onChange={e => set('ssl_verify', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Verify SSL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => set('is_active', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Authentication */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2">
                Authentication
              </h2>

              <div>
                <label className="label block mb-1">Auth Type</label>
                <div className="space-y-1.5">
                  {AUTH_TYPE_OPTIONS.map(opt => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        form.auth_type === opt.value
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="auth_type"
                        value={opt.value}
                        checked={form.auth_type === opt.value}
                        onChange={() => handleAuthTypeChange(opt.value)}
                        className="mt-0.5 shrink-0"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800 leading-none">
                          {opt.label}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Auth config fields — conditionally rendered */}
              {form.auth_type !== 'none' && (
                <div className="pt-1">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Credentials
                  </div>
                  <AuthConfigFields
                    authType={form.auth_type}
                    config={form.auth_config}
                    onChange={handleAuthConfigChange}
                  />
                </div>
              )}

              {/* Test connection (edit only) */}
              {isEdit && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="btn-outline flex items-center gap-1.5 text-sm w-full justify-center"
                  >
                    {testing ? <Spinner size="sm" /> : <Wifi size={14} />}
                    {testing ? 'Testing…' : 'Test Connection'}
                  </button>

                  {testResult && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-mono ${
                      testResult.success
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {testResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Default Headers ───────────────────────────────────────── */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-100 pb-2 mb-4">
              Default Headers
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                — applied to every request from this resource
              </span>
            </h2>
            <HeadersEditor
              headers={form.default_headers}
              onChange={h => set('default_headers', h)}
            />
          </div>

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/api-bridge/resources')}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              {saveMut.isPending && <Spinner size="sm" />}
              {isEdit ? 'Save changes' : 'Create resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
