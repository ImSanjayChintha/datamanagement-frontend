import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, RefreshCw, Eye, EyeOff, GripVertical, ChevronDown, X, Plus } from 'lucide-react';
import componentTypes from './component-types.json';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { QK } from '@/lib/queryKeys';
import { apiClient } from '@/core/api';
import type { PageDef, PageDefColumn, PageDefField, ToolkitField } from '@/types/toolkit';
import { toolkitTablesApi } from '@/modules/toolkit/core/api';
import { endpointsApi } from '@/modules/api-manager/endpoints/api';
import { pageDefsApi } from './api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EndpointOption {
  label: string;   // endpoint name
  sub:   string;   // url_path
  value: string;   // resource_code (stored value)
}

interface ColDraft extends PageDefColumn {
  fieldLabel: string;   // toolkit field's natural label — display only, never saved
  field_type: string;
  filter_op:  string;   // '' = not filterable
  // label?: string inherited from PageDefColumn — the saveable display override
}

interface FieldDraft extends PageDefField {
  fieldLabel:     string;   // toolkit field's natural label — display only, never saved
  field_type:     string;
  visible:        boolean;
  ref_table_code: string | null;
  // label?: string inherited from PageDefField — the saveable display override
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const AUDIT_TYPES   = new Set(['uuid', 'id', 'datetime', 'date', 'time', 'daterange']);
const HIDDEN_BY_DEF = new Set(['uuid', 'id']);

// Returns true if a value looks like a multilingual JSON: {"en": "...", "fr": "..."}
function isMultilingualJson(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every(k => /^[a-z]{2,3}(-[A-Z]{2})?$/.test(k) && typeof obj[k] === 'string');
}

/** Extract keys and multilingual-JSONB field codes from the first row of a gateway list response. */
function extractApiData(body: unknown): { keys: string[]; multilingualKeys: Set<string> } {
  const b = body as Record<string, unknown>;
  const data = (b.data ?? b) as unknown;
  let rows: Record<string, unknown>[] = [];
  if (Array.isArray(data)) {
    rows = data as Record<string, unknown>[];
  } else {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.rows)) rows = obj.rows as Record<string, unknown>[];
  }
  if (rows.length === 0) return { keys: [], multilingualKeys: new Set() };
  const first = rows[0];
  const keys = Object.keys(first);
  const multilingualKeys = new Set(
    keys.filter(k => isMultilingualJson(first[k])),
  );
  return { keys, multilingualKeys };
}

function colsFromApiAndTable(
  apiKeys: string[],
  tkFields: ToolkitField[],
  savedCols: PageDefColumn[],
): ColDraft[] {
  const savedMap = new Map(savedCols.map(c => [c.code, c]));
  const typeMap  = new Map(tkFields.map(f => [f.code, f]));

  // Use API keys as the source of truth for what columns exist.
  // Fall back to toolkit table if no API keys (e.g. load without calling API).
  const keys = apiKeys.length > 0 ? apiKeys : tkFields.map(f => f.code);

  return keys.map((key, i) => {
    const tk    = typeMap.get(key);
    const saved = savedMap.get(key);
    const ft    = tk?.field_type ?? 'text';
    return {
      code:       key,
      fieldLabel: tk?.label || key,
      label:      saved?.label ?? undefined,
      field_type: ft,
      visible:    saved ? saved.visible : !(HIDDEN_BY_DEF.has(ft) || (tk?.is_system && AUDIT_TYPES.has(ft))),
      order:      saved ? saved.order : i + 1,
      bindkey:    saved?.bindkey ?? undefined,
      filter_op:  saved?.filter_op ?? '',
    };
  }).sort((a, b) => (savedCols.length > 0 ? a.order - b.order : 0));
}

function fieldsFromTable(
  fields: ToolkitField[],
  savedFields: PageDefField[],
  multilingualKeys: Set<string> = new Set(),
  resourceMap: Map<string, string> = new Map(),
): FieldDraft[] {
  const savedMap = new Map(savedFields.map(f => [f.code, f]));
  const base = fields
    .filter(f => !(f.is_system && AUDIT_TYPES.has(f.field_type)))
    .map((f, i): FieldDraft => {
      const saved = savedMap.get(f.code);
      // Priority: saved value → toolkit config gateway_endpoint → lookup by ref_table_code
      const ref_endpoint =
        saved?.ref_endpoint ??
        (f.config?.gateway_endpoint as string | undefined) ??
        (f.ref_table_code ? resourceMap.get(f.ref_table_code) : undefined) ??
        '';
      const isMultilingual = f.is_multilingual || multilingualKeys.has(f.code) || (saved?.multilingual ?? false);
      return {
        code:               f.code,
        fieldLabel:         f.label || f.code,
        label:              saved?.label ?? undefined,
        field_type:         f.field_type,
        visible:            saved ? (saved.visible ?? true) : true,
        order:              saved ? saved.order : i + 1,
        ref_table_code:     f.ref_table_code ?? null,
        ref_endpoint,
        multilingual:       isMultilingual || undefined,
        bindkey:            saved?.bindkey ?? undefined,
        add_mode:           saved?.add_mode,
        edit_mode:          saved?.edit_mode,
        required:           saved?.required,
        validation_message: saved?.validation_message,
        component_type:     saved?.component_type,
      };
    });
  if (savedFields.length > 0) base.sort((a, b) => a.order - b.order);
  return base;
}

