import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, Plus, FolderPlus, Save } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import DynamicFieldInput from '@/components/ui/DynamicFieldInput';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import { makeEntityApi, pimCategoriesApi } from '@/modules/pim/api';
import componentTypeDefs from '@/modules/page-manager/page-defs/component-types.json';
import { QK } from '@/lib/queryKeys';
import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import type { PimFormApi } from '@/modules/pim/components/PimFormPage';

// Maps component_type value → DynamicFieldInput field_type
const COMPONENT_TYPE_FIELD: Record<string, string> = Object.fromEntries(
  componentTypeDefs.map(ct => [ct.value, ct.field_type]),
);

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_DEF_CODE    = 'categories';
const ROW_H            = 34;
const OVERSCAN         = 6;
const AUDIT_TYPES      = new Set(['uuid', 'id', 'datetime', 'date', 'time', 'daterange']);
const FULL_WIDTH_TYPES = new Set(['textarea', 'richtext', 'jsonb', 'json']);

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface TreeNode {
  id:             number;
  code:           string;
  raw:            Row;
  name:           string;
  isExpanded:     boolean;
  isLoading:      boolean;
  hasChildren:    boolean;
  childrenLoaded: boolean;
  children:       TreeNode[];
}

type FlatNode = TreeNode & { depth: number };

type FormMode =
  | { type: 'idle' }
  | { type: 'new';  defaultValues: Row }
  | { type: 'edit'; id: number; row: Row };

interface TableDef {
  has_label: boolean;
  fields:    ToolkitField[];
  options:   ToolkitFieldOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveName(row: Row): string {
  for (const key of ['name', 'label', 'title', 'code']) {
    const v = row[key];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      const en = o.en ?? o.EN;
      if (en) return String(en);
      const first = Object.values(o).find(x => x);
      if (first) return String(first);
    }
  }
  return `#${row.id}`;
}

function toTreeNode(row: Row, hasChildren = false): TreeNode {
  return {
    id:             row.id as number,
    code:           String(row.code ?? row.id),
    raw:            row,
    name:           resolveName(row),
    isExpanded:     false,
    isLoading:      false,
    hasChildren,
    childrenLoaded: false,
    children:       [],
  };
}

function updateNodeDeep(
  nodes: TreeNode[],
  id: number,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map(n => {
    if (n.id === id) return updater(n);
    if (n.children.length) return { ...n, children: updateNodeDeep(n.children, id, updater) };
    return n;
  });
}

function flattenTree(nodes: TreeNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.isExpanded) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}

// ── Tree fetch helper (uses page-def api) ─────────────────────────────────────

async function fetchLevel(
  api: ReturnType<typeof makeEntityApi>,
  parentCode: string | null,
): Promise<TreeNode[]> {
  const res = await api.list({ filters: { parent_code: parentCode }, limit: 200 });
  if (res.rows.length === 0) return [];

  const nodes = res.rows.map(r => toTreeNode(r, false));
  const codes = nodes.map(n => n.code);

  try {
    const childCheck = await api.list({
      filters: { parent_code: { op: 'in', value: codes } },
      limit:   500,
    });
    const withChildren = new Set(childCheck.rows.map(r => String(r.parent_code)));
    return nodes.map(n => ({ ...n, hasChildren: withChildren.has(n.code) }));
  } catch {
    return nodes.map(n => ({ ...n, hasChildren: true }));
  }
}

// ── TreeRow ───────────────────────────────────────────────────────────────────

function TreeRow({
  node, selected, onToggle, onSelect,
}: {
  node:     FlatNode;
  selected: boolean;
  onToggle: (n: FlatNode) => void;
  onSelect: (n: FlatNode) => void;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 cursor-pointer select-none',
        'border-b border-gray-100 dark:border-gray-800/60',
        selected
          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50',
      )}
      style={{ height: ROW_H, paddingLeft: 8 + node.depth * 16 }}
      onClick={() => onSelect(node)}
    >
      <button
        className={clsx(
          'shrink-0 w-5 h-5 flex items-center justify-center rounded',
          'hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
          !node.hasChildren && 'invisible',
        )}
        onClick={e => { e.stopPropagation(); onToggle(node); }}
      >
        {node.isLoading
          ? <Loader2 size={12} className="animate-spin text-gray-400" />
          : <ChevronRight
              size={12}
              className={clsx('transition-transform text-gray-400', node.isExpanded && 'rotate-90')}
            />
        }
      </button>
      <span className="truncate text-[12px]">{node.name}</span>
    </div>
  );
}

// ── CategoryFormPanel — page-definition driven, same as PimFormPage ───────────

