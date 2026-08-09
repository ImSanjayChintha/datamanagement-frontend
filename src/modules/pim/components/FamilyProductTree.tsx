/**
 * FamilyProductTree
 *
 * Reusable virtual-scrolled treeview: Families (collapsible) → Products (lazy-loaded per family).
 *
 * - Families are fetched once from /families.
 * - Products are fetched from /products with family_code filter, only when a family is first expanded.
 * - The visible list is virtualised: only the rows inside the viewport are in the DOM.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { ChevronRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import Spinner from '@/components/ui/Spinner';
import { makeEntityApi } from '@/modules/pim/api';

// ── API ───────────────────────────────────────────────────────────────────────

const familiesApi = makeEntityApi('families', 'families');
const productsApi = makeEntityApi('products', 'products');

type Row = Record<string, unknown>;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Virtual-scroll constants ──────────────────────────────────────────────────

const ITEM_H  = 30;   // px — height of every node (uniform makes math trivial)
const OVERSCAN = 8;   // extra rows rendered above and below the viewport

// ── Flat node types ───────────────────────────────────────────────────────────

type FlatNode =
  | { type: 'family';  code: string; label: string; isOpen: boolean }
  | { type: 'product'; code: string; label: string; row: Row }
  | { type: 'status';  familyCode: string; kind: 'loading' | 'empty' };

// ── Component props ───────────────────────────────────────────────────────────

export interface FamilyProductTreeProps {
  /** Active locale code, e.g. "en". Used to resolve multilingual JSONB labels. */
  locale:        string;
  /** Optional search string — filters family and product names/codes. */
  search?:       string;
  /** Code of the currently selected product (highlighted in the tree). */
  selectedCode:  string | null;
  /** Called when the user clicks a product row. */
  onSelect:      (product: Row) => void;
  /** Extra CSS classes on the root scroll container. */
  className?:    string;
}

// ── FamilyProductTree ─────────────────────────────────────────────────────────

