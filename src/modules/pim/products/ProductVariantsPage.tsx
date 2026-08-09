import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, X, Save, Trash2, Layers, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import Spinner from '@/components/ui/Spinner';
import { makeEntityApi } from '@/modules/pim/api';
import FamilyProductTree from '@/modules/pim/components/FamilyProductTree';
import rawAxes from './variant-axes.json';

// ── Axis types ────────────────────────────────────────────────────────────────

interface AxisValue { code: string; label: Record<string, string> }
interface AxisDef   { code: string; color: string; label: Record<string, string>; values: AxisValue[] }

const AXES: AxisDef[] = (rawAxes as { axes: AxisDef[] }).axes;

const CHIP_CLS: Record<string, string> = {
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  violet:  'bg-violet-50 text-violet-700 border-violet-200',
};
const BTN_ACTIVE: Record<string, string> = {
  blue:    'bg-blue-600 text-white border-blue-600',
  amber:   'bg-amber-500 text-white border-amber-500',
  emerald: 'bg-emerald-600 text-white border-emerald-600',
  violet:  'bg-violet-600 text-white border-violet-600',
};
const BTN_IDLE: Record<string, string> = {
  blue:    'text-blue-700 border-blue-200 hover:bg-blue-50',
  amber:   'text-amber-700 border-amber-200 hover:bg-amber-50',
  emerald: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  violet:  'text-violet-700 border-violet-200 hover:bg-violet-50',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function lbl(v: unknown, locale = 'en'): string {
  if (!v) return '';
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as Record<string, string>;
      return p[locale] ?? p.en ?? p[Object.keys(p)[0]] ?? v;
    } catch { return v; }
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, string>;
    return o[locale] ?? o.en ?? o[Object.keys(o)[0]] ?? '';
  }
  return String(v);
}

function axisLbl(ax: AxisDef, locale: string) { return ax.label[locale] ?? ax.label.en ?? ax.code; }
function valueLbl(ax: AxisDef, code: string, locale: string) {
  const v = ax.values.find(x => x.code === code);
  return v ? (v.label[locale] ?? v.label.en ?? code) : code;
}

function deriveCode(itemId: string, brandCode: string): string {
  const clean = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return [clean(itemId), clean(brandCode)].filter(Boolean).join('_');
}

// ── API ───────────────────────────────────────────────────────────────────────

const variantsApi = makeEntityApi('product_variants', 'product_variants');
const brandsApi   = makeEntityApi('brands',           'brands');
const localesApi  = makeEntityApi('locales',          'locales');

// ── Variant draft ─────────────────────────────────────────────────────────────

interface VariantDraft {
  id?:          string;
  product_code: string;
  brand_code:   string;
  item_id:      string;
  ean:          string;
  sort_order:   number;
  is_active:    boolean;
  axis:         Record<string, string>;
  values:       Record<string, unknown>;
}

function emptyDraft(productCode: string): VariantDraft {
  return { product_code: productCode, brand_code: '', item_id: '', ean: '', sort_order: 0, is_active: true, axis: {}, values: {} };
}

function rowToDraft(v: Row): VariantDraft {
  return {
    id:           String(v.id ?? ''),
    product_code: String(v.product_code ?? ''),
    brand_code:   String(v.brand_code ?? ''),
    item_id:      String(v.item_id ?? ''),
    ean:          String(v.ean ?? ''),
    sort_order:   Number(v.sort_order ?? 0),
    is_active:    Boolean(v.is_active ?? true),
    axis:         (typeof v.axis === 'object' && v.axis && !Array.isArray(v.axis) ? v.axis : {}) as Record<string, string>,
    values:       (typeof v.values === 'object' && v.values ? v.values : {}) as Record<string, unknown>,
  };
}

// ── AxisChip ──────────────────────────────────────────────────────────────────

function AxisChip({ ax, valueCode, locale }: { ax: AxisDef; valueCode: string; locale: string }) {
  if (!valueCode) return <span className="text-gray-300">—</span>;
  return (
    <span className={clsx(
      'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap',
      CHIP_CLS[ax.color] ?? 'bg-gray-50 text-gray-600 border-gray-200',
    )}>
      {valueLbl(ax, valueCode, locale)}
    </span>
  );
}

// ── AxisSelector ──────────────────────────────────────────────────────────────