function CategoryFormPanel({
  entityCode, api, idType = 'number', mode, onSaved, onAddChild,
}: {
  entityCode: string;
  api:        PimFormApi;
  idType?:    'string' | 'number';
  mode:       FormMode & { type: 'new' | 'edit' };
  onSaved:    (row: Row) => void;
  onAddChild: (parentCode: string) => void;
}) {
  const qc     = useQueryClient();
  const isEdit = mode.type === 'edit';
  const editId = isEdit
    ? (idType === 'number' ? Number(mode.id) : mode.id)
    : undefined;

  const [values,      setValues]      = useState<Row>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Page definition — identical to PimFormPage ──
  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey:  QK.pageDef(entityCode),
    queryFn:   () => pageDefsApi.get(entityCode),
    staleTime: 5 * 60_000,
    retry:     false,
  });

  const { data: tableDef, isLoading: loadingMeta } = useQuery<TableDef>({
    queryKey:  QK.table(entityCode),
    queryFn:   api.meta,
    staleTime: 5 * 60_000,
    enabled:   !!pageDef,
  });

  const { data: existing, isLoading: loadingRecord } = useQuery<Row>({
    queryKey: QK.pimRecord(entityCode, editId),
    queryFn:  () => api.get(editId!),
    enabled:  !!pageDef && isEdit && editId !== undefined,
  });

  // Populate from existing record
  useEffect(() => {
    if (!existing || !tableDef) return;
    const cfgMap = new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c]));
    const init: Row = {};
    for (const f of tableDef.fields) {
      if (f.is_system && AUDIT_TYPES.has(f.field_type)) continue;
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
          ? (val as Record<string, string>) : {};
      } else {
        init[f.code] = existing[dataKey] ?? '';
      }
    }
    setValues(init);
  }, [existing, tableDef, pageDef]);

  // Defaults for new record
  useEffect(() => {
    if (isEdit || !tableDef) return;
    const cfgMl = new Set(
      (pageDef?.form_config?.fields ?? []).filter(c => c.multilingual).map(c => c.code),
    );
    const init: Row = { ...(mode.defaultValues ?? {}) };
    for (const f of tableDef.fields) {
      if (f.is_system && AUDIT_TYPES.has(f.field_type)) continue;
      if (init[f.code] !== undefined) continue;
      const isMl = f.is_multilingual || cfgMl.has(f.code) || f.field_type === 'jsonb';
      if (isMl)                                                          init[f.code] = { en: '' };
      else if (f.field_type === 'toggle')                                init[f.code] = f.default_value === 'true';
      else if (f.field_type === 'integer' || f.field_type === 'number') init[f.code] = f.default_value != null ? Number(f.default_value) : 0;
      else                                                               init[f.code] = f.default_value ?? '';
    }
    setValues(init);

    // Auto-assign sort_order = max(siblings) + 1
    // For categories, siblings share the same parent_code, so filter accordingly.
    const hasSortOrder = tableDef.fields.some(f => f.code === 'sort_order');
    if (hasSortOrder && api.list) {
      const parentCode = (mode as { type: 'new'; defaultValues: Row }).defaultValues?.parent_code;
      const filters: Record<string, unknown> = parentCode != null
        ? { parent_code: parentCode }
        : { parent_code: { op: 'isnull', value: true } };
      api.list({ filters, sort: [{ field: 'sort_order', direction: 'desc' }], limit: 1 })
        .then(res => {
          const maxVal = res.rows[0]?.sort_order;
          setValues(prev => ({ ...prev, sort_order: maxVal != null ? Number(maxVal) + 1 : 0 }));
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableDef, pageDef, mode.type]);

  // Stable cfg map — used in displayFields, handleSave, mutationFn, and render
  const cfgMap = useMemo(
    () => new Map((pageDef?.form_config?.fields ?? []).map(c => [c.code, c])),
    [pageDef],
  );

  // Build display fields exactly as PimFormPage does.
  // add_mode/edit_mode 'disabled' = visible but non-editable (fieldset disabled).
  // Only visible:false (eye toggle) hides the field entirely.
  const displayFields = useMemo((): ToolkitField[] => {
    const base = (tableDef?.fields ?? []).filter(f => !(f.is_system && AUDIT_TYPES.has(f.field_type)));
    const cfgFields = pageDef?.form_config?.fields ?? [];

    const applyOverrides = (f: ToolkitField): ToolkitField => {
      const cfg        = cfgMap.get(f.code);
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

  const saveMut = useMutation({
    mutationFn: () => {
      // Three-way rule:
      //   1. Always include fields shown in the form (displayFields) — user edited them
      //   2. Include non-system hidden fields (e.g. sort_order) — needed by DB NOT NULL
      //   3. Exclude system fields that are NOT in the form (path, has_children,
      //      inserted_by, modified_by, inserted_at, etc.)
      const visibleCodes = new Set(displayFields.map(f => f.code));
      const systemCodes  = new Set(
        (tableDef?.fields ?? []).filter(f => f.is_system).map(f => f.code),
      );
      const payload: Row = Object.fromEntries(
        Object.entries(values).filter(([k]) => {
          if (k === 'sort_order')  return true;   // NOT NULL — always send even if system
          if (visibleCodes.has(k)) return true;   // always send display fields
          if (systemCodes.has(k))  return false;  // drop server-computed system fields
          return true;
        }),
      );
      for (const [k, v] of Object.entries(payload)) {
        if (cfgMap.get(k)?.component_type === 'select_multi' && Array.isArray(v)) {
          payload[k] = v.join(',');
        }
      }
      if (mode.type === 'new') Object.assign(payload, mode.defaultValues);
      if (isEdit && editId !== undefined) payload.id = editId;
      return api.upsert(payload);
    },
    onSuccess: (result) => {
      const res = (result as Row) ?? {};
      const newId = res.id ?? (res.data as Row)?.id;
      if (newId) setValues(prev => ({ ...prev, id: newId }));
      setFieldErrors({});
      toast.success(isEdit ? 'Saved' : 'Created');
      qc.invalidateQueries({ queryKey: ['pim-list', entityCode] });
      if (isEdit) qc.invalidateQueries({ queryKey: QK.pimRecord(entityCode, editId) });
      onSaved({ ...values, ...res, ...(newId != null ? { id: newId } : {}) });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

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

  const isLoading = loadingDef || loadingMeta || (isEdit && loadingRecord);
  if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  if (!pageDef)  return (
    <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">
      No page definition found for <strong className="ml-1">{entityCode}</strong>
    </div>
  );

  const editCode = isEdit ? String(mode.row.code ?? editId) : undefined;

  return (
    <div className="flex flex-col h-full">

      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5
                      border-b border-gray-200 dark:border-gray-800
                      bg-white dark:bg-gray-900">
        <span className="flex-1 pim-title">
          {isEdit ? `Edit ${pageDef.title}` : `New ${pageDef.title}`}
        </span>

        {isEdit && editCode && (
          <button
            type="button"
            onClick={() => onAddChild(editCode)}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border
                       border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FolderPlus size={12} /> Add child
          </button>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="btn-primary flex items-center gap-1.5 py-1 px-3 text-[12px]"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={12} />}
          {isEdit ? 'Save' : 'Create'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3"
        >
          {displayFields.map(f => {
            const fullWidth    = f.is_multilingual || FULL_WIDTH_TYPES.has(f.field_type);
            const cfg          = cfgMap.get(f.code);
            const modeDisabled = isEdit ? cfg?.edit_mode === 'disabled' : cfg?.add_mode === 'disabled';
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
                    onChange={v => {
                      const normalized = f.code === 'code' && typeof v === 'string'
                        ? v.toLowerCase().replace(/ /g, '_')
                        : v;
                      setValues(prev => ({ ...prev, [f.code]: normalized }));
                      setFieldErrors(prev => {
                        if (!prev[f.code]) return prev;
                        const next = { ...prev };
                        delete next[f.code];
                        return next;
                      });
                    }}
                    fieldOptions={f.field_type === 'inline_select'
                      ? (tableDef!.options ?? []).filter(o => o.field_id === f.id)
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

// ── CategoryTreePage ──────────────────────────────────────────────────────────

export default function CategoryTreePage() {

  // ── Page definition + API (same pattern as DynamicPimFormPage) ──
  const { data: pageDef, isLoading: loadingDef } = useQuery({
    queryKey: QK.pageDef(PAGE_DEF_CODE),
    queryFn:  () => pageDefsApi.get(PAGE_DEF_CODE),
    staleTime: 5 * 60_000,
  });

  const api = useMemo(
    () => pageDef ? makeEntityApi(pageDef.gateway_object, pageDef.table_code, {
      list:   pageDef.list_endpoint   || undefined,
      upsert: pageDef.upsert_endpoint || undefined,
      delete: pageDef.delete_endpoint || undefined,
    }) : null,
    [pageDef],
  );

  // ── Tree state ──
  const [roots,       setRoots]       = useState<TreeNode[]>([]);
  const [loadingRoot, setLoadingRoot] = useState(true);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [formMode,    setFormMode]    = useState<FormMode>({ type: 'idle' });

  // ── Virtual scroll ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(600);
  const [scrollTop,  setScrollTop]  = useState(0);

  // ── Load root nodes once API is ready ──
  useEffect(() => {
    if (!api) return;
    setLoadingRoot(true);
    fetchLevel(api, null)
      .then(nodes => { setRoots(nodes); setLoadingRoot(false); })
      .catch(() => { toast.error('Failed to load categories'); setLoadingRoot(false); });
  }, [api]);

  // ── Measure container ──
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => setContainerH(e.contentRect.height));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Expand / collapse ──
  async function toggleExpand(node: FlatNode) {
    if (node.isExpanded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: false })));
      return;
    }
    if (node.childrenLoaded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: true })));
      return;
    }
    if (!api) return;
    setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: true })));
    try {
      const children = await fetchLevel(api, node.code);
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({
        ...n,
        isLoading:      false,
        isExpanded:     children.length > 0,
        hasChildren:    children.length > 0,
        childrenLoaded: true,
        children,
      })));
    } catch {
      toast.error('Failed to load children');
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: false })));
    }
  }

  // ── Flat visible list + virtual window ──
  const flatList = useMemo(() => flattenTree(roots), [roots]);
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx   = Math.min(flatList.length, Math.ceil((scrollTop + containerH) / ROW_H) + OVERSCAN);
  const visible  = flatList.slice(startIdx, endIdx);
  const totalH   = flatList.length * ROW_H;
  const offsetY  = startIdx * ROW_H;

  // ── Select node ──
  function selectNode(node: FlatNode) {
    setSelectedId(node.id);
    setFormMode({ type: 'edit', id: node.id, row: node.raw });
  }

  // ── Refresh a level after save, preserving expanded state ──
  async function refreshLevel(parentCode: string | null) {
    if (!api) return;
    const fresh = await fetchLevel(api, parentCode);

    if (parentCode === null) {
      setRoots(prev => {
        const oldById = new Map(prev.map(n => [n.id, n]));
        return fresh.map(n => {
          const old = oldById.get(n.id);
          return old
            ? { ...n, isExpanded: old.isExpanded, childrenLoaded: old.childrenLoaded, children: old.children }
            : n;
        });
      });
    } else {
      setRoots(prev => {
        function update(nodes: TreeNode[]): TreeNode[] {
          return nodes.map(n => {
            if (n.code === parentCode) {
              const oldById = new Map(n.children.map(c => [c.id, c]));
              return {
                ...n,
                hasChildren:    fresh.length > 0,
                isExpanded:     fresh.length > 0,
                childrenLoaded: true,
                children: fresh.map(c => {
                  const old = oldById.get(c.id);
                  return old
                    ? { ...c, isExpanded: old.isExpanded, childrenLoaded: old.childrenLoaded, children: old.children }
                    : c;
                }),
              };
            }
            if (n.children.length) return { ...n, children: update(n.children) };
            return n;
          });
        }
        return update(prev);
      });
    }
  }

  async function handleSaved(savedRow: Row) {
    const parentCode = (savedRow.parent_code ?? null) as string | null;
    await refreshLevel(parentCode);
    const savedId = savedRow.id as number | undefined;
    if (savedId) {
      setSelectedId(savedId);
      setFormMode({ type: 'edit', id: savedId, row: savedRow });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingDef) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  if (!pageDef || !api) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Page definition for <strong className="mx-1">{PAGE_DEF_CODE}</strong> not found.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* Left: tree */}
      <div className="flex flex-col w-72 shrink-0 border-r border-gray-200 dark:border-gray-800">

        <div className="shrink-0 flex items-center justify-between px-3 py-2
                        border-b border-gray-200 dark:border-gray-800
                        bg-white dark:bg-gray-900">
          <span className="pim-title">
            {pageDef.title}
          </span>
          <button
            onClick={() => { setSelectedId(null); setFormMode({ type: 'new', defaultValues: {} }); }}
            className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Plus size={11} /> New root
          </button>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          {loadingRoot ? (
            <div className="flex items-center justify-center h-32"><Spinner /></div>
          ) : flatList.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-gray-400">
              No categories yet
            </div>
          ) : (
            <div style={{ height: totalH, position: 'relative' }}>
              <div style={{ transform: `translateY(${offsetY}px)` }}>
                {visible.map(node => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    selected={selectedId === node.id}
                    onToggle={toggleExpand}
                    onSelect={selectNode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 min-w-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
        {formMode.type === 'idle' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400 dark:text-gray-600">
              Select a category to edit
            </p>
          </div>
        ) : (
          <CategoryFormPanel
            key={formMode.type === 'edit' ? `edit-${formMode.id}` : `new-${JSON.stringify((formMode as { defaultValues: Row }).defaultValues)}`}
            entityCode={pageDef.code}
            api={api}
            idType={pageDef.id_type}
            mode={formMode as FormMode & { type: 'new' | 'edit' }}
            onSaved={handleSaved}
            onAddChild={parentCode =>
              setFormMode({ type: 'new', defaultValues: { parent_code: parentCode } })
            }
          />
        )}
      </div>

    </div>
  );
}
