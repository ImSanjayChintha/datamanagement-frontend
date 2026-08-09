import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, X, Search, Pencil, Trash2, Wifi, CheckCircle2, XCircle,
  Send, ChevronDown, ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QK } from '@/lib/queryKeys';
import { pushDestsApi } from '@/modules/api-manager/push/api';
import type { PushDestination, DestType } from '@/types/destinations';
import { DEST_TYPES, DEST_TYPE_LABELS } from '@/types/destinations';
import AdminTable, { type AdminTableColumn } from '@/components/ui/AdminTable';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { clsx } from 'clsx';

// ── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 350): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

const TYPE_COLORS: Record<DestType, string> = {
  azure_blob:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  email:        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  s3_compatible: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  amazon_s3:    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  filesystem:   'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  rabbitmq:     'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  sftp:         'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  http_api:     'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

// ── Form field types ──────────────────────────────────────────────────────────

type FieldType = 'text' | 'password' | 'number' | 'checkbox' | 'select' | 'textarea';

interface FormField {
  key:         string;
  label:       string;
  type:        FieldType;
  options?:    { value: string; label: string }[];
  placeholder?: string;
  hint?:       string;
}

interface TypeSchema {
  config:  FormField[];
  secrets: FormField[];
}

const TYPE_SCHEMAS: Record<DestType, TypeSchema> = {
  azure_blob: {
    config: [
      { key: 'account_name',  label: 'Storage Account Name', type: 'text' },
      { key: 'container',     label: 'Container',             type: 'text' },
      { key: 'auth_method',   label: 'Auth Method',           type: 'select',
        options: [
          { value: 'sas_token',        label: 'SAS Token' },
          { value: 'access_key',       label: 'Access Key' },
          { value: 'managed_identity', label: 'Managed Identity' },
        ],
      },
      { key: 'endpoint_url',  label: 'Endpoint URL (optional)', type: 'text', placeholder: 'https://...' },
    ],
    secrets: [
      { key: 'sas_token', label: 'SAS Token / Access Key', type: 'password', hint: 'Leave blank to keep existing value' },
    ],
  },
  email: {
    config: [
      { key: 'to',                label: 'To',                 type: 'text',     placeholder: 'recipient@example.com' },
      { key: 'cc',                label: 'CC',                 type: 'text',     placeholder: 'optional' },
      { key: 'bcc',               label: 'BCC',                type: 'text',     placeholder: 'optional' },
      { key: 'send_individually', label: 'Send Individually',  type: 'checkbox', hint: 'Send one email per recipient instead of bulk' },
    ],
    secrets: [],
  },
  s3_compatible: {
    config: [
      { key: 'bucket',        label: 'Bucket Name',   type: 'text' },
      { key: 'region',        label: 'Region',        type: 'text', placeholder: 'us-east-1' },
      { key: 'access_key_id', label: 'Access Key ID', type: 'text' },
      { key: 'endpoint_url',  label: 'Endpoint URL',  type: 'text', placeholder: 'https://minio.example.com' },
    ],
    secrets: [
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', hint: 'Leave blank to keep existing value' },
    ],
  },
  amazon_s3: {
    config: [
      { key: 'bucket',        label: 'Bucket Name',   type: 'text' },
      { key: 'region',        label: 'Region',        type: 'text', placeholder: 'eu-west-1' },
      { key: 'access_key_id', label: 'Access Key ID', type: 'text' },
    ],
    secrets: [
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', hint: 'Leave blank to keep existing value' },
    ],
  },
  filesystem: {
    config: [
      { key: 'base_path',         label: 'Base Path',              type: 'text',     placeholder: '/data/exports' },
      { key: 'filename_pattern',  label: 'Filename Pattern',       type: 'text',     placeholder: '{date}_{name}.csv' },
      { key: 'create_dirs',       label: 'Create directories',     type: 'checkbox', hint: 'Create missing parent directories automatically' },
    ],
    secrets: [],
  },
  rabbitmq: {
    config: [
      { key: 'host',         label: 'Host',                 type: 'text',     placeholder: 'rabbit.example.com' },
      { key: 'port',         label: 'Port',                 type: 'number',   placeholder: '5672' },
      { key: 'vhost',        label: 'Virtual Host',         type: 'text',     placeholder: '/' },
      { key: 'username',     label: 'Username',             type: 'text' },
      { key: 'exchange',     label: 'Exchange name',        type: 'text',     placeholder: 'interactiv4' },
      { key: 'routing_key',  label: 'Routing key',          type: 'text',     placeholder: 'inventory_updated' },
      { key: 'use_ssl',      label: 'Use SSL/TLS',          type: 'checkbox' },
      { key: 'ca_cert_path', label: 'CA certificate path',  type: 'text',     placeholder: './certificates/fersa_com.ca-bundle' },
    ],
    secrets: [
      { key: 'password', label: 'Password', type: 'password', hint: 'Leave blank to keep existing value' },
    ],
  },
  sftp: {
    config: [
      { key: 'host',             label: 'Host',             type: 'text',   placeholder: 'sftp.example.com' },
      { key: 'port',             label: 'Port',             type: 'number', placeholder: '22' },
      { key: 'username',         label: 'Username',         type: 'text' },
      { key: 'private_key_path', label: 'Private Key Path (optional)', type: 'text', placeholder: '/path/to/key.pem' },
    ],
    secrets: [
      { key: 'password', label: 'Password', type: 'password', hint: 'Leave blank to keep existing value' },
    ],
  },
  http_api: {
    config: [
      { key: 'url',       label: 'URL',       type: 'text', placeholder: 'https://api.example.com/webhook' },
      { key: 'auth_type', label: 'Auth Type', type: 'select',
        options: [
          { value: 'none',    label: 'None' },
          { value: 'bearer',  label: 'Bearer Token' },
          { value: 'basic',   label: 'Basic Auth' },
          { value: 'api_key', label: 'API Key Header' },
        ],
      },
      { key: 'header_name',    label: 'Header Name (for API key)',  type: 'text',     placeholder: 'X-Api-Key' },
      { key: 'extra_headers',  label: 'Extra Headers (JSON object)', type: 'textarea', placeholder: '{"Accept": "application/json"}' },
    ],
    secrets: [
      { key: 'auth_value',    label: 'Token / Password / Key', type: 'password', hint: 'Leave blank to keep existing value' },
      { key: 'auth_username', label: 'Username (for Basic Auth)', type: 'text' },
    ],
  },
};

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name:        string;
  description: string;
  dest_type:   DestType;
  is_active:   boolean;
  config:      Record<string, string | boolean>;
  secrets:     Record<string, string>;
}

