import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import DynamicFieldInput from '@/components/ui/DynamicFieldInput';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { QK } from '@/lib/queryKeys';
import componentTypeDefs from '@/modules/page-manager/page-defs/component-types.json';

// Maps component_type value → DynamicFieldInput field_type
const COMPONENT_TYPE_FIELD: Record<string, string> = Object.fromEntries(
  componentTypeDefs.map(ct => [ct.value, ct.field_type]),
);

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TableDef {
  has_label: boolean;
  fields:    ToolkitField[];
  options:   ToolkitFieldOption[];
}

export interface PimFormApi {
  meta:   () => Promise<TableDef>;
  list?:  (p: {
    filters?: Record<string, unknown>;
    sort?:    { field: string; direction: 'asc' | 'desc' }[];
    limit?:   number;
    offset?:  number;
  }) => Promise<{ rows: Row[]; total: number }>;
  get:    (id: string | number) => Promise<Row>;
  upsert: (data: Row) => Promise<unknown>;
}

export interface PimFormPageProps {
  entityCode: string;
  basePath:   string;
  newLabel:   string;
  editLabel:  string;
  api:        PimFormApi;
  idType?:    'string' | 'number';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIT_TYPES      = new Set(['uuid', 'id', 'datetime', 'date', 'time', 'daterange']);
const FULL_WIDTH_TYPES = new Set(['textarea', 'richtext', 'jsonb', 'json']);

// ── Component ─────────────────────────────────────────────────────────────────

export default function PimFormPage({
  entityCode, basePath, newLabel, editLabel, api, idType = 'string',
}: PimFormPageProps) {
  const { id }   = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isEdit   = !!id;
  const [values,      setValues]      = useState<Row>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const resolvedId = id
    ? (idType === 'number' ? Number(id) : id)
    : undefined;

  // ── Queries ──

  // Page definition is required — drives which fields appear and in what order
  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey:  QK.pageDef(entityCode),
    queryFn:   () => pageDefsApi.get(entityCode),
    staleTime: 5 * 60_000,
    retry:     false,
  });

  const { data: tableDef, isLoading: loadingMeta } = useQuery<TableDef>({
    queryKey:  ['toolkit-table', entityCode],
    queryFn:   api.meta,
    staleTime: 5 * 60_000,
    enabled:   !!pageDef,
  });

  const { data: existing, isLoading: loadingRecord } = useQuery<Row>({
    queryKey: ['pim-record', entityCode, resolvedId],
    queryFn:  () => api.get(resolvedId!),
    enabled:  !!pageDef && isEdit && resolvedId !== undefined,
  });

  // ── Populate from existing record ──

  useEffect(() => {
    if (!existing || !tableDef) return;
    const cfgMap = new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c]));
    const init: Row = {};
    for (const f of tableDef.fields) {
      if (f.is_system && AUDIT_TYPES.has(f.field_type)) continue;
      const cfg    = cfgMap.get(f.code);
      const dataKey = cfg?.bindkey ?? f.code;
      const isMl   = f.is_multilingual || cfg?.multilingual || f.field_type === 'jsonb';
      if (cfg?.component_type === 'select_multi') {
        const val = existing[dataKey];
        init[f.code] = typeof val === 'string'
          ? val.split(',').filter(Boolean)
          : Array.isArray(val) ? val : [];
      } else if (isMl) {
        const val = existing[dataKey];
        init[f.code] = (val && typeof val === 'object' && !Array.isArray(val))
          ? (val as Record<string, string>)
          : {};
      } else {
        init[f.code] = existing[dataKey] ?? '';
      }
    }
    setValues(init);
  }, [existing, tableDef, pageDef]);

  // ── Defaults for new record ──

  useEffect(() => {
    if (isEdit || !tableDef) return;
    const cfgMultilingualCodes = new Set(
      (pageDef?.form_config?.fields ?? []).filter(c => c.multilingual).map(c => c.code),
    );
    const init: Row = {};
    for (const f of tableDef.fields) {
      if (f.is_system && AUDIT_TYPES.has(f.field_type)) continue;
      const isMultilingual = f.is_multilingual || cfgMultilingualCodes.has(f.code) || f.field_type === 'jsonb';
      if (isMultilingual)                                                    init[f.code] = { en: '' };
      else if (f.field_type === 'toggle')                                    init[f.code] = f.default_value === 'true';
      else if (f.field_type === 'integer' || f.field_type === 'number')      init[f.code] = f.default_value != null ? Number(f.default_value) : 0;
      else                                                                   init[f.code] = f.default_value ?? '';
    }
    setValues(init);

    // Auto-assign sort_order = max(existing) + 1 so new records don't collide
    const hasSortOrder = tableDef.fields.some(f => f.code === 'sort_order');
    if (hasSortOrder && api.list) {
      api.list({ sort: [{ field: 'sort_order', direction: 'desc' }], limit: 1 })
        .then(res => {
          const maxVal = res.rows[0]?.sort_order;
          setValues(prev => ({ ...prev, sort_order: maxVal != null ? Number(maxVal) + 1 : 0 }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableDef, pageDef, isEdit]);

  // ── Save ──

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Row = { ...values };
      for (const [k, v] of Object.entries(payload)) {
        if (cfgMap.get(k)?.component_type === 'select_multi' && Array.isArray(v)) {
          payload[k] = v.join(',');
        }
      }
      if (isEdit && resolvedId !== undefined) payload.id = resolvedId;
      return api.upsert(payload);
    },
    onSuccess: (result) => {
      const res = (result as Row) ?? {};
      const newId = res.id ?? (res.data as Row)?.id;
      if (newId) setValues(prev => ({ ...prev, id: newId }));
      setFieldErrors({});
      toast.success(isEdit ? 'Saved successfully' : 'Created successfully');
      qc.invalidateQueries({ queryKey: ['pim-list', entityCode] });
      if (isEdit) {
        qc.invalidateQueries({ queryKey: ['pim-record', entityCode, resolvedId] });
        navigate(basePath);
      } else {
        navigate(newId ? `${basePath}/${newId}/edit` : basePath);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  function set(field: string, val: unknown) {
    const normalized = field === 'code' && typeof val === 'string'
      ? val.toLowerCase().replace(/ /g, '_')
      : val;
    setValues(prev => ({ ...prev, [field]: normalized }));
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSave() {
    const errors: Record<string, string> = {};
    for (const f of displayFields) {
      if (!f.is_required) continue;
      const cfg = cfgMap.get(f.code);
      // skip validation for fields that are disabled in the current mode
      const modeDisabled = isEdit ? cfg?.edit_mode === 'disabled' : cfg?.add_mode === 'disabled';
      if (modeDisabled) continue;
      const val = values[f.code];
      const isEmpty = val === undefined || val === null || val === ''
        || (Array.isArray(val) && val.length === 0)
        || (typeof val === 'object' && !Array.isArray(val) && val !== null
            && Object.values(val as Record<string, unknown>).every(v => !v));
      if (!isEmpty) continue;
      const msgObj  = cfg?.validation_message ?? {};
      const msgKeys = Object.keys(msgObj);
      errors[f.code] = msgKeys.length > 0
        ? (msgObj.en ?? msgObj[msgKeys[0]] ?? `${f.label} is required`)
        : `${f.label} is required`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    saveMut.mutate();
  }

  // Stable cfg map — used in displayFields, handleSave, mutationFn, and render
  const cfgMap = useMemo(
    () => new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c])),
    [pageDef],
  );

  // Build display field list from page def form config + toolkit field metadata.
  // add_mode/edit_mode 'disabled' = visible but non-editable (fieldset disabled).
  // Only visible:false (eye toggle) hides the field entirely.
  const displayFields = useMemo((): ToolkitField[] => {
    const base = (tableDef?.fields ?? [])
      .filter(f => !(f.is_system && AUDIT_TYPES.has(f.field_type)));

    const cfgFields = pageDef?.form_config?.fields ?? [];

    const applyOverrides = (f: ToolkitField): ToolkitField => {
      const cfg        = cfgMap.get(f.code);
      const componentFt = cfg?.component_type
        ? (COMPONENT_TYPE_FIELD[cfg.component_type] ?? cfg.component_type)
        : null;
      return {
        ...f,
        ...(cfg?.label        ? { label:        cfg.label        } : {}),
        ...(cfg?.ref_endpoint ? { config: { ...f.config, gateway_endpoint: cfg.ref_endpoint } } : {}),
        ...(f.field_type === 'jsonb' || cfg?.multilingual ? { is_multilingual: true } : {}),
        ...(cfg?.required != null ? { is_required: cfg.required } : {}),
        ...(componentFt ? { field_type: componentFt } : {}),
      };
    };

    if (cfgFields.length > 0) {
      return [...base]
        .filter(f => cfgMap.get(f.code)?.visible !== false)
        .sort((a, b) => (cfgMap.get(a.code)?.order ?? 9999) - (cfgMap.get(b.code)?.order ?? 9999))
        .map(applyOverrides);
    }
    return base.sort((a, b) => a.sort_order - b.sort_order).map(applyOverrides);
  }, [tableDef, pageDef, cfgMap]);

  // ── Loading / error states ──

  if (loadingDef || loadingMeta || (isEdit && loadingRecord)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!pageDef) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Contact Administrator to define the Page Definition for{' '}
          <strong className="text-gray-700 dark:text-gray-200">{entityCode}</strong>
        </p>
      </div>
    );
  }

  if (!tableDef) {
    return <p className="p-6 text-sm text-red-500">Could not load field metadata.</p>;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* ── Sticky header ── */}
      <header className="shrink-0 flex items-center gap-3 px-5 py-2.5
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => navigate(basePath)}
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
            {basePath}
          </p>
          <h1 className="pim-title truncate">
            {isEdit ? editLabel : newLabel}
          </h1>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="btn-primary inline-flex items-center gap-1.5 py-1.5 px-4 text-sm"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={13} />}
          {isEdit ? 'Save' : 'Create'}
        </button>
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4 max-w-screen-2xl"
        >
          {displayFields.map(f => {
            const fullWidth       = f.is_multilingual || FULL_WIDTH_TYPES.has(f.field_type);
            const cfg             = cfgMap.get(f.code);
            const modeDisabled    = isEdit ? cfg?.edit_mode === 'disabled' : cfg?.add_mode === 'disabled';
            return (
              <div
                key={f.id}
                className={[
                  fullWidth ? 'col-span-full' : '',
                  modeDisabled ? 'opacity-60' : '',
                ].filter(Boolean).join(' ')}
              >
                {!f.is_multilingual && (
                  <label className="label">
                    {f.label}
                    {f.is_required && !modeDisabled && <span className="text-red-500 ml-0.5">*</span>}
                    {modeDisabled && (
                      <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">(read-only)</span>
                    )}
                  </label>
                )}
                {f.description && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1 leading-snug">
                    {f.description}
                  </p>
                )}
                <fieldset disabled={modeDisabled} className="border-0 p-0 m-0 min-w-0">
                  <DynamicFieldInput
                    field={f}
                    value={values[f.code]}
                    onChange={v => set(f.code, v)}
                    fieldOptions={f.field_type === 'inline_select'
                      ? (tableDef.options ?? []).filter(o => o.field_id === f.id)
                      : undefined}
                    alwaysOpen={f.is_multilingual}
                  />
                </fieldset>
                {!modeDisabled && fieldErrors[f.code] && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors[f.code]}</p>
                )}
              </div>
            );
          })}
        </form>
      </div>
    </div>
  );
}
