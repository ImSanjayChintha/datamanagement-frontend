import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitTablesApi, toolkitFieldsApi, toolkitSchemasApi } from '@/modules/toolkit/core/api';
import { post } from '@/core/api';
import { QK } from '@/lib/queryKeys';
import type { FieldType, ToolkitTable, ToolkitTableDetail } from '@/types/toolkit';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import toast from 'react-hot-toast';
import type { FieldDraft, FieldOption, TableForm } from './tableBuilder.types';
import { newField, newOption } from './tableBuilder.types';
import { KEY_FIELDS, LOG_FIELDS, DEFAULT_FIELD_CODES, BACKEND_MANAGED_FIELD_CODES } from '@/modules/toolkit/config/tableDefaults';
import type { DefaultField } from '@/modules/toolkit/config/tableDefaults';
// KEY_FIELDS / LOG_FIELDS are the static fallback — props override them when field-defs are loaded
import FieldTypeSelect from './components/FieldTypeSelect';

type DefaultOverride = { description: string; true_label?: string; false_label?: string };

interface Props {
  tableForm: TableForm;
  setTableForm: React.Dispatch<React.SetStateAction<TableForm>>;
  fields: FieldDraft[];
  setFields: React.Dispatch<React.SetStateAction<FieldDraft[]>>;
  isEdit: boolean;
  allTables: ToolkitTable[];
  existing: ToolkitTableDetail | undefined;
  tableCode: string | undefined;
  defaultOverrides: Record<string, DefaultOverride>;
  onDefaultOverride: (code: string, patch: Partial<DefaultOverride>) => void;
  keyFields?: DefaultField[];
  logFields?: DefaultField[];
}

export type { DefaultOverride };

const FIELD_COL = 'grid-cols-[1.6fr_1.2fr_1.3fr_1.5fr_1.2fr_36px_36px_36px_28px]';

const NO_DEFAULT_TYPES = new Set([
  'id', 'sequence', 'uuid', 'computed', 'multiselect', 'daterange', 'file', 'image',
]);

// Field types where the stored VALUE can be multilingual (user sets is_multilingual flag).
// 'jsonb' is the natural choice for multilingual dicts; plain 'json' is excluded.
const MULTILINGUAL_ELIGIBLE = new Set([
  'text', 'textarea', 'richtext', 'slug', 'email', 'phone', 'url', 'color', 'jsonb',
  'inline_select',
]);

const FIELD_COL_HEADERS = (
  <div className={`grid ${FIELD_COL} gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide`}>
    <span>Field name</span>
    <span>Type</span>
    <span>Label</span>
    <span>Description</span>
    <span>Default</span>
    <span className="text-center">Req</span>
    <span className="text-center">Uniq</span>
    <span className="text-center">Multi</span>
    <span />
  </div>
);

function LockedFieldRow({
  field,
  override,
  onOverride,
}: {
  field: DefaultField;
  override?: DefaultOverride;
  onOverride?: (patch: Partial<DefaultOverride>) => void;
}) {
  const currentDesc = override?.description ?? field.description;

  return (
    <div className={`grid ${FIELD_COL} gap-3 items-center px-5 py-2.5 bg-gray-50/70`}>
      <input className="input font-mono text-xs h-8 bg-gray-100 text-gray-400 cursor-not-allowed" value={field.code} disabled />
      <input className="input text-xs h-8 bg-gray-100 text-gray-400 cursor-not-allowed" value={field.field_type} disabled />
      <input className="input text-xs h-8 bg-gray-100 text-gray-400 cursor-not-allowed" value={field.label} disabled />
      <input
        className={clsx('input text-xs h-8', !onOverride && 'bg-gray-100 text-gray-400 cursor-not-allowed')}
        value={currentDesc}
        disabled={!onOverride}
        onChange={e => onOverride?.({ description: e.target.value })}
      />
      {field.default_value != null ? (
        <input
          className="input text-xs h-8 bg-gray-100 text-gray-400 cursor-not-allowed font-mono"
          value={field.default_value}
          disabled
        />
      ) : (
        <span />
      )}
      <div className="flex justify-center">
        <input type="checkbox" checked={field.is_required} disabled className="rounded border-gray-200 text-gray-300 cursor-not-allowed" />
      </div>
      <div className="flex justify-center">
        <input type="checkbox" checked={field.is_unique} disabled className="rounded border-gray-200 text-gray-300 cursor-not-allowed" />
      </div>
      <span />
      <div className="flex justify-end p-1 text-gray-300">
        <Lock size={12} />
      </div>
    </div>
  );
}

