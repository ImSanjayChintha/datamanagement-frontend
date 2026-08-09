import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Loader2, X, Search, Check } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { pimCategoriesApi } from '@/modules/pim/api';

// ── Public types ──────────────────────────────────────────────────────────────

export interface CategoryNode {
  code: string;
  name: Record<string, string> | string;
}

// ── Internal tree types ───────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

export function catLabel(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') {
    try { const p = JSON.parse(v) as Record<string, string>; return p.en ?? p[Object.keys(p)[0]] ?? v; }
    catch { return v; }
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, string>;
    return o.en ?? o[Object.keys(o)[0]] ?? '';
  }
  return String(v);
}

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
    id: row.id as number, code: String(row.code ?? row.id),
    raw: row, name: resolveName(row),
    isExpanded: false, isLoading: false,
    hasChildren, childrenLoaded: false, children: [],
  };
}

function updateNodeDeep(nodes: TreeNode[], id: number, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map(n => {
    if (n.id === id) return fn(n);
    if (n.children.length) return { ...n, children: updateNodeDeep(n.children, id, fn) };
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

function findPath(nodes: TreeNode[], targetId: number, current: TreeNode[] = []): TreeNode[] | null {
  for (const n of nodes) {
    const path = [...current, n];
    if (n.id === targetId) return path;
    if (n.children.length) {
      const found = findPath(n.children, targetId, path);
      if (found) return found;
    }
  }
  return null;
}

async function fetchLevel(parentCode: string | null): Promise<TreeNode[]> {
  const res = await pimCategoriesApi.list({ filters: { parent_code: parentCode }, limit: 300 });
  if (res.rows.length === 0) return [];
  const nodes = res.rows.map(r => toTreeNode(r, false));
  try {
    const codes = nodes.map(n => n.code);
    const childCheck = await pimCategoriesApi.list({
      filters: { parent_code: { op: 'in', value: codes } }, limit: 500,
    });
    const withChildren = new Set(childCheck.rows.map(r => String(r.parent_code)));
    return nodes.map(n => ({ ...n, hasChildren: withChildren.has(n.code) }));
  } catch {
    return nodes.map(n => ({ ...n, hasChildren: true }));
  }
}

// ── TreeRow ───────────────────────────────────────────────────────────────────

const ROW_H = 36;

function TreeRow({ node, selected, onToggle, onSelect }: {
  node:     FlatNode;
  selected: boolean;
  onToggle: (n: FlatNode) => void;
  onSelect: (n: FlatNode) => void;
}) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 cursor-pointer select-none transition-colors',
        'border-b border-gray-50 dark:border-gray-800/50',
        selected
          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40',
      )}
      style={{ height: ROW_H, paddingLeft: 10 + node.depth * 18 }}
      onClick={() => onSelect(node)}
    >
      <button
        className={clsx(
          'shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
          !node.hasChildren && 'invisible',
        )}
        onClick={e => { e.stopPropagation(); onToggle(node); }}
      >
        {node.isLoading
          ? <Loader2 size={11} className="animate-spin text-gray-400" />
          : <ChevronRight size={11} className={clsx('text-gray-400 transition-transform', node.isExpanded && 'rotate-90')} />
        }
      </button>
      <span className="flex-1 truncate text-[13px]">{node.name}</span>
      {selected && <Check size={13} className="text-indigo-500 mr-2 shrink-0" />}
    </div>
  );
}

// ── CategoryPicker ────────────────────────────────────────────────────────────

interface Props {
  currentPath?: CategoryNode[] | null;
  onSelect:     (path: CategoryNode[] | null) => void;
  onClose:      () => void;
}

export default function CategoryPicker({ currentPath, onSelect, onClose }: Props) {
  const [roots,       setRoots]       = useState<TreeNode[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [previewPath, setPreviewPath] = useState<CategoryNode[] | null>(currentPath ?? null);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    fetchLevel(null)
      .then(nodes => { setRoots(nodes); setLoading(false); })
      .catch(() => { toast.error('Failed to load categories'); setLoading(false); });
  }, []);

  async function toggleExpand(node: FlatNode) {
    if (node.isExpanded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: false })));
      return;
    }
    if (node.childrenLoaded) {
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isExpanded: true })));
      return;
    }
    setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: true })));
    try {
      const children = await fetchLevel(node.code);
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({
        ...n, isLoading: false, isExpanded: children.length > 0,
        hasChildren: children.length > 0, childrenLoaded: true, children,
      })));
    } catch {
      toast.error('Failed to load');
      setRoots(prev => updateNodeDeep(prev, node.id, n => ({ ...n, isLoading: false })));
    }
  }

  function selectNode(node: FlatNode) {
    setSelectedId(node.id);
    const pathNodes = findPath(roots, node.id) ?? [node];
    const path: CategoryNode[] = pathNodes.map(n => ({
      code: n.code,
      name: n.raw.name as Record<string, string> | string,
    }));
    setPreviewPath(path);
  }

  function clear() {
    setSelectedId(null);
    setPreviewPath(null);
  }

  const flat = useMemo(() => flattenTree(roots), [roots]);

  // Simple text search — filter flat list by name match (only root-visible nodes)
  const visibleFlat = useMemo(() => {
    if (!search.trim()) return flat;
    const q = search.toLowerCase();
    return flat.filter(n => n.name.toLowerCase().includes(q));
  }, [flat, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[520px] max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Select Category</h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Navigate the hierarchy and click a category to select it
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
              placeholder="Search categories…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Spinner /></div>
          ) : visibleFlat.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              {search ? 'No categories match your search' : 'No categories found'}
            </div>
          ) : (
            <div>
              {visibleFlat.map(node => (
                <TreeRow
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  onToggle={toggleExpand}
                  onSelect={selectNode}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selected path preview */}
        <div className={clsx(
          'shrink-0 px-5 py-3 border-t border-gray-100 dark:border-gray-800 transition-all',
          previewPath ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-gray-50 dark:bg-gray-800/40',
        )}>
          {previewPath ? (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mr-1">Selected:</span>
              {previewPath.map((n, i) => (
                <span key={n.code} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={11} className="text-indigo-300" />}
                  <span className="text-[12px] font-medium text-indigo-700 dark:text-indigo-300">
                    {catLabel(n.name)}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-gray-400 italic">No category selected</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={clear}
            disabled={!previewPath}
            className="text-sm text-gray-500 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear selection
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { onSelect(previewPath); onClose(); }}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