// ── Drag-and-drop ──────────────────────────────────────────────────────────────

function useDragList<T>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
) {
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function onDragStart(idx: number) { dragFrom.current = idx; }
  function onDragEnter(idx: number) { setDragOver(idx); }

  function onDrop(toIdx: number) {
    const from = dragFrom.current;
    if (from !== null && from !== toIdx) {
      setItems(prev => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(toIdx, 0, item);
        return next;
      });
    }
    dragFrom.current = null;
    setDragOver(null);
  }

  function onDragEnd() {
    dragFrom.current = null;
    setDragOver(null);
  }

  return { dragOver, onDragStart, onDragEnter, onDrop, onDragEnd };
}

// ── EndpointPicker ─────────────────────────────────────────────────────────────

function EndpointPicker({
  value, onChange, options, placeholder,
}: {
  value:        string;
  onChange:     (v: string) => void;
  options:      EndpointOption[];
  placeholder?: string;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // look up by url_path (sub) — resource_code is NOT unique per endpoint
  const selectedLabel = useMemo(
    () => options.find(o => o.sub === value)?.label ?? value,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.sub.toLowerCase().includes(q)   ||
      o.value.toLowerCase().includes(q),
    );
  }, [options, search]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input text-xs pr-12"
          placeholder={placeholder ?? 'Search endpoints…'}
          value={open ? search : selectedLabel}
          onFocus={() => { setSearch(''); setOpen(true); }}
          onChange={e => setSearch(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setSearch(''); setOpen(false); }}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={12} className={`text-gray-400 transition-transform pointer-events-none ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="combobox-dropdown">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-gray-400 italic">No endpoints found</div>
          ) : filtered.map(opt => (
            <button
              key={`${opt.value}-${opt.sub}`}
              type="button"
              onClick={() => { onChange(opt.sub); setSearch(''); setOpen(false); }}
              className={`w-full text-left px-3 py-2 transition-colors
                ${opt.sub === value
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              <div className={`font-mono font-medium leading-tight ${opt.sub === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-800 dark:text-gray-200'}`}>
                {opt.label}
              </div>
              <div className="text-gray-400 mt-0.5 truncate">{opt.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PageDefFormPage() {
  const { code: routeCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!routeCode;

  // ── Form state ──
  const [code,           setCode]           = useState('');
  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [icon,           setIcon]           = useState('');
  const [tableCode,      setTableCode]      = useState('');
  const [idType,         setIdType]         = useState<'string' | 'number'>('string');
  const [navSection,     setNavSection]     = useState('pim');
  const [navLabel,       setNavLabel]       = useState('');
  const [navOrder,       setNavOrder]       = useState(0);
  const [sortOrder,      setSortOrder]      = useState(0);
  const [isActive,       setIsActive]       = useState(true);
  const [listEndpoint,   setListEndpoint]   = useState('');
  const [upsertEndpoint, setUpsertEndpoint] = useState('');
  const [deleteEndpoint, setDeleteEndpoint] = useState('');
  const [exportEndpoint, setExportEndpoint] = useState('');

  const [cols,          setCols]          = useState<ColDraft[]>([]);
  const [fldCfg,        setFldCfg]       = useState<FieldDraft[]>([]);
  const [staticFilters, setStaticFilters] = useState<{ field: string; value: string }[]>([]);
  const [sortFields,    setSortFields]    = useState<{ field: string; direction: 'asc' | 'desc' }[]>([]);
  const [defaultLimit,  setDefaultLimit]  = useState<number | ''>('');
  const [maxLimit,      setMaxLimit]      = useState<number | ''>('');
  const [loading,       setLoading]      = useState(false);
  const [loadError, setLoadError] = useState('');
  const [configTab, setConfigTab] = useState<'list' | 'form'>('list');
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const [existing,  setExisting] = useState<PageDef | null>(null);
  const [initDone,  setInitDone] = useState(false);

  const colsDnd   = useDragList(cols,   setCols);
  const fieldsDnd = useDragList(fldCfg, setFldCfg);

  // ── Gateway resource list for dropdowns ──
  const { data: endpointList } = useQuery({
    queryKey: ['gateway-endpoints-all'],
    queryFn:  () => endpointsApi.list({ page_size: 500 }),
    staleTime: 0,
  });
  const resourceOptions = useMemo((): EndpointOption[] =>
    (endpointList?.rows ?? [])
      .map(ep => ({
        label: ep.name,
        sub:   ep.url_path,
        value: ep.url_path,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  [endpointList]);

  // ── Auto-set nav_order and sort_order for new records ──
  useEffect(() => {
    if (isEdit) return;
    pageDefsApi.list({ page_size: 500 }).then(res => {
      const rows = res.rows;
      const maxNav  = rows.reduce((m, r) => Math.max(m, r.nav_order  ?? 0), 0);
      const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
      setNavOrder(maxNav + 1);
      setSortOrder(maxSort + 1);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load existing page def ──
  useEffect(() => {
    if (!isEdit || initDone) return;
    pageDefsApi.get(routeCode!).then(def => {
      setExisting(def);
      setCode(def.code);
      setTitle(def.title);
      setDescription(def.description ?? '');
      setIcon(def.icon ?? '');
      setTableCode(def.table_code);
      setIdType(def.id_type);
      setNavSection(def.nav_section);
      setNavLabel(def.nav_label ?? '');
      setNavOrder(def.nav_order);
      setSortOrder(def.sort_order);
      setIsActive(def.is_active);
      setListEndpoint(def.list_endpoint ?? '');
      setUpsertEndpoint(def.upsert_endpoint ?? '');
      setDeleteEndpoint(def.delete_endpoint ?? '');
      setExportEndpoint(def.export_endpoint ?? '');
      setStaticFilters(
        Object.entries(def.list_config?.static_filters ?? {})
          .map(([field, value]) => ({ field, value: String(value) }))
      );
      setSortFields(
        (def.list_config?.sort_fields ?? []) as { field: string; direction: 'asc' | 'desc' }[]
      );
      setDefaultLimit(def.list_config?.default_limit ?? '');
      setMaxLimit(def.list_config?.max_limit ?? '');
      setInitDone(true);
      // Auto-load whenever there is enough info (endpoint or table code)
      if (def.list_endpoint?.trim() || def.table_code?.trim()) {
        handleLoadFields(def);
      }
    }).catch(() => toast.error('Failed to load page definition'));
  }, [isEdit, routeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ──
  const tableObj = tableCode.trim();

  // Extract resource code from a url_path like /run/gateway/attributes/list → attributes
  function extractResource(urlPath: string): string {
    if (!urlPath) return '';
    const parts = urlPath.split('/').filter(Boolean);
    const gwIdx = parts.indexOf('gateway');
    if (gwIdx !== -1 && parts[gwIdx + 1]) return parts[gwIdx + 1];
    return urlPath;
  }

  // ── Load fields: list cols from API, form fields from toolkit table ──
  // When called during init, React state hasn't applied yet — read from `def` directly.
  async function handleLoadFields(def?: PageDef) {
    const lEndpoint = (def !== undefined ? (def.list_endpoint ?? '') : listEndpoint).trim();
    const tObj      = (def !== undefined ? (def.table_code    ?? '') : tableCode).trim();
    if (!lEndpoint && !tObj) return;

    setLoading(true);
    setLoadError('');
    try {
      const savedCols   = (def ?? existing)?.list_config?.columns ?? [];
      const savedFields = (def ?? existing)?.form_config?.fields  ?? [];

      // ── List columns: call the actual list API (limit=1) ──
      let apiKeys: string[] = [];
      let multilingualKeys  = new Set<string>();
      if (lEndpoint) {
        try {
          const listUrl = lEndpoint.startsWith('/')
            ? lEndpoint
            : `/run/gateway/${lEndpoint}/list`;
          const res = await apiClient.post<unknown>(
            listUrl,
            { filters: {}, limit: 1, offset: 0 },
          );
          const extracted = extractApiData(res.data);
          apiKeys         = extracted.keys;
          multilingualKeys = extracted.multilingualKeys;
        } catch {
          // API call failed — fall back to toolkit table keys
        }
      }

      // ── Toolkit table / schema introspection: for type info + form fields ──
      // If tableObj contains a dot it's schema.table_name → use introspection.
      // Otherwise it's a toolkit short code → use getByCode.
      let tkFields: ToolkitField[] = [];
      if (tObj) {
        try {
          if (tObj.includes('.')) {
            // Dotted: fetch all DB columns from information_schema
            const schemaDetail = await toolkitTablesApi.schemaFields(tObj);
            const schemaList = schemaDetail.fields ?? [];
            // Also try toolkit registry (table-name part) to enrich field types + references
            const tablePart = tObj.split('.').pop() ?? '';
            let tkMeta: ToolkitField[] = [];
            try {
              const tkDetail = await toolkitTablesApi.getByCode(tablePart);
              tkMeta = tkDetail.fields ?? [];
            } catch { /* no toolkit registration — use schema types as-is */ }
            if (tkMeta.length > 0) {
              const tkMap = new Map(tkMeta.map(f => [f.code, f]));
              tkFields = schemaList.map(sf => {
                const tk = tkMap.get(sf.code);
                if (!tk) return sf;
                return {
                  ...sf,
                  label:          tk.label || sf.label,
                  field_type:     tk.field_type,
                  is_multilingual: tk.is_multilingual,
                  is_required:    tk.is_required,
                  config:         tk.config,
                  ref_table_id:   tk.ref_table_id,
                  ref_table_code: tk.ref_table_code,
                  ref_table_label: tk.ref_table_label,
                  ref_type:       tk.ref_type,
                  store_field:    tk.store_field,
                  display_field:  tk.display_field,
                };
              });
            } else {
              tkFields = schemaList;
            }
          } else {
            const detail = await toolkitTablesApi.getByCode(tObj);
            tkFields = detail.fields ?? [];
          }
        } catch {
          // No table found — form fields will be empty
        }
      }

      // Build resource_code → list url_path map (prefer /list endpoint per resource)
      const resourceMap = new Map<string, string>();
      for (const o of resourceOptions) {
        const existing = resourceMap.get(o.value);
        if (!existing || o.sub.includes('/list')) resourceMap.set(o.value, o.sub);
      }

      setCols(colsFromApiAndTable(apiKeys, tkFields, savedCols));
      setFldCfg(fieldsFromTable(tkFields, savedFields, multilingualKeys, resourceMap));

      if (apiKeys.length === 0 && tkFields.length === 0) {
        setLoadError('No fields found — check the endpoint and table code.');
      }
    } catch (e) {
      setLoadError('Failed to load fields. Check the endpoint selection.');
    } finally {
      setLoading(false);
    }
  }

  // ── Save ──
  const saveMut = useMutation({
    mutationFn: () => {
      const derivedResource =
        extractResource(listEndpoint.trim())   ||
        extractResource(upsertEndpoint.trim()) ||
        extractResource(deleteEndpoint.trim()) ||
        tableCode.trim();

      const payload = {
        ...(existing?.id ? { id: existing.id } : {}),
        code:            code.trim().toLowerCase(),
        title:           title.trim(),
        description:     description.trim() || null,
        icon:            icon.trim() || null,
        gateway_object:  derivedResource,
        table_code:      tableCode.trim() || derivedResource,
        id_type:         idType,
        nav_section:     navSection.trim(),
        nav_label:       navLabel.trim() || null,
        nav_order:       navOrder,
        sort_order:      sortOrder,
        is_active:       isActive,
        list_endpoint:   listEndpoint.trim(),
        upsert_endpoint: upsertEndpoint.trim(),
        delete_endpoint: deleteEndpoint.trim(),
        list_config: {
          columns: cols.map((c, i) => ({
            code:    c.code,
            visible: c.visible,
            order:   i + 1,
            ...(c.label     ? { label:     c.label     } : {}),
            ...(c.bindkey   ? { bindkey:   c.bindkey   } : {}),
            ...(c.filter_op ? { filter_op: c.filter_op } : {}),
          })),
          ...(staticFilters.filter(sf => sf.field.trim()).length > 0 ? {
            static_filters: Object.fromEntries(
              staticFilters
                .filter(sf => sf.field.trim())
                .map(sf => {
                  const v = sf.value.trim();
                  const parsed: unknown = v === 'true' ? true : v === 'false' ? false
                    : (!isNaN(Number(v)) && v !== '') ? Number(v) : v;
                  return [sf.field.trim(), parsed];
                })
            ),
          } : {}),
          ...(sortFields.filter(sf => sf.field.trim()).length > 0 ? {
            sort_fields: sortFields.filter(sf => sf.field.trim()),
          } : {}),
          ...(defaultLimit !== '' ? { default_limit: Number(defaultLimit) } : {}),
          ...(maxLimit !== '' ? { max_limit: Number(maxLimit) } : {}),
        },
        form_config: {
          fields: fldCfg.map((f, i) => ({
            code:    f.code,
            order:   i + 1,
            visible: f.visible,
            ...(f.label          ? { label:          f.label         } : {}),
            ...(f.ref_endpoint   ? { ref_endpoint:  f.ref_endpoint  } : {}),
            ...(f.multilingual   ? { multilingual:  true            } : {}),
            ...(f.bindkey        ? { bindkey:        f.bindkey      } : {}),
            ...(f.add_mode       ? { add_mode:       f.add_mode     } : {}),
            ...(f.edit_mode      ? { edit_mode:      f.edit_mode    } : {}),
            ...(f.required != null ? { required:     f.required     } : {}),
            ...(f.component_type ? { component_type: f.component_type } : {}),
            ...(f.validation_message && Object.keys(f.validation_message).length > 0
              ? { validation_message: f.validation_message } : {}),
          })),
        },
      };
      return pageDefsApi.upsert(payload as Parameters<typeof pageDefsApi.upsert>[0]);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Page definition saved' : 'Page definition created');
      qc.invalidateQueries({ queryKey: ['toolkit-page-defs'] });
      qc.invalidateQueries({ queryKey: ['toolkit-page-def'] }); // bust individual page-def caches in PIM
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  const inp = 'input';
  const canLoad = !!(listEndpoint.trim() || tableCode.trim());

  if (isEdit && !initDone && !existing) {
    return <div className="flex items-center justify-center h-full"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* ── Sticky header ── */}
      <header className="shrink-0 flex items-center gap-3 px-6 py-3
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => navigate('/toolkit/page-defs')}
          className="p-1.5 -ml-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 leading-none mb-0.5">
            toolkit / page-defs
          </p>
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            {isEdit ? `Edit — ${existing?.title ?? routeCode}` : 'New page definition'}
          </h1>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !code}
          className="btn-primary inline-flex items-center gap-1.5 py-1.5 px-4 text-sm disabled:opacity-40"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={13} />}
          {isEdit ? 'Save' : 'Create'}
        </button>
        <button
          onClick={() => navigate('/toolkit/page-defs')}
          className="btn-ghost inline-flex items-center gap-1.5 py-1.5 px-3 text-sm"
        >
          <X size={13} />
          Close
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6">

          {/* ── Row 1: Identity + Navigation ── */}
          <div className="grid grid-cols-2 gap-6">

            {/* Identity */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Identity</h2>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={`${inp} font-mono`}
                    placeholder="e.g. attributes"
                    value={code}
                    onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    disabled={isEdit}
                  />
                  {isEdit && <p className="text-[11px] text-gray-400 mt-1">Cannot change after creation</p>}
                </div>
                <div>
                  <label className="label">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input className={inp} placeholder="e.g. Attributes" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="label">Description</label>
                  <input className={inp} placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="label">Icon (Lucide name)</label>
                  <input className={`${inp} font-mono`} placeholder="e.g. SlidersHorizontal" value={icon} onChange={e => setIcon(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                      <div className={`w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>
              </div>
            </section>

            {/* Navigation */}
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Navigation</h2>
                <p className="text-xs text-gray-500 mt-0.5">Controls where this page appears in the sidebar</p>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Section</label>
                  <input className={inp} placeholder="e.g. pim" value={navSection} onChange={e => setNavSection(e.target.value)} />
                </div>
                <div>
                  <label className="label">Sidebar label</label>
                  <input className={inp} placeholder="Defaults to title" value={navLabel} onChange={e => setNavLabel(e.target.value)} />
                </div>
                <div>
                  <label className="label">Nav order</label>
                  <input type="number" className={inp} value={navOrder} onChange={e => setNavOrder(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Sort order (data)</label>
                  <input type="number" className={inp} value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
                </div>
              </div>
            </section>
          </div>

          {/* ── Row 2: Data source ── */}
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Data source</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select the registered <strong>API endpoints</strong> for each operation.
                The <strong>Schema.Table</strong> provides field metadata for the add/edit form (e.g. <code className="font-mono text-[11px]">pim.attributes</code>).
              </p>
            </div>
            <div className="p-5 flex flex-col gap-5">
              {/* Endpoints */}
              <div className="grid grid-cols-3 gap-4">
                {([
                  { label: 'List endpoint',         val: listEndpoint,   set: setListEndpoint,   action: 'list'   },
                  { label: 'Upsert / Insert endpoint', val: upsertEndpoint, set: setUpsertEndpoint, action: 'upsert' },
                  { label: 'Delete endpoint',       val: deleteEndpoint, set: setDeleteEndpoint, action: 'delete' },
                  { label: 'Export endpoint',       val: exportEndpoint, set: setExportEndpoint, action: 'export' },
                ] as const).map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="label">{label}</label>
                    <EndpointPicker
                      value={val}
                      onChange={set}
                      options={resourceOptions}
                      placeholder="Search endpoints…"
                    />
                  </div>
                ))}
              </div>

              {/* Table + ID type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Schema.Table
                    <span className="ml-1 text-xs font-normal text-gray-400">(form field metadata)</span>
                  </label>
                  <input
                    className={`${inp} font-mono`}
                    placeholder="e.g. pim.attributes"
                    value={tableCode}
                    onChange={e => setTableCode(e.target.value.toLowerCase())}
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {tableCode.includes('.') ? 'Uses DB introspection' : 'Uses toolkit table registry'}
                  </p>
                </div>
                <div>
                  <label className="label">
                    Record ID format
                  </label>
                  <select className={inp} value={idType} onChange={e => setIdType(e.target.value as 'string' | 'number')}>
                    <option value="string">String / UUID — e.g. "a1b2-…"</option>
                    <option value="number">Integer — e.g. 42</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    How the ID in the page URL is interpreted when fetching or deleting a record
                  </p>
                </div>
              </div>

              {/* Load button */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!canLoad || loading}
                  onClick={() => handleLoadFields()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                             rounded-lg border border-gray-300 dark:border-gray-700
                             text-gray-700 dark:text-gray-300
                             hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                  Load fields
                </button>
                <p className="text-xs text-gray-400">
                  List columns from the <strong>list endpoint</strong>.{' '}
                  Form fields from <strong>{tableObj || '…'}</strong>
                  {tableObj.includes('.') ? ' (DB schema)' : tableObj ? ' (toolkit registry)' : ''}.
                </p>
              </div>
              {loadError && <p className="text-xs text-red-500">{loadError}</p>}
            </div>
          </section>

          {/* ── Row 3: Column & field config ── */}
          {cols.length > 0 && (
            <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                {(['list', 'form'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setConfigTab(t)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${
                      configTab === t
                        ? 'border-b-2 border-indigo-600 text-indigo-600'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {t === 'list'
                      ? `List columns (${cols.length})`
                      : `Form fields (${fldCfg.length})`}
                  </button>
                ))}
              </div>

              {/* List columns */}
              {configTab === 'list' && (
                <div>
                  <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                    <span className="shrink-0 w-3.5" />
                    <span className="shrink-0 w-4" />
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Field</span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Type</span>
                    <span className="shrink-0 w-36 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Header Label</span>
                    <span className="shrink-0 w-28 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Filter</span>
                    <span className="shrink-0 w-36 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Bind Key</span>
                  </div>
                  {/* Static Filters section (below columns) — added after the columns list */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {cols.map((col, idx) => (
                      <div
                        key={col.code}
                        draggable
                        onDragStart={() => colsDnd.onDragStart(idx)}
                        onDragEnter={() => colsDnd.onDragEnter(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => colsDnd.onDrop(idx)}
                        onDragEnd={colsDnd.onDragEnd}
                        className={`flex items-center gap-3 px-5 py-2.5 transition-colors
                          ${colsDnd.dragOver === idx
                            ? 'bg-indigo-50 dark:bg-indigo-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
                      >
                        <GripVertical size={14} className="text-gray-300 dark:text-gray-600 cursor-grab shrink-0" />
                        <button
                          type="button"
                          onClick={() => setCols(c => c.map((x, i) => i === idx ? { ...x, visible: !x.visible } : x))}
                          className={`shrink-0 transition-colors ${col.visible ? 'text-indigo-600' : 'text-gray-300'}`}
                          title={col.visible ? 'Visible by default' : 'Hidden by default'}
                        >
                          {col.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-gray-800 dark:text-gray-200">{col.fieldLabel}</span>
                          <span className="ml-2 font-mono text-[11px] text-gray-400">{col.code}</span>
                        </div>
                        <span className="text-[11px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded shrink-0">
                          {col.field_type}
                        </span>
                        <input
                          className="input h-7 text-xs w-36 shrink-0"
                          placeholder={col.fieldLabel}
                          value={col.label ?? ''}
                          onChange={e => setCols(c => c.map((x, i) => i === idx ? { ...x, label: e.target.value || undefined } : x))}
                          title="Header label override — overrides the default column header. Leave empty to use the field's default label."
                        />
                        <select
                          className="input h-7 text-xs w-28 shrink-0"
                          value={col.filter_op}
                          onChange={e => setCols(c => c.map((x, i) => i === idx ? { ...x, filter_op: e.target.value } : x))}
                          title="Filter operator — controls the search input and operator sent to p_filters"
                        >
                          <option value="">— no filter</option>
                          <option value="eq">= equals</option>
                          <option value="contains">≈ contains</option>
                          <option value="startswith">starts with</option>
                          <option value="gte">≥ gte</option>
                          <option value="lte">≤ lte</option>
                        </select>
                        <input
                          className="input h-7 text-xs font-mono w-36 shrink-0"
                          placeholder="bindkey…"
                          value={col.bindkey ?? ''}
                          onChange={e => setCols(c => c.map((x, i) => i === idx ? { ...x, bindkey: e.target.value || undefined } : x))}
                          title="Bind key — reads row[bindkey] instead of row[code]"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Static Filters */}
                  <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                      Static Filters
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Always applied when loading this list. Values: <code className="font-mono">true</code>, <code className="font-mono">false</code>, numbers, or strings.
                    </p>
                    {staticFilters.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <div className="grid grid-cols-[1fr_1fr_28px] gap-2 px-0.5 mb-1">
                          <span className="text-[11px] text-gray-400">Field</span>
                          <span className="text-[11px] text-gray-400">Value</span>
                        </div>
                        {staticFilters.map((sf, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                            <input
                              className="input h-7 text-xs font-mono"
                              placeholder="is_active"
                              value={sf.field}
                              onChange={e => setStaticFilters(f => f.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                            />
                            <input
                              className="input h-7 text-xs font-mono"
                              placeholder="true"
                              value={sf.value}
                              onChange={e => setStaticFilters(f => f.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                            />
                            <button
                              type="button"
                              onClick={() => setStaticFilters(f => f.filter((_, j) => j !== i))}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setStaticFilters(f => [...f, { field: '', value: '' }])}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Plus size={11} /> Add filter
                    </button>
                  </div>

                  {/* Default Sort */}
                  <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                      Default Sort
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Applied when this list loads. Multiple fields sorted in the order listed.
                    </p>
                    <datalist id="sort-field-list">
                      {cols.map(c => <option key={c.code} value={c.code} />)}
                    </datalist>
                    {sortFields.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <div className="grid grid-cols-[1fr_90px_28px] gap-2 px-0.5 mb-1">
                          <span className="text-[11px] text-gray-400">Field</span>
                          <span className="text-[11px] text-gray-400">Direction</span>
                        </div>
                        {sortFields.map((sf, i) => (
                          <div key={i} className="grid grid-cols-[1fr_90px_28px] gap-2 items-center">
                            <input
                              className="input h-7 text-xs font-mono"
                              placeholder="field_name"
                              list="sort-field-list"
                              value={sf.field}
                              onChange={e => setSortFields(f => f.map((x, j) => j === i ? { ...x, field: e.target.value } : x))}
                            />
                            <select
                              className="input h-7 text-xs"
                              value={sf.direction}
                              onChange={e => setSortFields(f => f.map((x, j) => j === i ? { ...x, direction: e.target.value as 'asc' | 'desc' } : x))}
                            >
                              <option value="asc">asc ↑</option>
                              <option value="desc">desc ↓</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setSortFields(f => f.filter((_, j) => j !== i))}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSortFields(f => [...f, { field: '', direction: 'asc' }])}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Plus size={11} /> Add sort field
                    </button>
                  </div>

                  {/* Page Limits */}
                  <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
                      Page Limits
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Controls page size options in the list. Leave blank to use defaults (100, 200, 300).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Default page size</label>
                        <input
                          type="number"
                          className="input h-7 text-xs"
                          placeholder="e.g. 100"
                          value={defaultLimit}
                          onChange={e => setDefaultLimit(e.target.value === '' ? '' : Number(e.target.value))}
                          min={1}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Max page size</label>
                        <input
                          type="number"
                          className="input h-7 text-xs"
                          placeholder="e.g. 200"
                          value={maxLimit}
                          onChange={e => setMaxLimit(e.target.value === '' ? '' : Number(e.target.value))}
                          min={1}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Form fields */}
              {configTab === 'form' && (
                <div>
                  {fldCfg.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-gray-400 text-center">
                      No form fields — either the table code has no toolkit table or all fields are audit-only.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {fldCfg.map((fld, idx) => {
                        const isExpanded = expandedCodes.has(fld.code);
                        const hasRef     = fld.ref_table_code !== null
                          || fld.field_type === 'select'
                          || fld.field_type === 'multiselect';
                        const msgEntries = Object.entries(fld.validation_message ?? {});
                        const hasDot     = !!(fld.add_mode || fld.edit_mode || fld.required
                          || fld.component_type || fld.ref_endpoint || fld.bindkey
                          || msgEntries.length > 0);

                        function toggleExpand() {
                          setExpandedCodes(prev => {
                            const next = new Set(prev);
                            next.has(fld.code) ? next.delete(fld.code) : next.add(fld.code);
                            return next;
                          });
                        }

                        return (
                          <div
                            key={fld.code}
                            className={`transition-colors ${fieldsDnd.dragOver === idx ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                          >
                            {/* ── Compact header row ── */}
                            <div
                              draggable
                              onDragStart={() => fieldsDnd.onDragStart(idx)}
                              onDragEnter={() => fieldsDnd.onDragEnter(idx)}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => fieldsDnd.onDrop(idx)}
                              onDragEnd={fieldsDnd.onDragEnd}
                              className={`flex items-center gap-3 px-5 py-2.5 transition-colors
                                ${!isExpanded ? 'hover:bg-gray-50 dark:hover:bg-gray-900/40' : ''}`}
                            >
                              <GripVertical size={14} className="text-gray-300 dark:text-gray-600 cursor-grab shrink-0" />

                              <button
                                type="button"
                                onClick={() => setFldCfg(f => f.map((x, i) => i === idx ? { ...x, visible: !x.visible } : x))}
                                className={`shrink-0 transition-colors ${fld.visible ? 'text-indigo-600' : 'text-gray-300 dark:text-gray-600'}`}
                                title={fld.visible ? 'Shown in form' : 'Hidden from form'}
                              >
                                {fld.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                              </button>

                              <button
                                type="button"
                                onClick={toggleExpand}
                                className="flex-1 min-w-0 flex items-center gap-2 text-left"
                              >
                                <span className={`text-sm font-medium ${fld.visible ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'}`}>
                                  {fld.label || fld.fieldLabel}
                                </span>
                                {fld.label && (
                                  <span className="text-[10px] text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1 py-px rounded font-mono shrink-0">
                                    {fld.fieldLabel}
                                  </span>
                                )}
                                <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">{fld.code}</span>
                                {hasDot && !isExpanded && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" title="Has configuration" />
                                )}
                              </button>

                              <div className="flex items-center gap-2 shrink-0">
                                {fld.required && (
                                  <span className="text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">REQ</span>
                                )}
                                {fld.component_type && (
                                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded">
                                    {fld.component_type}
                                  </span>
                                )}
                                <span className="text-[11px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                  {fld.field_type}
                                </span>
                                <button
                                  type="button"
                                  onClick={toggleExpand}
                                  className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                  title={isExpanded ? 'Collapse' : 'Configure field'}
                                >
                                  <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </div>

                            {/* ── Expanded settings panel ── */}
                            {isExpanded && (
                              <div className="mx-5 mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-hidden">

                                {/* Section: Visibility & Mode */}
                                <div className="px-4 py-3 grid grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Add Mode</label>
                                    <select
                                      className="input h-8 text-xs w-full"
                                      value={fld.add_mode ?? ''}
                                      onChange={e => setFldCfg(f => f.map((x, i) => i === idx
                                        ? { ...x, add_mode: (e.target.value || undefined) as 'enabled' | 'disabled' | undefined }
                                        : x))}
                                    >
                                      <option value="">Default</option>
                                      <option value="enabled">Enabled</option>
                                      <option value="disabled">Disabled</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Edit Mode</label>
                                    <select
                                      className="input h-8 text-xs w-full"
                                      value={fld.edit_mode ?? ''}
                                      onChange={e => setFldCfg(f => f.map((x, i) => i === idx
                                        ? { ...x, edit_mode: (e.target.value || undefined) as 'enabled' | 'disabled' | undefined }
                                        : x))}
                                    >
                                      <option value="">Default</option>
                                      <option value="enabled">Enabled</option>
                                      <option value="disabled">Disabled</option>
                                    </select>
                                  </div>
                                  <div className="flex items-end pb-1.5">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded accent-indigo-600"
                                        checked={fld.required ?? false}
                                        onChange={e => setFldCfg(f => f.map((x, i) => i === idx
                                          ? { ...x, required: e.target.checked ? true : undefined }
                                          : x))}
                                      />
                                      <span className="text-sm text-gray-700 dark:text-gray-300">Required field</span>
                                    </label>
                                  </div>
                                </div>

                                {/* Section: Rendering */}
                                <div className="px-4 py-3 grid grid-cols-4 gap-4 border-b border-gray-200 dark:border-gray-700">
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Label Override</label>
                                    <input
                                      className="input h-8 text-xs w-full"
                                      placeholder={fld.fieldLabel}
                                      value={fld.label ?? ''}
                                      onChange={e => setFldCfg(f => f.map((x, i) => i === idx ? { ...x, label: e.target.value || undefined } : x))}
                                      title="Overrides the field label shown in the form. Leave empty to use the toolkit field's default label."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Component Type</label>
                                    <select
                                      className="input h-8 text-xs w-full"
                                      value={fld.component_type ?? ''}
                                      onChange={e => setFldCfg(f => f.map((x, i) => i === idx
                                        ? { ...x, component_type: e.target.value || undefined }
                                        : x))}
                                    >
                                      <option value="">— auto (from field type)</option>
                                      {componentTypes.map(ct => (
                                        <option key={ct.value} value={ct.value}>{ct.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Ref Endpoint</label>
                                    {hasRef ? (
                                      <EndpointPicker
                                        value={fld.ref_endpoint ?? ''}
                                        onChange={v => setFldCfg(f => f.map((x, i) => i === idx ? { ...x, ref_endpoint: v } : x))}
                                        options={resourceOptions}
                                        placeholder={fld.ref_table_code ?? 'Search endpoints…'}
                                      />
                                    ) : (
                                      <p className="text-[11px] text-gray-400 dark:text-gray-600 italic pt-1.5">
                                        No ref — field type <span className="font-mono">{fld.field_type}</span>
                                      </p>
                                    )}
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Bind Key</label>
                                    <input
                                      className="input h-8 text-xs font-mono w-full"
                                      placeholder="bindkey…"
                                      value={fld.bindkey ?? ''}
                                      onChange={e => setFldCfg(f => f.map((x, i) => i === idx ? { ...x, bindkey: e.target.value || undefined } : x))}
                                      title="Reads/writes record[bindkey] instead of record[code]"
                                    />
                                  </div>
                                </div>

                                {/* Section: Validation Message */}
                                <div className="px-4 py-3">
                                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                                    Validation Message
                                    <span className="ml-1.5 font-normal text-gray-400">— shown when required field is empty</span>
                                  </p>
                                  <div className="space-y-1.5">
                                    {msgEntries.map(([lang, msg]) => (
                                      <div key={lang} className="flex items-center gap-2">
                                        <input
                                          className="input h-7 text-xs font-mono w-14 shrink-0 text-center"
                                          placeholder="en"
                                          value={lang}
                                          onChange={e => {
                                            const newLang = e.target.value;
                                            setFldCfg(f => f.map((x, i) => {
                                              if (i !== idx) return x;
                                              const cur = { ...(x.validation_message ?? {}) };
                                              delete cur[lang];
                                              if (newLang) cur[newLang] = msg;
                                              return { ...x, validation_message: Object.keys(cur).length ? cur : undefined };
                                            }));
                                          }}
                                        />
                                        <input
                                          className="input h-7 text-xs flex-1"
                                          placeholder="Validation message…"
                                          value={msg}
                                          onChange={e => setFldCfg(f => f.map((x, i) => i !== idx ? x : {
                                            ...x,
                                            validation_message: { ...(x.validation_message ?? {}), [lang]: e.target.value },
                                          }))}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setFldCfg(f => f.map((x, i) => {
                                            if (i !== idx) return x;
                                            const cur = { ...(x.validation_message ?? {}) };
                                            delete cur[lang];
                                            return { ...x, validation_message: Object.keys(cur).length ? cur : undefined };
                                          }))}
                                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => setFldCfg(f => f.map((x, i) => i !== idx ? x : {
                                        ...x,
                                        validation_message: { ...(x.validation_message ?? {}), en: '' },
                                      }))}
                                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                                    >
                                      <Plus size={11} /> Add language
                                    </button>
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