export default function TableDesignerTab({
  tableForm, setTableForm,
  fields, setFields,
  isEdit, allTables, existing, tableCode,
  defaultOverrides, onDefaultOverride,
  keyFields: keyFieldsProp,
  logFields: logFieldsProp,
}: Props) {
  const activeKeyFields = keyFieldsProp ?? KEY_FIELDS;
  const activeLogFields = logFieldsProp ?? LOG_FIELDS;
  const activeDefaultCodes = new Set([...activeKeyFields, ...activeLogFields].map(f => f.code));
  const qc = useQueryClient();
  const [fieldsTab, setFieldsTab] = useState<'user' | 'log' | 'values'>('user');
  const [optLang, setOptLang] = useState('');

  const { data: localeRes } = useQuery({
    queryKey: ['locales-active'],
    queryFn: () => post<{ rows: { code: string; name: string; is_default: boolean }[] }>(
      '/run/gateway/locales/list',
      { filters: {}, limit: 50, sort: [{ field: 'sort_order', direction: 'asc' }] },
    ),
    staleTime: 10 * 60_000,
  });
  const locales = localeRes?.rows ?? [];
  const defaultLocale = locales.find(l => l.is_default)?.code ?? locales[0]?.code ?? 'en';
  const activeLang = optLang || defaultLocale;

  const { data: schemas = [] } = useQuery({
    queryKey: QK.schemas(),
    queryFn: () => toolkitSchemasApi.list(),
  });
  const [delField, setDelField] = useState<string | null>(null);
  const [refCache, setRefCache] = useState<Record<string, ToolkitTableDetail>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  // Auto-load referenced table details for select/multiselect fields on mount
  // (refCache starts empty; needed when editing an existing table)
  useEffect(() => {
    const needed = fields
      .filter(f => ['select', 'multiselect'].includes(f.field_type) && f.ref?.ref_table_code)
      .map(f => f.ref!.ref_table_code)
      .filter(code => !refCache[code] && !fetchingRef.current.has(code));

    needed.forEach(code => {
      fetchingRef.current.add(code);
      toolkitTablesApi.getByCode(code)
        .then(detail => setRefCache(prev => ({ ...prev, [code]: detail })))
        .catch(() => fetchingRef.current.delete(code));
    });
  }, [fields]); // refCache intentionally omitted — fetchingRef prevents duplicate fetches

  function updateField(key: string, patch: Partial<FieldDraft>) {
    setFields(prev => prev.map(f => f._key === key ? { ...f, ...patch } : f));
  }

  function handleTypeChange(key: string, newType: FieldType) {
    updateField(key, {
      field_type: newType,
      options: [],
      ref: ['select', 'multiselect'].includes(newType)
        ? (fields.find(f => f._key === key)?.ref ?? null)
        : null,
    });
  }

  async function handleRefTableSelect(fieldKey: string, tCode: string) {
    if (!tCode) { updateField(fieldKey, { ref: null }); return; }
    updateField(fieldKey, {
      ref: { ref_table_code: tCode, ref_table_id: null, store_field: 'code', display_field: 'label' },
    });

    let detail = refCache[tCode];
    if (!detail) {
      try {
        detail = await toolkitTablesApi.getByCode(tCode);
        setRefCache(prev => ({ ...prev, [tCode]: detail }));
      } catch { return; }
    }

    const allFields = detail.fields;
    const autoDisplay =
      allFields.find(f => f.code === 'label')?.code ??
      allFields.find(f => f.code === 'name')?.code ??
      allFields.find(f => f.field_type === 'text' || f.is_multilingual)?.code ??
      'code';

    updateField(fieldKey, {
      ref: { ref_table_code: tCode, ref_table_id: detail.id, store_field: 'code', display_field: autoDisplay },
    });
  }

  function addOption(fieldKey: string) {
    setFields(prev => prev.map(f =>
      f._key === fieldKey ? { ...f, options: [...f.options, newOption()] } : f,
    ));
  }

  function updateOption(fieldKey: string, optKey: string, patch: Partial<FieldOption>) {
    setFields(prev => prev.map(f =>
      f._key !== fieldKey ? f : {
        ...f, options: f.options.map(o => o._optKey === optKey ? { ...o, ...patch } : o),
      },
    ));
  }

  function removeOption(fieldKey: string, optKey: string) {
    setFields(prev => prev.map(f =>
      f._key !== fieldKey ? f : { ...f, options: f.options.filter(o => o._optKey !== optKey) },
    ));
  }

  function removeField(key: string) {
    const f = fields.find(x => x._key === key);
    const dbField = existing?.fields.find(ef => ef.code === f?.code && !activeDefaultCodes.has(ef.code));
    if (dbField) setDelField(key);
    else setFields(prev => prev.filter(x => x._key !== key));
  }

  const deleteFieldMut = useMutation({
    mutationFn: (id: number) => toolkitFieldsApi.delete(id),
    onSuccess: () => {
      setFields(prev => prev.filter(x => x._key !== delField));
      setDelField(null);
      toast.success('Field deleted');
      qc.invalidateQueries({ queryKey: QK.table(tableCode!) });
    },
    onError: () => toast.error('Delete failed'),
  });

  function refFields(tCode: string) {
    return refCache[tCode]?.fields ?? [];
  }

  return (
    <div className="space-y-5">

      {/* Table meta */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Table</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Schema</label>
            <select
              className="input font-mono"
              value={tableForm.schema_name}
              onChange={e => setTableForm(p => ({ ...p, schema_name: e.target.value }))}
            >
              {schemas.length === 0 && (
                <option value={tableForm.schema_name}>{tableForm.schema_name}</option>
              )}
              {schemas.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Table name <span className="text-red-500">*</span></label>
            <input
              className="input font-mono"
              placeholder="pim_products"
              value={tableForm.code}
              disabled={isEdit}
              onChange={e => setTableForm(p => ({
                ...p,
                code: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
              }))}
            />
            <p className="helper">Auto-converted to lowercase · cannot change after creation</p>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="Short description"
              value={tableForm.description}
              onChange={e => setTableForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Fields card */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Fields</p>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
              {(['user', 'log', 'values'] as const).map((t, i) => (
                <button
                  key={t}
                  onClick={() => setFieldsTab(t)}
                  className={clsx(
                    'px-3 py-1 font-medium transition-colors',
                    i > 0 && 'border-l border-gray-200',
                    fieldsTab === t ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {t === 'user' ? 'User Fields' : t === 'log' ? 'Log Fields' : 'Field Values'}
                  {t === 'values' && (() => {
                    const userCount = fields.filter(f => ['inline_select', 'toggle'].includes(f.field_type) && f.code.trim()).length;
                    const scaffoldCount = [...activeKeyFields, ...activeLogFields].filter(f => f.field_type === 'toggle').length;
                    const total = userCount + scaffoldCount;
                    return total > 0 ? (
                      <span className="ml-1.5 bg-indigo-100 text-indigo-500 text-[9px] px-1 py-0.5 rounded font-mono">
                        {total}
                      </span>
                    ) : null;
                  })()}
                </button>
              ))}
            </div>
          </div>

          {fieldsTab === 'user' && (
            <button
              onClick={() => setFields(p => [...p, newField()])}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <Plus size={13} /> Add field
            </button>
          )}
        </div>

        {fieldsTab !== 'values' && FIELD_COL_HEADERS}

        {/* Field Values tab */}
        {fieldsTab === 'values' && (() => {
          const valueFields = fields.filter(
            f => ['inline_select', 'toggle'].includes(f.field_type) && f.code.trim(),
          );
          const scaffoldToggleFields = [...activeKeyFields, ...activeLogFields].filter(
            f => f.field_type === 'toggle',
          );
          if (valueFields.length === 0 && scaffoldToggleFields.length === 0) {
            return (
              <div className="px-5 py-10 text-center text-sm text-gray-400">
                No <span className="font-medium text-gray-600">Select Inline</span> or{' '}
                <span className="font-medium text-gray-600">Toggle</span> fields yet.
              </div>
            );
          }
          return (
            <div className="divide-y divide-gray-100">
              {/* ── Scaffold toggle fields (from common_fields) ── */}
              {scaffoldToggleFields.map(sf => {
                const ov = defaultOverrides[sf.code];
                const trueVal  = ov?.true_label  ?? sf.true_label  ?? 'ON';
                const falseVal = ov?.false_label ?? sf.false_label ?? 'OFF';
                return (
                  <div key={sf.code} className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-700">{sf.code}</span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded">scaffold</span>
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">toggle</span>
                    </div>
                    <div className="rounded-md border border-amber-100 bg-amber-50/20 overflow-hidden">
                      <div className="grid grid-cols-2 gap-4 px-4 py-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            When ON <span className="text-gray-400 font-normal">(true)</span>
                          </label>
                          <input
                            className="input text-xs h-8 w-full"
                            placeholder={sf.true_label ?? 'e.g. Active'}
                            value={trueVal}
                            onChange={e => onDefaultOverride(sf.code, { true_label: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            When OFF <span className="text-gray-400 font-normal">(false)</span>
                          </label>
                          <input
                            className="input text-xs h-8 w-full"
                            placeholder={sf.false_label ?? 'e.g. Inactive'}
                            value={falseVal}
                            onChange={e => onDefaultOverride(sf.code, { false_label: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {valueFields.map(f => (
                <div key={f._key} className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-700">{f.code}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{f.field_type}</span>
                  </div>

                  {f.field_type === 'inline_select' && (
                    <div className="rounded-md border border-sky-100 bg-sky-50/30 overflow-hidden">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_2fr_80px_28px] gap-2 px-3 py-2 bg-sky-50/60 border-b border-sky-100">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Code</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Label</span>
                          {f.is_multilingual && locales.length > 0 && (
                            <div className="flex gap-0.5">
                              {locales.map(l => (
                                <button
                                  key={l.code}
                                  type="button"
                                  onClick={() => setOptLang(l.code)}
                                  className={clsx(
                                    'px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-colors',
                                    activeLang === l.code
                                      ? 'bg-sky-600 text-white'
                                      : 'bg-sky-100 text-sky-400 hover:bg-sky-200',
                                  )}
                                >
                                  {l.code}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">Default</span>
                        <span />
                      </div>

                      {/* Option rows */}
                      <div className="divide-y divide-sky-50 px-3">
                        {f.options.map(opt => (
                          <div key={opt._optKey} className="grid grid-cols-[1fr_2fr_80px_28px] gap-2 items-center py-2">
                            <input
                              className="input font-mono text-xs h-8"
                              placeholder="active"
                              value={opt.code}
                              onChange={e => updateOption(f._key, opt._optKey, {
                                code: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                              })}
                            />
                            {f.is_multilingual ? (
                              <input
                                className="input text-xs h-8"
                                placeholder={`Label in ${activeLang.toUpperCase()}…`}
                                value={opt.labelI18n[activeLang] ?? ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newI18n = { ...opt.labelI18n, [activeLang]: val };
                                  updateOption(f._key, opt._optKey, {
                                    labelI18n: newI18n,
                                    label: newI18n[defaultLocale] || Object.values(newI18n).find(v => v) || opt.label,
                                  });
                                }}
                              />
                            ) : (
                              <input
                                className="input text-xs h-8"
                                placeholder="Active"
                                value={opt.label}
                                onChange={e => updateOption(f._key, opt._optKey, { label: e.target.value })}
                              />
                            )}
                            <div className="flex justify-center">
                              <input
                                type="radio"
                                name={`default-${f._key}`}
                                checked={f.default_value === opt.code}
                                onChange={() => updateField(f._key, { default_value: opt.code })}
                                className="cursor-pointer text-indigo-600"
                              />
                            </div>
                            <button
                              onClick={() => removeOption(f._key, opt._optKey)}
                              className="text-gray-300 hover:text-red-400 transition-colors flex justify-end"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        {f.options.length === 0 && (
                          <p className="py-3 text-xs text-sky-400 italic">No options yet</p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="px-3 py-2 border-t border-sky-100 bg-sky-50/40 flex items-center justify-between">
                        <button
                          onClick={() => addOption(f._key)}
                          className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium"
                        >
                          <Plus size={11} /> Add option
                        </button>
                        {f.default_value && (
                          <button
                            onClick={() => updateField(f._key, { default_value: '' })}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            Clear default
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {f.field_type === 'toggle' && (
                    <div className="rounded-md border border-amber-100 bg-amber-50/20 overflow-hidden">
                      <div className="grid grid-cols-2 gap-4 px-4 py-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            When ON <span className="text-gray-400 font-normal">(true)</span>
                          </label>
                          <input
                            className="input text-xs h-8 w-full"
                            placeholder="e.g. Active, Yes"
                            value={f.toggleLabels.true_label}
                            onChange={e => updateField(f._key, { toggleLabels: { ...f.toggleLabels, true_label: e.target.value } })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            When OFF <span className="text-gray-400 font-normal">(false)</span>
                          </label>
                          <input
                            className="input text-xs h-8 w-full"
                            placeholder="e.g. Inactive, No"
                            value={f.toggleLabels.false_label}
                            onChange={e => updateField(f._key, { toggleLabels: { ...f.toggleLabels, false_label: e.target.value } })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-amber-100 bg-amber-50/40">
                        <span className="text-xs font-medium text-gray-500">Default</span>
                        {(['true', 'false', ''] as const).map(val => (
                          <label key={val} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                            <input
                              type="radio"
                              name={`toggle-default-${f._key}`}
                              checked={f.default_value === val}
                              onChange={() => updateField(f._key, { default_value: val })}
                              className="text-indigo-600"
                            />
                            {val === '' ? 'None' : val === 'true'
                              ? (f.toggleLabels.true_label  || 'ON')
                              : (f.toggleLabels.false_label || 'OFF')
                            }
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        <div className={clsx('divide-y divide-gray-100', fieldsTab === 'values' && 'hidden')}>
          {fieldsTab === 'log' ? (
            activeLogFields.map(f => (
              <LockedFieldRow
                key={f.code}
                field={f}
                override={defaultOverrides[f.code]}
                onOverride={patch => onDefaultOverride(f.code, patch)}
              />
            ))
          ) : (
            <>
              {activeKeyFields.map(f => (
                <LockedFieldRow
                  key={f.code}
                  field={f}
                  override={defaultOverrides[f.code]}
                  onOverride={patch => onDefaultOverride(f.code, patch)}
                />
              ))}

              {fields.filter(f => !f.is_system && !BACKEND_MANAGED_FIELD_CODES.has(f.code) && !activeDefaultCodes.has(f.code)).map(f => (
                <div key={f._key}>
                  <div className={`grid ${FIELD_COL} gap-3 items-center px-5 py-2.5`}>
                    <input
                      className="input font-mono text-xs h-8"
                      placeholder="field_name"
                      value={f.code}
                      onChange={e => updateField(f._key, {
                        code: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                      })}
                    />
                    <FieldTypeSelect value={f.field_type} onChange={v => handleTypeChange(f._key, v)} />
                    <input
                      className="input text-xs h-8"
                      placeholder="Label"
                      value={f.label}
                      onChange={e => updateField(f._key, { label: e.target.value })}
                    />
                    <input
                      className="input text-xs h-8"
                      placeholder="What this stores"
                      value={f.description}
                      onChange={e => updateField(f._key, { description: e.target.value })}
                    />

                    {/* Default value — adaptive by field type */}
                    {NO_DEFAULT_TYPES.has(f.field_type) ? (
                      <span className="text-gray-300 text-xs text-center select-none">—</span>
                    ) : f.field_type === 'toggle' ? (
                      <select
                        className="input text-xs h-8"
                        value={f.default_value}
                        onChange={e => updateField(f._key, { default_value: e.target.value })}
                      >
                        <option value="">(none)</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        className="input text-xs h-8"
                        placeholder="e.g. 0 or empty"
                        value={f.default_value}
                        onChange={e => updateField(f._key, { default_value: e.target.value })}
                      />
                    )}

                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        checked={f.is_required}
                        onChange={e => updateField(f._key, { is_required: e.target.checked })}
                      />
                    </div>
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                        checked={f.is_unique}
                        onChange={e => updateField(f._key, { is_unique: e.target.checked })}
                      />
                    </div>
                    <div className="flex justify-center">
                      {MULTILINGUAL_ELIGIBLE.has(f.field_type) ? (
                        <input
                          type="checkbox"
                          title="Mark as multilingual — field value is stored per language"
                          className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                          checked={f.is_multilingual}
                          onChange={e => {
                            const checked = e.target.checked;
                            if (checked && f.field_type === 'inline_select') {
                              setFields(prev => prev.map(fld =>
                                fld._key !== f._key ? fld : {
                                  ...fld,
                                  is_multilingual: true,
                                  options: fld.options.map(o => ({
                                    ...o,
                                    labelI18n: o.label && !o.labelI18n[defaultLocale]
                                      ? { ...o.labelI18n, [defaultLocale]: o.label }
                                      : o.labelI18n,
                                  })),
                                }
                              ));
                            } else {
                              updateField(f._key, { is_multilingual: checked });
                            }
                          }}
                        />
                      ) : (
                        <span className="text-gray-200 text-xs select-none">—</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeField(f._key)}
                      className="p-1 text-gray-300 hover:text-red-400 transition-colors flex justify-end"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Reference table config (select / multiselect) */}
                  {(f.field_type === 'select' || f.field_type === 'multiselect') && (
                    <div className="mx-5 mb-3 rounded-md border border-violet-100 bg-violet-50/30 overflow-hidden">
                      <div className="px-3 py-2 border-b border-violet-100 bg-violet-50/50">
                        <span className="text-xs font-semibold text-violet-700">Reference table</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 px-3 py-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">Table</label>
                          <select
                            className="input text-xs h-8"
                            value={f.ref?.ref_table_code ?? ''}
                            onChange={e => handleRefTableSelect(f._key, e.target.value)}
                          >
                            <option value="">— pick a table —</option>
                            {allTables.map(t => (
                              <option key={t.code} value={t.code}>{t.schema_name}.{t.code}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Store field <span className="text-gray-400 font-normal">— value saved in DB</span>
                          </label>
                          <select
                            className="input text-xs h-8"
                            value={f.ref?.store_field ?? 'code'}
                            disabled={!f.ref?.ref_table_code}
                            onChange={e => updateField(f._key, { ref: { ...f.ref!, store_field: e.target.value } })}
                          >
                            {!f.ref?.ref_table_code
                              ? <option value="code">code</option>
                              : refFields(f.ref.ref_table_code).map(rf => (
                                  <option key={rf.code} value={rf.code}>{rf.code}</option>
                                ))
                            }
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            Display field <span className="text-gray-400 font-normal">— shown in dropdowns</span>
                          </label>
                          <select
                            className="input text-xs h-8"
                            value={f.ref?.display_field ?? 'label'}
                            disabled={!f.ref?.ref_table_code}
                            onChange={e => updateField(f._key, { ref: { ...f.ref!, display_field: e.target.value } })}
                          >
                            {!f.ref?.ref_table_code
                              ? <option value="label">label</option>
                              : refFields(f.ref.ref_table_code).map(rf => (
                                  <option key={rf.code} value={rf.code}>{rf.code}</option>
                                ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Computed field SQL expression */}
                  {f.field_type === 'computed' && (
                    <div className="mx-5 mb-3 rounded-md border border-emerald-100 bg-emerald-50/30 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100 bg-emerald-50/50">
                        <span className="text-xs font-semibold text-emerald-700">SQL Expression</span>
                        <span className="text-[10px] text-emerald-500 italic">
                          references t.column_name — computed in view, no physical column
                        </span>
                      </div>
                      <div className="px-3 py-3">
                        <textarea
                          className="input text-xs font-mono min-h-[64px] resize-y w-full"
                          placeholder="e.g. t.first_name || ' ' || t.last_name"
                          value={f.expression}
                          onChange={e => updateField(f._key, { expression: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {fields.filter(f => !f.is_system && !BACKEND_MANAGED_FIELD_CODES.has(f.code) && !activeDefaultCodes.has(f.code)).length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No fields yet — click Add field to start
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!delField}
        title="Delete field"
        message="This will run ALTER TABLE DROP COLUMN and cannot be undone. Continue?"
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          const f = fields.find(x => x._key === delField);
          const dbField = existing?.fields.find(ef => ef.code === f?.code);
          if (dbField) deleteFieldMut.mutate(dbField.id);
        }}
        onCancel={() => setDelField(null)}
      />
    </div>
  );
}
