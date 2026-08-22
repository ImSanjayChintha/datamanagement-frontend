import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, ChevronRight, MapPin, Layers,
  AlertCircle, X, Type, FileText, Tag, CheckCircle, Plus,
  Sparkles, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import Spinner from '@/components/ui/Spinner';
import DynamicFieldInput from '@/components/ui/DynamicFieldInput';
import { makeEntityApi } from '@/modules/pim/api';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { QK } from '@/lib/queryKeys';
import componentTypeDefs from '@/modules/page-manager/page-defs/component-types.json';
import CategoryPicker, { catLabel } from './CategoryPicker';
import type { CategoryNode } from './CategoryPicker';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';

// ── API instances ─────────────────────────────────────────────────────────────

const productsApi = makeEntityApi('products', 'products');
const familiesApi = makeEntityApi('families', 'families');
const groupsApi = makeEntityApi('attribute_groups', 'attribute_groups');
const attrsApi = makeEntityApi('attributes', 'attributes');
const famAttrsApi = makeEntityApi('family_attributes', 'family_attributes');

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TableDef {
  has_label: boolean;
  fields: ToolkitField[];
  options: ToolkitFieldOption[];
}

// Maps component_type → DynamicFieldInput field_type (same as PimFormPage)
const COMPONENT_TYPE_FIELD: Record<string, string> = Object.fromEntries(
  componentTypeDefs.map(ct => [ct.value, ct.field_type]),
);

// Fields managed by the custom Classification / Attribute / Tags sections —
// excluded from the dynamic Identity grid.
const RESERVED = new Set([
  'id', 'is_active', 'family_code', 'categories', 'values', 'tags',
  'inserted_at', 'modified_at', 'inserted_by', 'modified_by',
  'created_at', 'updated_at',
]);

const FULL_WIDTH_TYPES = new Set(['textarea', 'richtext', 'jsonb', 'json']);

const LANGS = ['en', 'fr', 'de', 'es', 'it'] as const;

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls = clsx(
  'w-full h-9 px-3 text-sm rounded-lg border',
  'border-gray-200 dark:border-gray-700',
  'bg-white dark:bg-gray-800',
  'text-gray-800 dark:text-gray-100 placeholder-gray-400',
  'outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500',
  'transition-colors',
);

const textareaCls = clsx(
  'w-full px-3 py-2 text-sm rounded-lg border resize-none',
  'border-gray-200 dark:border-gray-700',
  'bg-white dark:bg-gray-800',
  'text-gray-800 dark:text-gray-100 placeholder-gray-400',
  'outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500',
  'transition-colors',
);

const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5';

const tblInputCls = 'input';
const tblTextareaCls = 'input resize-none';

// ── Auto-tag computation ──────────────────────────────────────────────────────

function computeAutoTags(params: {
  code: string;
  name: string;
  familyCode: string;
  families: Row[];
  categoryPath: CategoryNode[] | null;
}): string[] {
  const { code, name, familyCode, families, categoryPath } = params;
  const set = new Set<string>();

  const c = code.trim();
  if (c) set.add(c);

  const n = name.trim();
  if (n) set.add(n);

  if (familyCode) {
    const familyRow = families.find(f => f.code === familyCode);
    if (familyRow) {
      const fn = familyRow.name;
      if (typeof fn === 'string') {
        const v = fn.trim();
        if (v) set.add(v);
      } else if (fn && typeof fn === 'object' && !Array.isArray(fn)) {
        for (const lang of LANGS) {
          const v = (fn as Record<string, string>)[lang]?.trim();
          if (v) set.add(v);
        }
      }
    }
  }

  if (categoryPath) {
    for (const node of categoryPath) {
      const n = node.name;
      if (typeof n === 'string') {
        const v = n.trim();
        if (v) set.add(v);
      } else if (n && typeof n === 'object' && !Array.isArray(n)) {
        for (const lang of LANGS) {
          const v = (n as Record<string, string>)[lang]?.trim();
          if (v) set.add(v);
        }
      }
    }
  }

  return [...set];
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2.5">
      <span className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600',
      )}>
        <span className={clsx(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
          value ? 'translate-x-4' : 'translate-x-0',
        )} />
      </span>
      {label && (
        <span className={clsx(
          'text-sm transition-colors',
          value ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-400 dark:text-gray-500',
        )}>
          {label}
        </span>
      )}
    </button>
  );
}