function emptyForm(type: DestType = 'azure_blob'): FormState {
  return { name: '', description: '', dest_type: type, is_active: true, config: {}, secrets: {} };
}

function formFromRecord(r: PushDestination): FormState {
  const cfg: Record<string, string | boolean> = {};
  const schema = TYPE_SCHEMAS[r.dest_type];
  for (const f of schema.config) {
    const v = r.config[f.key];
    if (f.type === 'checkbox') {
      cfg[f.key] = Boolean(v);
    } else {
      cfg[f.key] = v != null ? String(v) : '';
    }
  }
  return {
    name:        r.name,
    description: r.description ?? '',
    dest_type:   r.dest_type,
    is_active:   r.is_active,
    config:      cfg,
    secrets:     {},
  };
}

function buildPayload(form: FormState) {
  const schema = TYPE_SCHEMAS[form.dest_type];
  const config: Record<string, unknown> = {};
  for (const f of schema.config) {
    const v = form.config[f.key];
    if (f.type === 'number') config[f.key] = v ? Number(v) : null;
    else if (f.type === 'checkbox') config[f.key] = Boolean(v);
    else config[f.key] = v ?? '';
  }
  const secrets: Record<string, string> = {};
  for (const f of schema.secrets) {
    const v = form.secrets[f.key];
    if (v) secrets[f.key] = v;
  }
  return { config, secrets };
}

// ── Type-specific field section ────────────────────────────────────────────────