function AxisSelector({ ax, selected, locale, onChange }: {
  ax: AxisDef; selected: string; locale: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {axisLbl(ax, locale)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ax.values.map(v => {
          const active = selected === v.code;
          return (
            <button key={v.code} type="button"
              onClick={() => onChange(active ? '' : v.code)}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-md border transition-all',
                active
                  ? BTN_ACTIVE[ax.color] ?? 'bg-gray-800 text-white border-gray-800'
                  : clsx('bg-white', BTN_IDLE[ax.color] ?? 'text-gray-600 border-gray-200 hover:bg-gray-50'),
              )}
            >
              {valueLbl(ax, v.code, locale)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ProductVariantsPage ───────────────────────────────────────────────────────

export default function ProductVariantsPage() {
  const qc = useQueryClient();

  const [selectedProduct, setSelectedProduct] = useState<Row | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Row | null>(null);
  const [isNewMode,       setIsNewMode]        = useState(false);
  const [treeSearch,      setTreeSearch]       = useState('');
  const [draft,           setDraft]            = useState<VariantDraft | null>(null);

  const variantCode = useMemo(
    () => draft ? deriveCode(draft.item_id, draft.brand_code) : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft?.item_id, draft?.brand_code],
  );

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: brandResult }  = useQuery({ queryKey: ['pim/brands'],  queryFn: () => brandsApi.list({ limit: 500 }) });
  const { data: localeResult } = useQuery({ queryKey: ['pim/locales'], queryFn: () => localesApi.list({ filters: { is_active: true }, limit: 50 }) });

  const brands  = brandResult?.rows  ?? [];
  const locales = localeResult?.rows ?? [];

  const locale = useMemo(() => {
    const def = locales.find(l => Boolean(l.is_default));
    return String((def ?? locales[0])?.code ?? 'en');
  }, [locales]);

  const prodCode = selectedProduct ? String(selectedProduct.code ?? '') : '';

  const { data: variantResult, isFetching: variantsFetching } = useQuery({
    queryKey: ['pim/variants', prodCode],
    queryFn:  () => variantsApi.list({
      filters: { product_code: prodCode },
      limit:   500,
      sort:    [{ field: 'sort_order', direction: 'asc' }],
    }),
    enabled: !!prodCode,
  });
  const variants = variantResult?.rows ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const payload: Record<string, unknown> = { ...draft, code: variantCode };
      if (!payload.id) delete payload.id;
      return variantsApi.upsert(payload);
    },
    onSuccess: () => {
      toast.success(draft?.id ? 'Variant updated' : 'Variant created');
      qc.invalidateQueries({ queryKey: ['pim/variants', prodCode] });
      closeForm();
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Save failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => variantsApi.delete(String(selectedVariant!.id)),
    onSuccess: () => {
      toast.success('Variant deleted');
      qc.invalidateQueries({ queryKey: ['pim/variants', prodCode] });
      closeForm();
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Delete failed');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function selectProduct(p: Row) {
    setSelectedProduct(p);
    setSelectedVariant(null);
    setDraft(null);
    setIsNewMode(false);
  }

  function selectVariant(v: Row) {
    if (selectedVariant?.id === v.id) { closeForm(); return; }
    setSelectedVariant(v);
    setIsNewMode(false);
    setDraft(rowToDraft(v));
  }

  function startNew() {
    setSelectedVariant(null);
    setIsNewMode(true);
    setDraft(emptyDraft(prodCode));
  }

  function closeForm() {
    setSelectedVariant(null);
    setIsNewMode(false);
    setDraft(null);
  }

  function patch(update: Partial<VariantDraft>) {
    setDraft(d => d ? { ...d, ...update } : d);
  }

  function patchAxis(axCode: string, value: string) {
    setDraft(d => {
      if (!d) return d;
      const axis = { ...d.axis };
      if (value) axis[axCode] = value; else delete axis[axCode];
      return { ...d, axis };
    });
  }

  const showForm = isNewMode || !!selectedVariant;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden">

      {/* ── Left tree panel ────────────────────────────────────────────────── */}
      <aside className="w-60 flex-none flex flex-col border-r border-gray-100 bg-gray-50/40">
        <div className="px-3 py-3 border-b border-gray-100 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Products</p>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Search families…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-gray-200 bg-white
                         placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* Virtual treeview fills remaining height */}
        <FamilyProductTree
          locale={locale}
          search={treeSearch}
          selectedCode={selectedProduct ? String(selectedProduct.code ?? '') : null}
          onSelect={selectProduct}
          className="flex-1 py-1"
        />
      </aside>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {!selectedProduct && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-300">
            <Layers size={36} strokeWidth={1} />
            <p className="text-sm text-gray-400">Select a product to view its variants</p>
          </div>
        )}

        {selectedProduct && (
          <>
            {/* Product header */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 bg-white shrink-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-800 truncate">
                  {lbl(selectedProduct.name, locale) || String(selectedProduct.code ?? '')}
                </h2>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                  {String(selectedProduct.code ?? '')}
                  {selectedProduct.family_code && (
                    <span className="ml-2 text-gray-300">· {String(selectedProduct.family_code)}</span>
                  )}
                </p>
              </div>
              <button
                onClick={startNew}
                disabled={isNewMode && !selectedVariant}
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           text-xs font-medium bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                           text-white transition-colors shadow-sm disabled:opacity-40"
              >
                <Plus size={13} />
                New Variant
              </button>
            </div>

            {/* Content row */}
            <div className="flex-1 flex overflow-hidden min-h-0">

              {/* Variant list */}
              <div className={clsx('flex flex-col overflow-hidden min-w-0', showForm ? 'flex-[3]' : 'flex-1')}>
                {variantsFetching && (
                  <div className="flex items-center justify-center py-12"><Spinner size="md" /></div>
                )}
                {!variantsFetching && variants.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-gray-300">
                    <Package size={28} strokeWidth={1} />
                    <p className="text-sm text-gray-400">No variants yet</p>
                    <button onClick={startNew} className="text-xs text-indigo-500 hover:text-indigo-700 underline underline-offset-2 transition-colors">
                      Create the first one
                    </button>
                  </div>
                )}
                {!variantsFetching && variants.length > 0 && (
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Code', 'Brand', 'Item ID', 'EAN'].map(h => (
                            <th key={h} className="text-left px-4 py-2.5 font-semibold text-[10px] uppercase tracking-wide text-gray-400 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                          {AXES.map(ax => (
                            <th key={ax.code} className="text-left px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide text-gray-400 whitespace-nowrap">
                              {axisLbl(ax, locale)}
                            </th>
                          ))}
                          <th className="text-center px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide text-gray-400">
                            Active
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map(v => {
                          const vid     = String(v.id ?? '');
                          const axisMap = (typeof v.axis === 'object' && v.axis && !Array.isArray(v.axis) ? v.axis : {}) as Record<string, string>;
                          const isSel   = selectedVariant?.id === vid;
                          return (
                            <tr key={vid} onClick={() => selectVariant(v)}
                              className={clsx(
                                'border-b border-gray-50 cursor-pointer transition-colors',
                                isSel ? 'bg-indigo-50/70' : 'hover:bg-gray-50/70',
                              )}
                            >
                              <td className="px-4 py-2.5 font-mono text-gray-700 whitespace-nowrap">{String(v.code ?? '')}</td>
                              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{String(v.brand_code ?? '–')}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{String(v.item_id ?? '–')}</td>
                              <td className="px-3 py-2.5 font-mono text-gray-400 whitespace-nowrap">{String(v.ean ?? '–')}</td>
                              {AXES.map(ax => (
                                <td key={ax.code} className="px-3 py-2.5">
                                  <AxisChip ax={ax} valueCode={axisMap[ax.code] ?? ''} locale={locale} />
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-center">
                                <span className={clsx('inline-block w-1.5 h-1.5 rounded-full', v.is_active ? 'bg-emerald-500' : 'bg-gray-300')} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Form panel */}
              {showForm && draft && (
                <div className="flex-[2] flex flex-col border-l border-gray-100 bg-white overflow-hidden min-w-0 max-w-md">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {draft.id ? 'Edit variant' : 'New variant'}
                    </h3>
                    <button onClick={closeForm} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100">
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        Variant Code
                      </label>
                      <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md font-mono text-xs text-gray-500 min-h-[30px]">
                        {variantCode || <span className="italic text-gray-300">auto-generated from Item ID + Brand</span>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        Brand <span className="text-red-400 normal-case font-normal">*</span>
                      </label>
                      <select value={draft.brand_code} onChange={e => patch({ brand_code: e.target.value })}
                        className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white
                                   focus:outline-none focus:ring-1 focus:ring-indigo-200 text-gray-700">
                        <option value="">— Select brand —</option>
                        {brands.map(b => (
                          <option key={String(b.id)} value={String(b.code ?? '')}>
                            {lbl(b.name, locale) || String(b.code ?? '')}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        Item ID <span className="text-red-400 normal-case font-normal">*</span>
                      </label>
                      <input type="text" value={draft.item_id} onChange={e => patch({ item_id: e.target.value })}
                        placeholder="e.g. SK001"
                        className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 font-mono
                                   placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                        EAN / Barcode
                      </label>
                      <input type="text" value={draft.ean} onChange={e => patch({ ean: e.target.value })}
                        placeholder="e.g. 5901234123457"
                        className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 font-mono
                                   placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                        Variant Axes
                      </p>
                      <div className="space-y-4">
                        {AXES.map(ax => (
                          <AxisSelector key={ax.code} ax={ax}
                            selected={draft.axis[ax.code] ?? ''}
                            locale={locale}
                            onChange={val => patchAxis(ax.code, val)} />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Sort Order</label>
                        <input type="number" value={draft.sort_order} onChange={e => patch({ sort_order: Number(e.target.value) })}
                          className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-200" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Status</label>
                        <select value={draft.is_active ? 'true' : 'false'} onChange={e => patch({ is_active: e.target.value === 'true' })}
                          className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200 text-gray-700">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 shrink-0 bg-gray-50/50">
                    {draft.id && (
                      <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                        {deleteMut.isPending ? <Spinner size="sm" /> : <Trash2 size={12} />}
                        Delete
                      </button>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button onClick={closeForm} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => saveMut.mutate()}
                        disabled={saveMut.isPending || !draft.brand_code || !draft.item_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                                   bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors shadow-sm">
                        {saveMut.isPending ? <Spinner size="sm" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
