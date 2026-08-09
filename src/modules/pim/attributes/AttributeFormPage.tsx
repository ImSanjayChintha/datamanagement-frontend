import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, ChevronRight, Plus, Trash2,
  List, Sparkles, Loader2, Hash, Settings2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import DynamicFieldInput from '@/components/ui/DynamicFieldInput';
import { makeEntityApi } from '@/modules/pim/api';
import { toolkitAiApi } from '@/modules/toolkit/core/api';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { QK } from '@/lib/queryKeys';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import componentTypeDefs from '@/modules/page-manager/page-defs/component-types.json';
import attrTypes from './attr-types.json';

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPONENT_TYPE_FIELD: Record<string, string> = Object.fromEntries(
  componentTypeDefs.map(ct => [ct.value, ct.field_type]),
);

const SELECT_TYPES     = new Set(['select', 'multiselect']);
const AUDIT_TYPES      = new Set(['uuid', 'id', 'datetime', 'date', 'time', 'daterange']);
const FULL_WIDTH_TYPES = new Set(['textarea', 'richtext', 'jsonb', 'json']);

// ── API ───────────────────────────────────────────────────────────────────────

const attrsApi   = makeEntityApi('attributes', 'attributes');
const localesApi = makeEntityApi('locales',    'locales');

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TableDef {
  has_label: boolean;
  fields:    ToolkitField[];
  options:   ToolkitFieldOption[];
}

interface Locale {
  code:       string;
  name:       string;
  is_default: boolean;
  sort_order: number;
}

interface AttrValue {
  _key:  string;
  code:  string;
  label: Record<string, string>;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = clsx(
  'w-full h-9 px-3 text-sm rounded-lg border',
  'border-gray-200 dark:border-gray-700',
  'bg-white dark:bg-gray-800',
  'text-gray-800 dark:text-gray-100 placeholder-gray-400',
  'outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500',
  'transition-colors',
);

const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5';

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="shrink-0">
      <span className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600',
      )}>
        <span className={clsx(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
          value ? 'translate-x-4' : 'translate-x-0',
        )} />
      </span>
    </button>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────