// ── AttrValueField ────────────────────────────────────────────────────────────
// Renders inline in the attribute pivot table — uses compact tbl* styles.

function AttrValueField({ attr, value, onChange }: {
  attr: Row;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const type = (attr.attr_type as string) ?? 'text';
  const options = (attr.options as { code: string; label: unknown }[] | null) ?? [];

  if (type === 'boolean' || type === 'toggle') {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <Toggle value={!!value} onChange={onChange} />
        <span className={clsx(
          'text-xs transition-colors',
          !!value ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-400',
        )}>
          {!!value ? 'Yes' : 'No'}
        </span>
      </div>
    );
  }

  if (type === 'integer' || type === 'number' || type === 'decimal') {
    return (
      <input type="number"
        value={value === undefined || value === null ? '' : String(value)}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={tblInputCls}
        step={type === 'decimal' ? '0.01' : '1'} />
    );
  }

  if (type === 'textarea' || type === 'richtext') {
    return <textarea rows={2} value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={tblTextareaCls} />;
  }

  if (type === 'date') {
    return <input type="date" value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={tblInputCls} />;
  }

  if (type === 'url') {
    return <input type="url" value={String(value ?? '')} placeholder="https://" onChange={e => onChange(e.target.value)} className={tblInputCls} />;
  }

  if (type === 'select') {
    return (
      <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={tblInputCls}>
        <option value="">—</option>
        {options.map(o => <option key={o.code} value={o.code}>{catLabel(o.label)}</option>)}
      </select>
    );
  }

  if (type === 'multiselect') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (code: string) =>
      onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
    return (
      <div className="flex flex-wrap gap-1 py-0.5">
        {options.map(o => {
          const on = selected.includes(o.code);
          return (
            <button key={o.code} type="button" onClick={() => toggle(o.code)}
              className={clsx(
                'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                on
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600',
              )}>
              {catLabel(o.label)}
            </button>
          );
        })}
        {options.length === 0 && <span className="text-xs text-gray-400 italic">No options defined</span>}
      </div>
    );
  }

  return <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={tblInputCls} />;
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ icon: Icon, title, subtitle, children, accent }: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: 'default' | 'amber';
}) {
  const isAmber = accent === 'amber';
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className={clsx(
        'flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800',
        isAmber ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'bg-gray-50/60 dark:bg-gray-800/40',
      )}>
        <div className={clsx(
          'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
          isAmber
            ? 'bg-amber-100 dark:bg-amber-900/30'
            : 'bg-indigo-50 dark:bg-indigo-900/30',
        )}>
          <Icon size={12} className={isAmber
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-indigo-600 dark:text-indigo-400'} />
        </div>
        <div>
          <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
          {subtitle && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  // ── Form state ──

  // Dynamic fields from page_definition (code, name, sort_order, status, hs_code, etc.)
  const [formValues, setFormValues] = useState<Row>({});
  // Custom-section state (Classification, Attribute Values, Tags, header toggle)
  const [isActive, setIsActive] = useState(true);
  const [familyCode, setFamilyCode] = useState('');
  const [categoryPath, setCategoryPath] = useState<CategoryNode[] | null>(null);
  const [attrValues, setAttrValues] = useState<Record<string, unknown>>({});
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPicker, setShowPicker] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Derived for breadcrumb, auto-tags, and validation
  const code = String(formValues.code ?? '');
  const name = String(formValues.name ?? '');

  // ── Page definition + table meta ──

  const { data: pageDef } = useQuery({
    queryKey: QK.pageDef('products'),
    queryFn: () => pageDefsApi.get('products'),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: tableDef } = useQuery<TableDef>({
    queryKey: QK.table('products'),
    queryFn: () => productsApi.meta() as Promise<TableDef>,
    staleTime: 5 * 60_000,
  });

  // ── Reference data ──

  const { data: familyRes } = useQuery({
    queryKey: ['pim-families-all'],
    queryFn: () => familiesApi.list({ limit: 200, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });

  const { data: groupRes } = useQuery({
    queryKey: ['pim-attr-groups-all'],
    queryFn: () => groupsApi.list({ limit: 200, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });

  const { data: attrRes } = useQuery({
    queryKey: ['pim-attrs-all'],
    queryFn: () => attrsApi.list({ limit: 2000, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });

  const { data: famAttrRes, isLoading: loadingFamAttrs } = useQuery({
    queryKey: ['pim-family-attrs', familyCode],
    queryFn: () => famAttrsApi.list({
      filters: { family_code: familyCode, is_active: true },
      limit: 500,
      sort: [{ field: 'sort_order', direction: 'asc' }],
    }),
    enabled: !!familyCode,
    staleTime: 5 * 60_000,
  });

  // ── Existing product ──

  const { data: existing, isLoading: loadingProduct } = useQuery({
    queryKey: ['pim-product', id],
    queryFn: () => productsApi.get(id!),
    enabled: isEdit,
    staleTime: 0,
  });

  // ── Derived data ──

  const families = useMemo(() => (familyRes?.rows ?? []) as Row[], [familyRes]);
  const allGroups = useMemo(() => (groupRes?.rows ?? []) as Row[], [groupRes]);
  const allAttrs = useMemo(() => (attrRes?.rows ?? []) as Row[], [attrRes]);
  const famAttrs = useMemo(() => (famAttrRes?.rows ?? []) as Row[], [famAttrRes]);

  const attrMap = useMemo(() => new Map(allAttrs.map(a => [a.code as string, a])), [allAttrs]);
  const groupMap = useMemo(() => new Map(allGroups.map(g => [g.code as string, g])), [allGroups]);

  // ── Page-def driven field list (excludes reserved custom-section fields) ──

  const cfgMap = useMemo(
    () => new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c])),
    [pageDef],
  );

  const displayFields = useMemo((): ToolkitField[] => {
    const base = (tableDef?.fields ?? []).filter(f => !RESERVED.has(f.code));

    const cfgFields = pageDef?.form_config?.fields ?? [];

    const applyOverrides = (f: ToolkitField): ToolkitField => {
      const cfg = cfgMap.get(f.code);
      const componentFt = cfg?.component_type
        ? (COMPONENT_TYPE_FIELD[cfg.component_type] ?? cfg.component_type)
        : null;
      return {
        ...f,
        ...(cfg?.ref_endpoint ? { config: { ...f.config, gateway_endpoint: cfg.ref_endpoint } } : {}),
        ...(cfg?.multilingual ? { is_multilingual: true } : {}),
        ...(cfg?.required != null ? { is_required: cfg.required } : {}),
        ...(componentFt ? { field_type: componentFt as ToolkitField['field_type'] } : {}),
      };
    };

    if (cfgFields.length > 0) {
      return base
        .filter(f => cfgMap.get(f.code)?.visible !== false)
        .sort((a, b) => (cfgMap.get(a.code)?.order ?? 9999) - (cfgMap.get(b.code)?.order ?? 9999))
        .map(applyOverrides);
    }
    return base.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map(applyOverrides);
  }, [tableDef, pageDef, cfgMap]);

  // ── Auto-computed tags ───────────────────────────────────────────────────────

  const autoTags = useMemo(
    () => computeAutoTags({ code, name, familyCode, families, categoryPath }),
    [code, name, familyCode, families, categoryPath],
  );

  const allTags = useMemo(
    () => [...new Set([...autoTags, ...manualTags])],
    [autoTags, manualTags],
  );

  // ── Load existing product ──

  useEffect(() => {
    if (!existing || !isEdit || !tableDef || families.length === 0) return;

    // Custom-section fields
    setIsActive(!!(existing.is_active ?? true));
    setFamilyCode(String(existing.family_code ?? ''));
    setCategoryPath(Array.isArray(existing.categories) ? existing.categories as CategoryNode[] : null);
    setAttrValues((() => {
      const v = existing.values;
      return typeof v === 'object' && v && !Array.isArray(v) ? v as Record<string, unknown> : {};
    })());

    // Dynamic identity fields — load only fields that are in tableDef and not reserved
    const init: Row = {};
    for (const f of tableDef.fields) {
      if (RESERVED.has(f.code)) continue;
      const cfg = cfgMap.get(f.code);
      const dataKey = (cfg as { bindkey?: string } | undefined)?.bindkey ?? f.code;
      if ((cfg as { component_type?: string } | undefined)?.component_type === 'select_multi') {
        const val = existing[dataKey];
        init[f.code] = typeof val === 'string'
          ? val.split(',').filter(Boolean)
          : Array.isArray(val) ? val : [];
      } else {
        init[f.code] = existing[dataKey] ?? '';
      }
    }
    setFormValues(init);

    // Separate stored tags into auto vs manual
    const loadedCode = String(existing.code ?? '');
    const loadedName = String(existing.name ?? '');
    const loadedFamilyCode = String(existing.family_code ?? '');
    const loadedCategory = Array.isArray(existing.categories) ? existing.categories as CategoryNode[] : null;
    const rawTags = existing.tags;
    const storedTags: string[] = Array.isArray(rawTags)
      ? rawTags.map(String)
      : typeof rawTags === 'string' && rawTags.trim()
        ? (() => {
          try {
            const parsed = JSON.parse(rawTags);
            return Array.isArray(parsed) ? parsed.map(String) : [rawTags];
          } catch {
            return [rawTags];
          }
        })()
        : [];
    const computedAutoSet = new Set(computeAutoTags({
      code: loadedCode, name: loadedName,
      familyCode: loadedFamilyCode, families,
      categoryPath: loadedCategory,
    }));
    setManualTags(storedTags.filter(t => !computedAutoSet.has(t)));
  }, [existing, isEdit, families, tableDef, cfgMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Attribute grouping ──

  const groupedAttrs = useMemo(() => {
    const map = new Map<string, { famAttr: Row; attr: Row }[]>();
    for (const fa of famAttrs) {
      const attr = attrMap.get(fa.attribute_code as string);
      if (!attr) continue;
      const gc = (attr.group_code as string) ?? '__ungrouped__';
      if (!map.has(gc)) map.set(gc, []);
      map.get(gc)!.push({ famAttr: fa, attr });
    }
    return map;
  }, [famAttrs, attrMap]);

  const orderedGroups = useMemo(
    () => [...groupedAttrs.keys()].sort((a, b) =>
      ((groupMap.get(a)?.sort_order as number) ?? 999) -
      ((groupMap.get(b)?.sort_order as number) ?? 999),
    ),
    [groupedAttrs, groupMap],
  );

  const requiredAttrCodes = useMemo(
    () => new Set(famAttrs.filter(fa => fa.is_required).map(fa => fa.attribute_code as string)),
    [famAttrs],
  );

  const filledCount = useMemo(
    () => famAttrs.filter(fa => {
      const v = attrValues[fa.attribute_code as string];
      return v !== undefined && v !== null && v !== ''
        && !(Array.isArray(v) && v.length === 0);
    }).length,
    [famAttrs, attrValues],
  );

  // ── Tag helpers ──

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (!allTags.includes(tag)) {
      setManualTags(prev => [...new Set([...prev, tag])]);
    }
    setTagInput('');
  }

  function removeManualTag(tag: string) {
    setManualTags(prev => prev.filter(t => t !== tag));
  }

  // ── Save ──

  const saveMut = useMutation({
    mutationFn: () => {
      // Empty strings sent from date/number inputs are rejected by PostgreSQL's
      // jsonb_to_recordset coercion ("" is not a valid date/integer/etc.).
      // Convert empty strings to null for any field that is not a plain text type.
      const TEXT_LIKE = new Set([
        'text', 'textarea', 'richtext', 'url', 'email', 'code',
        'i18n_text', 'i18n_richtext', 'select',
      ]);
      const fields = tableDef?.fields ?? [];
      const cleanedValues: Row = Object.fromEntries(
        Object.entries(formValues).map(([k, v]) => {
          if (v !== '') return [k, v];
          const ft = fields.find(f => f.code === k)?.field_type ?? 'text';
          return [k, TEXT_LIKE.has(ft) ? v : null];
        }),
      );

      const payload: Row = {
        ...cleanedValues,
        is_active: isActive,
        family_code: familyCode || null,
        categories: categoryPath,
        values: attrValues,
        tags: allTags,
      };
      if (isEdit && id) payload.id = id;
      return productsApi.upsert(payload);
    },
    onSuccess: (result) => {
      const res = (result as Row) ?? {};
      const newId = res.id ?? (res.data as Row)?.id;
      toast.success(isEdit ? 'Saved successfully' : 'Product created');
      qc.invalidateQueries({ queryKey: ['pim-products'] });
      if (isEdit) {
        qc.invalidateQueries({ queryKey: ['pim-product', id] });
        navigate('/pim/products');
      } else {
        navigate(newId ? `/pim/products/${newId}/edit` : '/pim/products');
      }
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  function handleSave() {
    const errs: Record<string, string> = {};
    for (const f of displayFields) {
      if (!f.is_required) continue;
      const cfg = cfgMap.get(f.code);
      const modeDisabled = isEdit
        ? (cfg as { edit_mode?: string } | undefined)?.edit_mode === 'disabled'
        : (cfg as { add_mode?: string } | undefined)?.add_mode === 'disabled';
      if (modeDisabled) continue;
      const val = formValues[f.code];
      const isEmpty = val === undefined || val === null || val === ''
        || (Array.isArray(val) && val.length === 0);
      if (!isEmpty) continue;
      errs[f.code] = `${f.label} is required`;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    saveMut.mutate();
  }


  if (isEdit && loadingProduct) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  const hasErrors = Object.keys(errors).length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* ── Sticky header ── */}
      <header className="shrink-0 flex items-center gap-4 px-6 py-3
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('/pim/products')}
          className="p-1.5 -ml-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-gray-500 min-w-0">
          <span className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer shrink-0"
            onClick={() => navigate('/pim/products')}>
            Products
          </span>
          <ChevronRight size={11} className="shrink-0" />
          <span className="text-gray-700 dark:text-gray-200 font-medium truncate">
            {isEdit ? (name || code || 'Edit') : 'New Product'}
          </span>
        </div>

        <div className="flex-1" />

        {hasErrors && (
          <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400
                          bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg shrink-0">
            <AlertCircle size={12} />
            Fix required fields
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsActive(v => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0',
            isActive
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
          )}
        >
          <CheckCircle size={12} />
          {isActive ? 'Active' : 'Inactive'}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-semibold
                     bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white
                     disabled:opacity-50 transition-colors shadow-sm shrink-0"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={13} />}
          {isEdit ? 'Save changes' : 'Create product'}
        </button>
      </header>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-5">

          {/* ── Row 1: Identity + Classification ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

            {/* Identity — fields driven by page_definition (3/5) */}
            <div className="xl:col-span-3">
              <Card icon={Type} title="Identity" subtitle="Basic product information">
                {!tableDef ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                    <Spinner size="sm" /> Loading fields…
                  </div>
                ) : displayFields.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-2">
                    No fields configured — set up the products form in Page Manager.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {displayFields.map(f => {
                      const cfg = cfgMap.get(f.code);
                      const fullWidth = f.is_multilingual || FULL_WIDTH_TYPES.has(f.field_type);
                      const modeDisabled = isEdit
                        ? (cfg as { edit_mode?: string } | undefined)?.edit_mode === 'disabled'
                        : (cfg as { add_mode?: string } | undefined)?.add_mode === 'disabled';
                      return (
                        <div
                          key={f.id ?? f.code}
                          className={clsx(
                            fullWidth && 'col-span-full',
                            modeDisabled && 'opacity-60',
                          )}
                        >
                          {!f.is_multilingual && (
                            <label className={labelCls}>
                              {f.label}
                              {f.is_required && !modeDisabled && <span className="text-red-500 ml-0.5">*</span>}
                              {modeDisabled && (
                                <span className="ml-1.5 text-[10px] font-normal text-gray-400">(read-only)</span>
                              )}
                            </label>
                          )}
                          <fieldset disabled={modeDisabled} className="border-0 p-0 m-0 min-w-0">
                            <DynamicFieldInput
                              field={f}
                              value={formValues[f.code]}
                              onChange={v => {
                                setFormValues(prev => ({ ...prev, [f.code]: v }));
                                setErrors(prev => { const n = { ...prev }; delete n[f.code]; return n; });
                              }}
                              fieldOptions={f.field_type === 'inline_select'
                                ? (tableDef.options ?? []).filter(o => o.field_id === f.id)
                                : undefined}
                            />
                          </fieldset>
                          {errors[f.code] && (
                            <p className="text-xs text-red-500 mt-1">{errors[f.code]}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Classification (2/5) */}
            <div className="xl:col-span-2">
              <Card icon={Tag} title="Classification" subtitle="Family and category assignment">
                <div className="space-y-5">

                  <div>
                    <label className={labelCls}>Family</label>
                    <select value={familyCode} onChange={e => setFamilyCode(e.target.value)} className={inputCls}>
                      <option value="">— No family —</option>
                      {families.map(f => (
                        <option key={f.code as string} value={f.code as string}>{catLabel(f.name)}</option>
                      ))}
                    </select>
                    {familyCode && (
                      <p className="text-[11px] text-indigo-500 dark:text-indigo-400 mt-1.5">
                        {loadingFamAttrs ? 'Loading attributes…'
                          : famAttrs.length > 0
                            ? `${famAttrs.length} attribute${famAttrs.length !== 1 ? 's' : ''} in this family`
                            : 'No attributes assigned yet'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className={labelCls}>Category</label>
                    <button
                      type="button"
                      onClick={() => setShowPicker(true)}
                      className={clsx(
                        'w-full min-h-[36px] px-3 py-2 text-sm rounded-lg border text-left transition-colors flex items-start gap-2',
                        categoryPath
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-900/10 hover:border-indigo-400'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400',
                      )}
                    >
                      <MapPin size={13} className={clsx(
                        'shrink-0 mt-0.5',
                        categoryPath ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600',
                      )} />
                      {categoryPath ? (
                        <span className="flex-1 min-w-0">
                          {categoryPath.map((n, i) => (
                            <span key={n.code}>
                              {i > 0 && <ChevronRight size={9} className="inline text-indigo-300 mx-0.5" />}
                              <span className={clsx(
                                'text-xs',
                                i === categoryPath.length - 1
                                  ? 'font-semibold text-indigo-700 dark:text-indigo-300'
                                  : 'text-indigo-400 dark:text-indigo-500',
                              )}>
                                {catLabel(n.name)}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">Select from hierarchy…</span>
                      )}
                    </button>
                    {categoryPath && (
                      <button type="button" onClick={() => setCategoryPath(null)}
                        className="mt-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                        <X size={10} /> Clear category
                      </button>
                    )}
                  </div>

                </div>
              </Card>
            </div>

          </div>

          {/* ── Row 2: Search Tags ── */}
          <Card
            icon={Sparkles}
            accent="amber"
            title="Search Tags"
            subtitle={`${allTags.length} tag${allTags.length !== 1 ? 's' : ''} — auto-generated from code, name, family and category in all languages`}
          >
            <div className="space-y-4">

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={11} className="text-amber-500 shrink-0" />
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Auto-generated
                  </p>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 normal-case">
                    — updates live as you fill the form
                  </span>
                </div>

                {autoTags.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    Fill in code, name, family or category to auto-generate tags
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {autoTags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium
                                   bg-amber-50 dark:bg-amber-900/20
                                   text-amber-700 dark:text-amber-300
                                   border border-amber-200 dark:border-amber-800"
                      >
                        <Zap size={9} className="text-amber-400 shrink-0" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300 dark:text-gray-600">
                  Custom tags
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {manualTags.filter(t => !autoTags.includes(t)).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium
                                 bg-indigo-50 dark:bg-indigo-900/20
                                 text-indigo-700 dark:text-indigo-300
                                 border border-indigo-200 dark:border-indigo-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeManualTag(tag)}
                        className="ml-0.5 rounded-full hover:text-red-500 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {manualTags.filter(t => !autoTags.includes(t)).length === 0 && (
                    <p className="text-xs text-gray-400 italic">No custom tags yet — add below</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Type a tag and press Enter…"
                    className={clsx(inputCls, 'flex-1')}
                  />
                  <button
                    type="button"
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium
                               border border-indigo-200 dark:border-indigo-700
                               text-indigo-600 dark:text-indigo-400
                               hover:bg-indigo-50 dark:hover:bg-indigo-900/20
                               disabled:opacity-40 disabled:cursor-not-allowed
                               transition-colors"
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                  Press <kbd className="px-1 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 font-mono">Enter</kbd> or <kbd className="px-1 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-700 font-mono">,</kbd> to add
                </p>
              </div>

            </div>
          </Card>

          {/* ── Row 3: Attribute Values ── */}
          {familyCode ? (
            <Card
              icon={FileText}
              title="Attribute Values"
              subtitle={famAttrs.length > 0
                ? `${filledCount} of ${famAttrs.length} filled`
                : 'Assign attributes to this family in Family Attributes'}
            >
              {loadingFamAttrs ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                  <Spinner size="sm" /> Loading attributes…
                </div>
              ) : orderedGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <Layers size={28} className="mb-2 opacity-20" />
                  <p className="text-sm">No attributes assigned to this family yet</p>
                  <p className="text-xs mt-1">Go to Family Attributes to add attribute groups</p>
                </div>
              ) : (
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col />
                  </colgroup>
                  <tbody>
                    {orderedGroups.map((gc, idx) => {
                      const group = groupMap.get(gc);
                      const items = groupedAttrs.get(gc) ?? [];
                      const groupLbl = gc === '__ungrouped__' ? 'Other' : (catLabel(group?.name) || gc);
                      const filled = items.filter(({ attr }) => {
                        const v = attrValues[attr.code as string];
                        return v !== undefined && v !== null && v !== ''
                          && !(Array.isArray(v) && v.length === 0);
                      }).length;

                      return (
                        <Fragment key={gc}>
                          {/* ── Group section header ── */}
                          <tr>
                            <td colSpan={2} className={clsx(
                              'pb-1 px-0',
                              idx === 0 ? 'pt-0' : 'pt-3',
                            )}>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-[0.1em]
                                                 text-gray-400 dark:text-gray-500 shrink-0 select-none">
                                  {groupLbl}
                                </span>
                                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                                <span className={clsx(
                                  'text-[9px] font-mono tabular-nums shrink-0',
                                  filled === items.length && items.length > 0
                                    ? 'text-emerald-500'
                                    : 'text-gray-400 dark:text-gray-600',
                                )}>
                                  {filled}/{items.length}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* ── Attribute rows ── */}
                          {items.map(({ attr }) => {
                            const attrCode = attr.code as string;
                            const isReq = requiredAttrCodes.has(attrCode);
                            const val = attrValues[attrCode];
                            const isFilled = val !== undefined && val !== null && val !== ''
                              && !(Array.isArray(val) && val.length === 0);

                            return (
                              <tr key={attrCode}
                                className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                {/* Name cell */}
                                <td className="py-1.5 pr-4 align-top">
                                  <div className="flex items-start gap-1.5 pt-1">
                                    <span className={clsx(
                                      'w-1 h-1 rounded-full mt-[5px] shrink-0 transition-colors duration-300',
                                      isFilled
                                        ? 'bg-emerald-400'
                                        : 'bg-gray-200 dark:bg-gray-700',
                                    )} />
                                    <div>
                                      <span className={clsx(
                                        'text-[11px] leading-snug font-semibold transition-colors',
                                        isFilled
                                          ? 'text-gray-800 dark:text-gray-100'
                                          : 'text-gray-600 dark:text-gray-300',
                                      )}>
                                        {catLabel(attr.name)}
                                        {isReq && <span className="text-red-400 ml-0.5">*</span>}
                                      </span>
                                      <div className="font-mono text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 leading-none">
                                        {attrCode}{attr.unit_code ? ` (${attr.unit_code})` : ''}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                {/* Value cell */}
                                <td className="py-1.5 align-top">
                                  <AttrValueField
                                    attr={attr}
                                    value={attrValues[attrCode]}
                                    onChange={v => setAttrValues(p => ({ ...p, [attrCode]: v }))}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center py-12
                            bg-white dark:bg-gray-900 rounded-xl
                            border border-dashed border-gray-200 dark:border-gray-800
                            text-gray-300 dark:text-gray-700">
              <FileText size={28} className="mb-2" />
              <p className="text-sm text-gray-400">Select a family to show its attribute fields</p>
            </div>
          )}

          <div className="h-4" />
        </div>
      </div>

      {/* Category picker modal */}
      {showPicker && (
        <CategoryPicker
          currentPath={categoryPath}
          onSelect={path => { setCategoryPath(path); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