function FieldGroup({
  title,
  fields,
  values,
  onChange,
  isSecrets = false,
}: {
  title:     string;
  fields:    FormField[];
  values:    Record<string, string | boolean>;
  onChange:  (key: string, value: string | boolean) => void;
  isSecrets?: boolean;
}) {
  if (!fields.length) return null;
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
        {title}
        {isSecrets && (
          <span className="text-[10px] normal-case tracking-normal font-normal text-gray-400">
            — never returned by the API
          </span>
        )}
      </h4>
      {fields.map(f => (
        <div key={f.key}>
          <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
            {f.label}
          </label>
          {f.type === 'checkbox' ? (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={Boolean(values[f.key])}
                onChange={e => onChange(f.key, e.target.checked)}
              />
              <span className="text-[12px] text-gray-600 dark:text-gray-400">{f.hint ?? f.label}</span>
            </label>
          ) : f.type === 'select' ? (
            <select
              className="input text-[12px] py-1.5 w-full"
              value={String(values[f.key] ?? '')}
              onChange={e => onChange(f.key, e.target.value)}
            >
              <option value="">— select —</option>
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              className="input text-[12px] font-mono py-1.5 w-full resize-y min-h-[72px]"
              placeholder={f.placeholder}
              value={String(values[f.key] ?? '')}
              onChange={e => onChange(f.key, e.target.value)}
              rows={3}
            />
          ) : (
            <>
              <input
                type={f.type}
                className="input text-[12px] py-1.5 w-full"
                placeholder={f.placeholder ?? (isSecrets ? 'leave blank to keep existing' : undefined)}
                value={String(values[f.key] ?? '')}
                onChange={e => onChange(f.key, e.target.value)}
                autoComplete={f.type === 'password' ? 'new-password' : undefined}
              />
              {f.hint && f.type !== 'password' && (
                <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── RabbitMQ custom layout ────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-6 mb-3 first:mt-0">
      {children}
    </p>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{children}</p>;
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function MetadataSection({ insertedAt }: { insertedAt: string }) {
  const formatted = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(insertedAt));
  return (
    <>
      <SectionHeader>Metadata</SectionHeader>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">Created</span>
          <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200">{formatted}</span>
        </div>
      </div>
    </>
  );
}

function RabbitMQFields({
  config, secrets, onConfig, onSecret, insertedAt,
}: {
  config:      Record<string, string | boolean>;
  secrets:     Record<string, string>;
  onConfig:    (k: string, v: string | boolean) => void;
  onSecret:    (k: string, v: string) => void;
  insertedAt?: string;
}) {
  const sslEnabled = Boolean(config.use_ssl);
  const t = (k: string) => String(config[k] ?? '');
  const s = (k: string) => String(secrets[k] ?? '');

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
        Connection Settings
      </p>

      {/* CONNECTION */}
      <SectionHeader>Connection</SectionHeader>

      <div className="flex gap-3">
        <div className="flex-1">
          <FLabel required>Host</FLabel>
          <input
            className="input text-[12px] py-1.5 w-full"
            placeholder="rabbit.example.com"
            value={t('host')}
            onChange={e => onConfig('host', e.target.value)}
          />
        </div>
        <div className="w-24 shrink-0">
          <FLabel>Port</FLabel>
          <input
            className="input text-[12px] py-1.5 w-full"
            type="number"
            placeholder="5672"
            value={t('port')}
            onChange={e => onConfig('port', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <FLabel>Virtual host</FLabel>
        <input
          className="input text-[12px] py-1.5 w-full"
          placeholder="/"
          value={t('vhost')}
          onChange={e => onConfig('vhost', e.target.value)}
        />
        <FieldHint>Default is /</FieldHint>
      </div>

      {/* AUTHENTICATION */}
      <SectionHeader>Authentication</SectionHeader>

      <div className="flex gap-3">
        <div className="flex-1">
          <FLabel required>Username</FLabel>
          <input
            className="input text-[12px] py-1.5 w-full"
            value={t('username')}
            onChange={e => onConfig('username', e.target.value)}
          />
        </div>
        <div className="flex-1">
          <FLabel>Password (leave blank to keep)</FLabel>
          <input
            type="password"
            className="input text-[12px] py-1.5 w-full"
            autoComplete="new-password"
            placeholder="••••••••"
            value={s('password')}
            onChange={e => onSecret('password', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <ShieldCheck size={14} className="shrink-0 text-gray-400" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Passwords are stored encrypted and never returned by the API.
        </p>
      </div>

      {/* EXCHANGE */}
      <SectionHeader>Exchange</SectionHeader>

      <div>
        <FLabel>Exchange name</FLabel>
        <input
          className="input text-[12px] py-1.5 w-full"
          placeholder="interactiv4"
          value={t('exchange')}
          onChange={e => onConfig('exchange', e.target.value)}
        />
        <FieldHint>e.g. interactiv4</FieldHint>
      </div>

      {/* TOPIC / ROUTING KEY */}
      <SectionHeader>Topic / Routing Key</SectionHeader>

      <div>
        <FLabel>Routing key</FLabel>
        <input
          className="input text-[12px] py-1.5 w-full"
          placeholder="inventory_updated"
          value={t('routing_key')}
          onChange={e => onConfig('routing_key', e.target.value)}
        />
        <FieldHint>e.g. inventory_updated</FieldHint>
      </div>

      {/* TLS / SSL */}
      <SectionHeader>TLS / SSL</SectionHeader>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-500 dark:text-gray-400">Enabled</span>
        <button
          type="button"
          onClick={() => onConfig('use_ssl', !sslEnabled)}
          className={clsx(
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none',
            sslEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
          )}
        >
          <span className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            sslEnabled ? 'translate-x-6' : 'translate-x-1',
          )} />
        </button>
      </div>

      {sslEnabled && (
        <div className="mt-3">
          <FLabel>CA certificate path</FLabel>
          <input
            className="input text-[12px] py-1.5 w-full font-mono"
            placeholder="./certificates/fersa_com.ca-bundle"
            value={t('ca_cert_path')}
            onChange={e => onConfig('ca_cert_path', e.target.value)}
          />
          <FieldHint>Path on the server — e.g. ./certificates/fersa_com.ca-bundle</FieldHint>
        </div>
      )}

      {insertedAt && <MetadataSection insertedAt={insertedAt} />}
    </div>
  );
}

// ── Slide drawer ──────────────────────────────────────────────────────────────

interface DrawerProps {
  open:      boolean;
  onClose:   () => void;
  editing:   PushDestination | null;
  onCreate:  (form: FormState) => void;
  onUpdate:  (form: FormState) => void;
  isSaving:  boolean;
}

function DestinationDrawer({ open, onClose, editing, onCreate, onUpdate, isSaving }: DrawerProps) {
  const [form, setForm]           = useState<FormState>(emptyForm());
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing ? formFromRecord(editing) : emptyForm());
      setTestResult(null);
    }
  }, [open, editing]);

  const setField = (key: keyof FormState, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setConfigField = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, config: { ...prev.config, [key]: value } }));

  const setSecretField = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, secrets: { ...prev.secrets, [key]: String(value) } }));

  async function handleTest() {
    if (!editing) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const r = await pushDestsApi.test(editing.id);
      setTestResult(r);
    } catch (e: unknown) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      onUpdate(form);
    } else {
      onCreate(form);
    }
  }

  const schema = TYPE_SCHEMAS[form.dest_type];

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={clsx(
          'fixed top-0 right-0 h-full w-[480px] bg-white dark:bg-gray-900 shadow-2xl z-50',
          'flex flex-col transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
              {editing ? 'Edit destination' : 'New destination'}
            </h2>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
              Configure the connection for this output target
            </p>
          </div>
          <button onClick={onClose} className="mt-0.5 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Test result banner */}
        {testResult && (
          <div className={clsx(
            'shrink-0 px-5 py-2.5 text-[12px] flex items-center gap-2',
            testResult.ok
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800',
          )}>
            {testResult.ok
              ? <CheckCircle2 size={14} className="shrink-0" />
              : <XCircle size={14} className="shrink-0" />
            }
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Body */}
        <form
          id="dest-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          {/* Common fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">Name <span className="text-red-500">*</span></label>
              <input
                className="input text-[12px] py-1.5 w-full"
                required
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="e.g. Production Azure Export"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                className="input text-[12px] py-1.5 w-full"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type {editing && <span className="font-normal text-gray-400">(read-only)</span>}
                </label>
                <select
                  className="input text-[12px] py-1.5 w-full"
                  value={form.dest_type}
                  disabled={!!editing}
                  onChange={e => {
                    setField('dest_type', e.target.value as DestType);
                    setField('config', {});
                    setField('secrets', {});
                  }}
                >
                  {DEST_TYPES.map(t => (
                    <option key={t} value={t}>{DEST_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  id="is_active"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={form.is_active}
                  onChange={e => setField('is_active', e.target.checked)}
                />
                <label htmlFor="is_active" className="text-[12px] text-gray-700 dark:text-gray-300 cursor-pointer">Active</label>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Type-specific fields */}
          {form.dest_type === 'rabbitmq' ? (
            <RabbitMQFields
              config={form.config}
              secrets={form.secrets}
              onConfig={setConfigField}
              onSecret={(k, v) => setSecretField(k, v)}
              insertedAt={editing?.inserted_at}
            />
          ) : (
            <>
              <FieldGroup
                title="Configuration"
                fields={schema.config}
                values={form.config}
                onChange={setConfigField}
              />
              {schema.secrets.length > 0 && (
                <>
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <FieldGroup
                    title="Credentials"
                    fields={schema.secrets}
                    values={form.secrets}
                    onChange={setSecretField}
                    isSecrets
                  />
                </>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-[12px] py-1.5 px-3">
            Cancel
          </button>
          {editing && (
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="btn-secondary text-[12px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-40"
            >
              {isTesting ? <Spinner size="sm" /> : <Wifi size={13} />}
              Test connection
            </button>
          )}
          <button
            type="submit"
            form="dest-form"
            disabled={isSaving}
            className="btn-primary text-[12px] py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving && <Spinner size="sm" />}
            {editing ? 'Save changes' : 'Create destination'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZES = [50, 100, 200];

export default function DestinationsPage() {
  const qc = useQueryClient();

  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState<DestType | ''>('');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(PAGE_SIZES[0]);
  const debSearch                   = useDebounce(search);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PushDestination | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [testingId, setTestingId]   = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ dest: PushDestination; ok: boolean; message: string } | null>(null);

  useEffect(() => { setPage(1); }, [debSearch, typeFilter, pageSize]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: QK.pushDests(debSearch || undefined, typeFilter || undefined, page),
    queryFn:  () => pushDestsApi.list({
      search:    debSearch || undefined,
      dest_type: typeFilter || undefined,
      page,
      page_size: pageSize,
    }),
    placeholderData: prev => prev,
  });

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const createMut = useMutation({
    mutationFn: (form: FormState) => {
      const { config, secrets } = buildPayload(form);
      return pushDestsApi.create({
        name:        form.name,
        description: form.description,
        dest_type:   form.dest_type,
        config,
        secrets:     secrets as Record<string, string>,
        is_active:   form.is_active,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['push-dests'] });
      setDrawerOpen(false);
      toast.success('Destination created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (form: FormState) => {
      const { config, secrets } = buildPayload(form);
      return pushDestsApi.update({
        id:          editTarget!.id,
        name:        form.name,
        description: form.description,
        config,
        secrets:     secrets as Record<string, string>,
        is_active:   form.is_active,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['push-dests'] });
      setDrawerOpen(false);
      toast.success('Destination updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => pushDestsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['push-dests'] });
      setDeletingId(null);
      toast.success('Destination deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleRowTest(r: PushDestination) {
    setTestingId(r.id);
    setTestResult(null);
    try {
      const result = await pushDestsApi.test(r.id);
      setTestResult({ dest: r, ok: result.ok, message: result.message });
    } catch (e: unknown) {
      setTestResult({ dest: r, ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTestingId(null);
    }
  }

  function openNew() {
    setEditTarget(null);
    setDrawerOpen(true);
  }

  function openEdit(r: PushDestination) {
    setEditTarget(r);
    setDrawerOpen(true);
  }

  const deletingRow = rows.find(r => r.id === deletingId);

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: AdminTableColumn<PushDestination>[] = [
    {
      key: 'name',
      header: 'Destination',
      width: 220,
      render: r => (
        <>
          <div className="text-[12px] font-medium text-gray-900 dark:text-gray-100 leading-snug truncate">{r.name}</div>
          {r.description && (
            <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{r.description}</div>
          )}
        </>
      ),
    },
    {
      key: 'dest_type',
      header: 'Type',
      width: 130,
      render: r => (
        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[r.dest_type]}`}>
          {DEST_TYPE_LABELS[r.dest_type]}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: 85,
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
      key: 'config',
      header: 'Connection',
      width: 210,
      render: r => {
        const cfg = r.config as Record<string, unknown>;
        const hint = (() => {
          if (r.dest_type === 'azure_blob')    return `${cfg.account_name ?? ''} / ${cfg.container ?? ''}`;
          if (r.dest_type === 'email')         return String(cfg.to ?? '');
          if (r.dest_type === 's3_compatible') return `${cfg.bucket ?? ''}  ${cfg.endpoint_url ?? ''}`;
          if (r.dest_type === 'amazon_s3')     return `${cfg.bucket ?? ''}${cfg.region ? ` (${cfg.region})` : ''}`;
          if (r.dest_type === 'filesystem')    return String(cfg.base_path ?? '');
          if (r.dest_type === 'rabbitmq')      return `${cfg.host ?? ''}:${cfg.port ?? '5672'}`;
          if (r.dest_type === 'sftp')          return `${cfg.host ?? ''}:${cfg.port ?? '22'}`;
          if (r.dest_type === 'http_api')      return String(cfg.url ?? '');
          return '';
        })();
        return <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate block">{hint}</span>;
      },
    },
    {
      key: '_actions',
      header: '',
      width: 110,
      minWidth: 110,
      noResize: true,
      render: r => (
        <div className="flex items-center gap-0.5 justify-end">
          <button
            onClick={() => handleRowTest(r)}
            disabled={testingId === r.id}
            title="Test connection"
            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40"
          >
            {testingId === r.id ? <Spinner size="sm" /> : <Wifi size={14} />}
          </button>
          <button
            onClick={() => openEdit(r)}
            title="Edit"
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeletingId(r.id)}
            title="Delete"
            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex flex-col h-full px-6 pt-3 pb-6 gap-4">
        {/* Header */}
        <div className="page-header shrink-0 mb-0">
          <h1 className="pim-title">Push Destinations</h1>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
          >
            <Plus size={13} strokeWidth={2.5} />
            New Destination
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative max-w-xs flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className="input pl-8 py-1.5 text-sm w-full"
              placeholder="Search by name or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <select
              className="input text-sm py-1.5 pr-7 appearance-none"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as DestType | '')}
            >
              <option value="">All types</option>
              {DEST_TYPES.map(t => (
                <option key={t} value={t}>{DEST_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <AdminTable<PushDestination>
          columns={columns}
          rows={rows}
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
          emptyIcon={<Send size={36} />}
          emptyMessage={
            debSearch || typeFilter
              ? 'No destinations match your filters.'
              : 'No push destinations configured yet. Click New Destination to get started.'
          }
          className="flex-1 min-h-0"
        />

      {/* Slide drawer */}
      <DestinationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editTarget}
        onCreate={form => createMut.mutate(form)}
        onUpdate={form => updateMut.mutate(form)}
        isSaving={isSaving}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deletingId !== null}
        title="Delete Destination"
        message={`Delete "${deletingRow?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deletingId !== null && deleteMut.mutate(deletingId)}
        onCancel={() => setDeletingId(null)}
      />

      {/* Test result modal */}
      {testResult && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-50"
          onClick={() => setTestResult(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 border border-gray-200 dark:border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              {testResult.ok
                ? <CheckCircle2 size={22} className="text-green-500 shrink-0 mt-0.5" />
                : <XCircle size={22} className="text-red-500 shrink-0 mt-0.5" />
              }
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {testResult.ok ? 'Connection successful' : 'Connection failed'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {testResult.dest.name} — {DEST_TYPE_LABELS[testResult.dest.dest_type]}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-[12px] text-gray-700 dark:text-gray-300">{testResult.message}</p>
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