function SettingRow({ label, description, value, onChange, border = true }: {
  label:       string;
  description: string;
  value:       boolean;
  onChange:    (v: boolean) => void;
  border?:     boolean;
}) {
  return (
    <div className={clsx(
      'flex items-center justify-between gap-4 py-3',
      border && 'border-t border-gray-100 dark:border-gray-800 first:border-t-0',
    )}>
      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label}</p>
        {description && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Card({ icon: Icon, title, subtitle, children, badge, action }: {
  icon:      React.ElementType;
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
  badge?:    string;
  action?:   React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-900/30">
          <Icon size={14} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
            {badge && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Value label — language tabs driven by pim.locales ────────────────────────

function ValueLabelInput({
  value, onChange, locales, defaultLocale,
}: {
  value:         Record<string, string>;
  onChange:      (v: Record<string, string>) => void;
  locales:       Locale[];
  defaultLocale: string;
}) {
  const [lang, setLang] = useState<string>(defaultLocale);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 mb-1.5 w-fit flex-wrap gap-0.5">
        {locales.map(l => {
          const filled = !!value[l.code]?.trim();
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              title={l.name}
              className={clsx(
                'flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase transition-colors',
                lang === l.code
                  ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-300 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200',
              )}
            >
              {l.code}
              {filled && <span className="w-1 h-1 rounded-full bg-indigo-400 ml-0.5" />}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={value[lang] ?? ''}
        onChange={e => onChange({ ...value, [lang]: e.target.value })}
        placeholder={`Label in ${lang.toUpperCase()}…`}
        className={inputCls}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AttributeFormPage() {
  const { id }   = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isEdit   = !!id;

  // ── Page-def-driven field state ──
  const [values,      setValues]      = useState<Row>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Custom: selectable values (options) ──
  const [options,     setOptions]     = useState<AttrValue[]>([]);
  const [translating, setTranslating] = useState(false);

  // ── Page def + table def ──
  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey:  QK.pageDef('attributes'),
    queryFn:   () => pageDefsApi.get('attributes'),
    staleTime: 5 * 60_000,
    retry:     false,
  });

  const { data: tableDef, isLoading: loadingMeta } = useQuery<TableDef>({
    queryKey:  ['toolkit-table', 'attributes'],
    queryFn:   attrsApi.meta,
    staleTime: 5 * 60_000,
  });

  // ── Locales (for the options label editor) ──
  const { data: localeRes } = useQuery({
    queryKey: ['pim-locales'],
    queryFn:  () => localesApi.list({
      limit:  50,
      sort:   [{ field: 'sort_order', direction: 'asc' }],
      filter: { is_active: { eq: true } },
    }),
    staleTime: 10 * 60_000,
  });

  const locales: Locale[] = useMemo(() => {
    const rows = (localeRes?.rows ?? []) as Row[];
    return rows.map(r => ({
      code:       String(r.code       ?? ''),
      name:       String(r.name       ?? r.code ?? ''),
      is_default: Boolean(r.is_default),
      sort_order: Number(r.sort_order ?? 0),
    }));
  }, [localeRes]);

  const effectiveLocales: Locale[] = locales.length > 0
    ? locales
    : [{ code: 'en', name: 'English', is_default: true, sort_order: 0 }];

  const defaultLocale = useMemo(
    () => effectiveLocales.find(l => l.is_default)?.code ?? effectiveLocales[0]?.code ?? 'en',
    [effectiveLocales],
  );

  const targetLocales = useMemo(
    () => effectiveLocales.filter(l => l.code !== defaultLocale).map(l => l.code),
    [effectiveLocales, defaultLocale],
  );

  // ── Existing record — raw_i18n so JSONB fields come back as objects ──
  const { data: existing, isLoading: loadingRecord } = useQuery<Row>({
    queryKey:  ['pim-record', 'attributes', id],
    queryFn:   () => attrsApi.get(id!, { raw_i18n: true }),
    enabled:   isEdit && !!id,
    staleTime: 0,
  });

  // ── cfgMap + display fields ──
  const cfgMap = useMemo(
    () => new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c])),
    [pageDef],
  );

  const displayFields = useMemo((): ToolkitField[] => {
    const base = (tableDef?.fields ?? [])
      .filter(f => !(f.is_system && AUDIT_TYPES.has(f.field_type)))
      .filter(f => f.code !== 'options'); // handled by the custom section below

    const cfgFields = pageDef?.form_config?.fields ?? [];

    const applyOverrides = (f: ToolkitField): ToolkitField => {
      const cfg = cfgMap.get(f.code);
      const componentFt = cfg?.component_type
        ? (COMPONENT_TYPE_FIELD[cfg.component_type] ?? cfg.component_type)
        : null;
      return {
        ...f,
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

  // Split: toggles go to the right panel as SettingRows; everything else goes left
  const leftFields  = useMemo(() => displayFields.filter(f => f.field_type !== 'toggle'), [displayFields]);
  const rightFields = useMemo(() => displayFields.filter(f => f.field_type === 'toggle'),  [displayFields]);

  // ── Populate from existing record ──
  useEffect(() => {
    if (!existing || !tableDef) return;
    const init: Row = {};
    for (const f of displayFields) {
      const cfg     = cfgMap.get(f.code);
      const dataKey = cfg?.bindkey ?? f.code;
      const isMl    = f.is_multilingual || cfg?.multilingual || f.field_type === 'jsonb';
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

    // Populate custom options section
    const rawOpts = existing.options;
    if (Array.isArray(rawOpts)) {
      setOptions(rawOpts.map((o: Row) => ({
        _key:  String(o.code ?? Math.random()),
        code:  String(o.code  ?? ''),
        label: (() => {
          const l = o.label;
          if (typeof l === 'object' && l && !Array.isArray(l)) return l as Record<string, string>;
          if (typeof l === 'string') return { en: l };
          return {};
        })(),
      })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, tableDef, pageDef]);

  // ── Defaults for new record ──
  useEffect(() => {
    if (isEdit || !tableDef) return;
    const cfgMultilingualCodes = new Set(
      (pageDef?.form_config?.fields ?? []).filter(c => c.multilingual).map(c => c.code),
    );
    const init: Row = {};
    for (const f of displayFields) {
      const isMultilingual = f.is_multilingual || cfgMultilingualCodes.has(f.code) || f.field_type === 'jsonb';
      if (isMultilingual)                                                    init[f.code] = {};
      else if (f.field_type === 'toggle')                                    init[f.code] = f.default_value === 'true';
      else if (f.field_type === 'integer' || f.field_type === 'number')      init[f.code] = f.default_value != null ? Number(f.default_value) : 0;
      else                                                                   init[f.code] = f.default_value ?? '';
    }
    setValues(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableDef, pageDef, isEdit]);

  // ── Options helpers ──
  function addOption() {
    setOptions(prev => [...prev, { _key: Math.random().toString(36).slice(2), code: '', label: {} }]);
  }
  function updateOptionCode(key: string, val: string) {
    setOptions(prev => prev.map(v =>
      v._key === key
        ? { ...v, code: val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }
        : v,
    ));
  }
  function updateOptionLabel(key: string, label: Record<string, string>) {
    setOptions(prev => prev.map(v => v._key === key ? { ...v, label } : v));
  }
  function removeOption(key: string) {
    setOptions(prev => prev.filter(v => v._key !== key));
  }

  // ── AI translate all option labels ──
  async function handleTranslateAll() {
    if (!options.length || !targetLocales.length) return;
    const texts: Record<string, string> = {};
    for (const v of options) {
      const src = v.label[defaultLocale]?.trim();
      if (src) texts[v._key] = src;
    }
    if (!Object.keys(texts).length) {
      toast.error(`Fill in the ${defaultLocale.toUpperCase()} label for at least one value first`);
      return;
    }
    setTranslating(true);
    try {
      const result = await toolkitAiApi.translate(texts, defaultLocale, targetLocales);
      setOptions(prev => prev.map(v => {
        const translations = result[v._key];
        if (!translations) return v;
        return {
          ...v,
          label: { ...v.label, ...translations, [defaultLocale]: v.label[defaultLocale] ?? '' },
        };
      }));
      toast.success(`Translated into ${targetLocales.length} language${targetLocales.length !== 1 ? 's' : ''}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }

  // ── Save ──
  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Row = { ...values };
      for (const [k, v] of Object.entries(payload)) {
        if (cfgMap.get(k)?.component_type === 'select_multi' && Array.isArray(v)) {
          payload[k] = v.join(',');
        }
      }
      const currentAttrType = String(values.attr_type ?? 'text');
      payload.options = SELECT_TYPES.has(currentAttrType)
        ? options.filter(v => v.code.trim()).map(v => ({ code: v.code, label: v.label }))
        : null;
      if (isEdit && id) payload.id = id;
      return attrsApi.upsert(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Attribute saved' : 'Attribute created');
      qc.invalidateQueries({ queryKey: ['pim-attrs-all'] });
      if (isEdit) qc.invalidateQueries({ queryKey: ['pim-record', 'attributes', id] });
      navigate('/pim/attributes');
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  function set(field: string, val: unknown) {
    const normalized = field === 'code' && typeof val === 'string'
      ? val.toLowerCase().replace(/ /g, '_')
      : val;
    setValues(prev => ({ ...prev, [field]: normalized }));
    if (fieldErrors[field]) setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  function handleSave() {
    const errors: Record<string, string> = {};
    for (const f of displayFields) {
      if (!f.is_required) continue;
      const cfg = cfgMap.get(f.code);
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

  // ── Derived ──
  const attrType          = String(values.attr_type ?? 'text');
  const showValues        = SELECT_TYPES.has(attrType);
  const filledValues      = options.filter(v => v.code.trim()).length;
  const selectedType      = attrTypes.find(t => t.code === attrType);
  const hasTranslatableSrc = options.some(v => v.label[defaultLocale]?.trim());
  const showTranslateBtn  = locales.length > 1 && options.length > 0;

  const displayName = useMemo(() => {
    const n = values.name;
    if (n && typeof n === 'object' && !Array.isArray(n)) {
      const obj = n as Record<string, string>;
      return obj.en ?? Object.values(obj)[0] ?? '';
    }
    return String(n ?? values.code ?? '');
  }, [values.name, values.code]);

  // ── Loading / error ──
  if (loadingDef || loadingMeta || (isEdit && loadingRecord)) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  if (!pageDef) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No page definition found for{' '}
          <strong className="text-gray-700 dark:text-gray-200">attributes</strong>.
          Create one in the Page Manager to enable this form.
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
      <header className="shrink-0 flex items-center gap-4 px-6 py-3
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/pim/attributes')}
          className="p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 min-w-0">
          <span
            className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer shrink-0"
            onClick={() => navigate('/pim/attributes')}
          >
            Attributes
          </span>
          <ChevronRight size={11} className="shrink-0" />
          <span className="text-gray-700 dark:text-gray-200 font-medium truncate">
            {isEdit ? (displayName || String(values.code ?? '') || 'Edit') : 'New Attribute'}
          </span>
        </div>

        {selectedType && (
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium
                           bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300
                           border border-indigo-100 dark:border-indigo-800 shrink-0">
            {selectedType.label}
          </span>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-semibold
                     bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white
                     disabled:opacity-50 transition-colors shadow-sm shrink-0"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={13} />}
          {isEdit ? 'Save changes' : 'Create attribute'}
        </button>
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          className="px-6 py-6 space-y-5"
        >

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

            {/* ── Left (3/5): identity fields + selectable values ── */}
            <div className="xl:col-span-3 space-y-5">
              <Card icon={Hash} title="Identity" subtitle="Code, name and classification">
                <div className="grid grid-cols-2 gap-4">
                  {leftFields.map(f => {
                    const isWide       = f.is_multilingual || FULL_WIDTH_TYPES.has(f.field_type);
                    const cfg          = cfgMap.get(f.code);
                    const modeDisabled = isEdit
                      ? (cfg?.edit_mode === 'disabled' || f.code === 'code')
                      : cfg?.add_mode === 'disabled';
                    return (
                      <div
                        key={f.id}
                        className={[
                          isWide       ? 'col-span-2' : '',
                          modeDisabled ? 'opacity-60' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {!f.is_multilingual && (
                          <label className={labelCls}>
                            {f.label}
                            {f.is_required && !modeDisabled && <span className="text-red-500 ml-0.5">*</span>}
                            {modeDisabled && (
                              <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">
                                (read-only)
                              </span>
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
                              ? tableDef.options.filter(o => o.field_id === f.id)
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
                </div>
              </Card>

              {/* ── Selectable Values (custom section — retained) ── */}
              {showValues && (
                <Card
                  icon={List}
                  title="Selectable Values"
                  subtitle={`The choices a user can pick when filling in "${displayName || String(values.code ?? '') || 'this attribute'}" on a product`}
                  badge={filledValues > 0 ? `${filledValues} value${filledValues !== 1 ? 's' : ''}` : undefined}
                  action={
                    showTranslateBtn ? (
                      <button
                        type="button"
                        onClick={handleTranslateAll}
                        disabled={translating || !hasTranslatableSrc}
                        title={!hasTranslatableSrc ? `Fill in the ${defaultLocale.toUpperCase()} label first` : 'Translate all labels using AI'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                   bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400
                                   border border-violet-200 dark:border-violet-800
                                   hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {translating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {translating ? 'Translating…' : 'AI Translate all'}
                      </button>
                    ) : null
                  }
                >
                  {/* Column headers */}
                  {options.length > 0 && (
                    <div className="grid grid-cols-[200px_1fr_40px] gap-4 px-4 py-2 mb-2
                                    bg-gray-50 dark:bg-gray-800/60 rounded-lg
                                    text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <span>Value code</span>
                      <span>Display label per language</span>
                      <span />
                    </div>
                  )}

                  {/* Value rows */}
                  <div className="space-y-2">
                    {options.map((val, idx) => (
                      <div
                        key={val._key}
                        className="grid grid-cols-[200px_1fr_40px] gap-4 items-start
                                   border border-gray-100 dark:border-gray-800
                                   bg-white dark:bg-gray-900 rounded-lg px-4 py-3"
                      >
                        <div>
                          <input
                            type="text"
                            value={val.code}
                            onChange={e => updateOptionCode(val._key, e.target.value)}
                            placeholder={`value_${idx + 1}`}
                            className={clsx(inputCls, 'font-mono text-xs')}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">stored in the product</p>
                        </div>

                        <ValueLabelInput
                          value={val.label}
                          onChange={label => updateOptionLabel(val._key, label)}
                          locales={effectiveLocales}
                          defaultLocale={defaultLocale}
                        />

                        <button
                          type="button"
                          onClick={() => removeOption(val._key)}
                          className="mt-1 p-2 text-gray-300 hover:text-red-400
                                     hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Empty state */}
                  {options.length === 0 && (
                    <div className="flex flex-col items-center py-10 text-gray-300 dark:text-gray-700">
                      <List size={32} className="mb-3" />
                      <p className="text-sm font-medium text-gray-400 dark:text-gray-500">No selectable values defined</p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 max-w-sm text-center">
                        Add the values a user can choose from — e.g. for a <em>Cage Type</em> attribute you might add
                        "Steel", "Brass", "Polyamide"
                      </p>
                    </div>
                  )}

                  {/* Add button + hint */}
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={addOption}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
                                 border border-indigo-200 dark:border-indigo-700
                                 text-indigo-600 dark:text-indigo-400
                                 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <Plus size={14} />
                      Add selectable value
                    </button>
                    {showTranslateBtn && !hasTranslatableSrc && (
                      <p className="text-[11px] text-gray-400">
                        Fill in the {defaultLocale.toUpperCase()} label on at least one value to enable AI translation
                      </p>
                    )}
                  </div>
                </Card>
              )}
            </div>

            {/* ── Right (2/5): behaviour toggles as setting rows ── */}
            <div className="xl:col-span-2">
              <Card
                icon={Settings2}
                title="Behaviour"
                subtitle="How this attribute behaves on products"
              >
                {rightFields.length > 0
                  ? rightFields.map((f, i) => (
                      <SettingRow
                        key={f.code}
                        label={f.label}
                        description={f.description ?? ''}
                        value={Boolean(values[f.code])}
                        onChange={v => set(f.code, v)}
                        border={i > 0}
                      />
                    ))
                  : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      No behaviour fields configured in the page definition.
                    </p>
                  )
                }
              </Card>
            </div>
          </div>

          <div className="h-4" />
        </form>
      </div>
    </div>
  );
}