export default function FamilyProductTree({
  locale,
  search = '',
  selectedCode,
  onSelect,
  className,
}: FamilyProductTreeProps) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [scrollTop,        setScrollTop]        = useState(0);
  const [containerH,       setContainerH]       = useState(400);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the scroll container height with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setContainerH(entries[0].contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: famResult, isFetching: famFetching } = useQuery({
    queryKey: ['pim/families'],
    queryFn:  () => familiesApi.list({ limit: 500, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });
  const families = famResult?.rows ?? [];

  // Stable list of expanded family codes — used as useQueries config
  const expandedList = useMemo(() => [...expandedFamilies], [expandedFamilies]);

  // One query per expanded family — TanStack Query caches each by queryKey
  const productQueryResults = useQueries({
    queries: expandedList.map(fc => ({
      queryKey:  ['pim/products-by-family', fc],
      queryFn:   () => productsApi.list({
        filters: { family_code: fc },
        limit:   500,
        sort:    [{ field: 'sort_order', direction: 'asc' }],
      }),
      staleTime: 5 * 60_000,
    })),
  });

  // Map: family code → { loading, rows }
  const productsByFamily = useMemo(() => {
    const map = new Map<string, { loading: boolean; rows: Row[] }>();
    expandedList.forEach((fc, i) => {
      const q = productQueryResults[i];
      map.set(fc, {
        loading: q?.isFetching ?? true,
        rows:    (q?.data as { rows?: Row[] } | undefined)?.rows ?? [],
      });
    });
    return map;
  // productQueryResults identity changes every render — that's expected with useQueries
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedList, productQueryResults]);

  // ── Filtered families ─────────────────────────────────────────────────────

  const q = search.trim().toLowerCase();

  const filteredFamilies = useMemo(() => {
    if (!q) return families;
    return families.filter(f =>
      lbl(f.name, locale).toLowerCase().includes(q) ||
      String(f.code ?? '').toLowerCase().includes(q),
    );
  }, [families, q, locale]);

  // ── Build flat node list ──────────────────────────────────────────────────

  const flatNodes = useMemo<FlatNode[]>(() => {
    const out: FlatNode[] = [];
    for (const fam of filteredFamilies) {
      const fc     = String(fam.code ?? '');
      const isOpen = expandedFamilies.has(fc);
      out.push({ type: 'family', code: fc, label: lbl(fam.name, locale) || fc, isOpen });

      if (isOpen) {
        const entry = productsByFamily.get(fc);
        if (!entry || entry.loading) {
          out.push({ type: 'status', familyCode: fc, kind: 'loading' });
        } else {
          const prods = q
            ? entry.rows.filter(p =>
                lbl(p.name, locale).toLowerCase().includes(q) ||
                String(p.code ?? '').toLowerCase().includes(q),
              )
            : entry.rows;
          if (prods.length === 0) {
            out.push({ type: 'status', familyCode: fc, kind: 'empty' });
          } else {
            for (const p of prods) {
              out.push({
                type:  'product',
                code:  String(p.code ?? ''),
                label: String(p.code ?? ''),
                row:   p,
              });
            }
          }
        }
      }
    }
    return out;
  }, [filteredFamilies, expandedFamilies, productsByFamily, q, locale]);

  // ── Virtual scroll math ───────────────────────────────────────────────────

  const totalH      = flatNodes.length * ITEM_H;
  const firstIdx    = Math.max(0, Math.floor(scrollTop / ITEM_H) - OVERSCAN);
  const lastIdx     = Math.min(flatNodes.length - 1, Math.ceil((scrollTop + containerH) / ITEM_H) + OVERSCAN);
  const visibleNodes = flatNodes.slice(firstIdx, lastIdx + 1);
  const offsetTop    = firstIdx * ITEM_H;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const toggleFamily = useCallback((fc: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      next.has(fc) ? next.delete(fc) : next.add(fc);
      return next;
    });
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  if (famFetching) {
    return (
      <div className={clsx('flex items-center justify-center py-8', className)}>
        <Spinner size="sm" />
      </div>
    );
  }

  if (families.length === 0) {
    return (
      <div className={clsx('flex items-center justify-center py-8 text-xs text-gray-400', className)}>
        No families found
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={clsx('overflow-y-auto select-none', className)}
      onScroll={handleScroll}
    >
      {/* Full-height container so the scrollbar is sized correctly */}
      <div style={{ height: totalH, position: 'relative' }}>
        {/* Only the visible slice is in the DOM */}
        <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
          {visibleNodes.map(node => {
            if (node.type === 'family') {
              return (
                <div
                  key={`fam-${node.code}`}
                  style={{ height: ITEM_H }}
                  onClick={() => toggleFamily(node.code)}
                  className="flex items-center gap-1.5 px-3 cursor-pointer
                             hover:bg-gray-100/70 transition-colors"
                >
                  {node.isOpen
                    ? <ChevronDown  size={11} className="shrink-0 text-gray-400" />
                    : <ChevronRight size={11} className="shrink-0 text-gray-400" />}
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 truncate">
                    {node.label}
                  </span>
                </div>
              );
            }

            if (node.type === 'status') {
              return (
                <div
                  key={`status-${node.familyCode}-${node.kind}`}
                  style={{ height: ITEM_H }}
                  className="flex items-center pl-7 pr-3"
                >
                  {node.kind === 'loading'
                    ? <Spinner size="sm" />
                    : <span className="text-[10px] text-gray-400 italic">No products</span>}
                </div>
              );
            }

            // product
            const isSelected = node.code === selectedCode;
            return (
              <div
                key={`prod-${node.code}`}
                style={{ height: ITEM_H }}
                onClick={() => onSelect(node.row)}
                className={clsx(
                  'flex items-center pl-7 pr-3 cursor-pointer text-xs transition-colors',
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100/70',
                )}
              >
                <span className="truncate">{node.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
