import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, X, ChevronDown, ChevronRight, Search, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import { makeEntityApi } from '@/modules/pim/api';

// ── API instances ─────────────────────────────────────────────────────────────

const familiesApi  = makeEntityApi('families',         'families');
const groupsApi    = makeEntityApi('attribute_groups', 'attribute_groups');
const attrsApi     = makeEntityApi('attributes',       'attributes');
const famAttrsApi  = makeEntityApi('family_attributes','family_attributes');

// ── Types ─────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

interface DraftEntry {
  existingId?:  string;
  is_required:  boolean;
  sort_order:   number;
}

// ── Helper: resolve multilingual JSONB or plain string ────────────────────────

function label(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v) as Record<string, string>;
      return p.en ?? p[Object.keys(p)[0]] ?? v;
    } catch { return v; }
  }
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, string>;
    return o.en ?? o[Object.keys(o)[0]] ?? '';
  }
  return String(v);
}

// ── AddGroupMenu ──────────────────────────────────────────────────────────────

function AddGroupMenu({ groups, onAdd }: { groups: Row[]; onAdd: (code: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => label(g.name).toLowerCase().includes(q));
  }, [groups, search]);

  if (groups.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg
                   bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white
                   transition-colors shadow-sm"
      >
        <Plus size={14} />
        Add Attribute Group
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 z-30
                        bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-700
                        rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 text-gray-400">
              <Search size={13} />
              <input
                autoFocus
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                placeholder="Search groups…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 italic text-center">No groups found</p>
            ) : filtered.map(g => (
              <button
                key={g.code as string}
                type="button"
                onClick={() => { onAdd(g.code as string); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm
                           text-gray-700 dark:text-gray-200
                           hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                {label(g.name)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FamilyAttributesPage() {
  const qc = useQueryClient();

  const [selectedFamily, setSelectedFamily] = useState('');
  const [familySearch,   setFamilySearch]   = useState('');
  const [visibleGroups,  setVisibleGroups]  = useState<string[]>([]);
  const [collapsed,      setCollapsed]      = useState<Set<string>>(new Set());
  const [draft,          setDraft]          = useState<Map<string, DraftEntry>>(new Map());
  const [saving,         setSaving]         = useState(false);

  // ── Reference data ─────────────────────────────────────────────────────────

  const { data: familyRes } = useQuery({
    queryKey: ['pim-families-all'],
    queryFn:  () => familiesApi.list({ limit: 500, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });
  const { data: groupRes } = useQuery({
    queryKey: ['pim-attr-groups-all'],
    queryFn:  () => groupsApi.list({ limit: 500, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });
  const { data: attrRes } = useQuery({
    queryKey: ['pim-attrs-all'],
    queryFn:  () => attrsApi.list({ limit: 2000, sort: [{ field: 'sort_order', direction: 'asc' }] }),
    staleTime: 5 * 60_000,
  });

  // ── Family-specific assignments ────────────────────────────────────────────

  const { data: assignRes, isLoading: loadingAssign } = useQuery({
    queryKey: ['pim-family-attrs', selectedFamily],
    queryFn:  () => famAttrsApi.list({
      filters: { family_code: selectedFamily, is_active: true },
      limit: 2000,
    }),
    enabled:   !!selectedFamily,
    staleTime: 0,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const families    = useMemo(() => (familyRes?.rows  ?? []) as Row[], [familyRes]);
  const allGroups   = useMemo(() => (groupRes?.rows   ?? []) as Row[], [groupRes]);
  const allAttrs    = useMemo(() => (attrRes?.rows    ?? []) as Row[], [attrRes]);
  const assignments = useMemo(() => (assignRes?.rows  ?? []) as Row[], [assignRes]);

  const filteredFamilies = useMemo(() => {
    if (!familySearch.trim()) return families;
    const q = familySearch.toLowerCase();
    return families.filter(f => label(f.name).toLowerCase().includes(q)
      || (f.code as string).toLowerCase().includes(q));
  }, [families, familySearch]);

  const groupMap = useMemo(
    () => new Map(allGroups.map(g => [g.code as string, g])),
    [allGroups],
  );

  const attrsByGroup = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const a of allAttrs) {
      const gc = a.group_code as string;
      if (!map.has(gc)) map.set(gc, []);
      map.get(gc)!.push(a);
    }
    return map;
  }, [allAttrs]);

  const attrGroupMap = useMemo(
    () => new Map(allAttrs.map(a => [a.code as string, a.group_code as string])),
    [allAttrs],
  );

  const availableGroups = useMemo(
    () => allGroups.filter(g => !visibleGroups.includes(g.code as string)),
    [allGroups, visibleGroups],
  );

  // ── Reset on family change, then init draft from assignments ───────────────

  useEffect(() => {
    setDraft(new Map());
    setVisibleGroups([]);
    setCollapsed(new Set());
  }, [selectedFamily]);

  useEffect(() => {
    if (!assignRes || !selectedFamily) return;
    const newDraft = new Map<string, DraftEntry>();
    const groupsToShow = new Set<string>();
    for (const row of assignments) {
      const attrCode = row.attribute_code as string;
      newDraft.set(attrCode, {
        existingId:  row.id as string,
        is_required: !!(row.is_required),
        sort_order:  (row.sort_order as number) ?? 0,
      });
      const gc = attrGroupMap.get(attrCode);
      if (gc) groupsToShow.add(gc);
    }
    setDraft(newDraft);
    setVisibleGroups(prev => [...new Set([...prev, ...groupsToShow])]);
  }, [assignRes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draft mutations ────────────────────────────────────────────────────────

  function toggleAttr(attrCode: string) {
    setDraft(prev => {
      const next = new Map(prev);
      if (next.has(attrCode)) {
        next.delete(attrCode);
      } else {
        const maxOrder = Math.max(0, ...[...next.values()].map(v => v.sort_order));
        next.set(attrCode, { is_required: false, sort_order: maxOrder + 1 });
      }
      return next;
    });
  }

  function updateEntry(attrCode: string, patch: Partial<DraftEntry>) {
    setDraft(prev => {
      const next = new Map(prev);
      const cur  = next.get(attrCode);
      if (cur) next.set(attrCode, { ...cur, ...patch });
      return next;
    });
  }

  function selectAllInGroup(groupCode: string) {
    const attrs = attrsByGroup.get(groupCode) ?? [];
    setDraft(prev => {
      const next = new Map(prev);
      const maxOrder = Math.max(0, ...[...next.values()].map(v => v.sort_order));
      let order = maxOrder;
      for (const a of attrs) {
        const code = a.code as string;
        if (!next.has(code)) {
          next.set(code, { is_required: false, sort_order: ++order });
        }
      }
      return next;
    });
  }

  function deselectAllInGroup(groupCode: string) {
    const codes = new Set((attrsByGroup.get(groupCode) ?? []).map(a => a.code as string));
    setDraft(prev => {
      const next = new Map(prev);
      for (const c of codes) next.delete(c);
      return next;
    });
  }

  function addGroup(groupCode: string) {
    setVisibleGroups(prev => prev.includes(groupCode) ? prev : [...prev, groupCode]);
  }

  function removeGroup(groupCode: string) {
    deselectAllInGroup(groupCode);
    setVisibleGroups(prev => prev.filter(c => c !== groupCode));
  }

  function toggleCollapse(groupCode: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(groupCode) ? next.delete(groupCode) : next.add(groupCode);
      return next;
    });
  }

  // ── Change count ───────────────────────────────────────────────────────────

  const changeCount = useMemo(() => {
    const exMap = new Map(assignments.map(r => [r.attribute_code as string, r]));
    let n = 0;
    for (const [code, entry] of draft.entries()) {
      const ex = exMap.get(code);
      if (!ex || Boolean(ex.is_required) !== entry.is_required || (ex.sort_order as number) !== entry.sort_order) n++;
    }
    for (const code of exMap.keys()) {
      if (!draft.has(code)) n++;
    }
    return n;
  }, [draft, assignments]);

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!selectedFamily || saving || changeCount === 0) return;
    setSaving(true);
    try {
      const exMap = new Map(assignments.map(r => [r.attribute_code as string, r]));
      const ops: Promise<unknown>[] = [];

      for (const [attrCode, entry] of draft.entries()) {
        const ex = exMap.get(attrCode);
        if (!ex) {
          ops.push(famAttrsApi.upsert({
            code: `${selectedFamily}__${attrCode}`,
            family_code: selectedFamily, attribute_code: attrCode,
            is_required: entry.is_required, sort_order: entry.sort_order, is_active: true,
          }));
        } else if (Boolean(ex.is_required) !== entry.is_required || (ex.sort_order as number) !== entry.sort_order) {
          ops.push(famAttrsApi.upsert({
            id: ex.id, code: ex.code,
            family_code: selectedFamily, attribute_code: attrCode,
            is_required: entry.is_required, sort_order: entry.sort_order, is_active: true,
          }));
        }
      }
      for (const [attrCode, ex] of exMap.entries()) {
        if (!draft.has(attrCode)) ops.push(famAttrsApi.delete(ex.id as string));
      }

      await Promise.all(ops);
      toast.success('Saved successfully');
      qc.invalidateQueries({ queryKey: ['pim-family-attrs', selectedFamily] });
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedFamilyRow = families.find(f => f.code === selectedFamily);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="shrink-0 flex items-center gap-4 px-6 py-3
                         bg-white dark:bg-gray-900
                         border-b border-gray-200 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 leading-none mb-0.5">pim</p>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
            Family Attributes
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {selectedFamily && changeCount > 0 && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
              {changeCount} unsaved change{changeCount !== 1 ? 's' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedFamily || changeCount === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold
                       bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? <Spinner size="sm" /> : <Save size={13} />}
            Save changes
          </button>
        </div>
      </header>

      {/* ── Two-panel body ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Family list ── */}
        <div className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
              Families
            </p>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input
                className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
                placeholder="Search…"
                value={familySearch}
                onChange={e => setFamilySearch(e.target.value)}
              />
              {familySearch && (
                <button onClick={() => setFamilySearch('')} className="text-gray-300 hover:text-gray-500">
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {filteredFamilies.length === 0 && (
              <p className="px-4 py-3 text-xs text-gray-400 italic text-center">No families found</p>
            )}
            {filteredFamilies.map(f => {
              const code    = f.code as string;
              const isActive = code === selectedFamily;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedFamily(code)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <p className={`text-[12px] font-medium leading-tight truncate ${isActive ? 'text-white' : ''}`}>
                    {label(f.name)}
                  </p>
                  <p className={`text-[11px] font-mono leading-none mt-0.5 truncate ${
                    isActive ? 'text-indigo-200' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {code}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Groups + Attributes ── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* No family selected */}
          {!selectedFamily && (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400 dark:text-gray-500">
              <Layers size={36} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a family</p>
              <p className="text-xs mt-1 text-gray-400">Choose a family from the left panel to manage its attributes.</p>
            </div>
          )}

          {/* Loading */}
          {selectedFamily && loadingAssign && (
            <div className="flex items-center justify-center flex-1">
              <Spinner size="lg" />
            </div>
          )}

          {/* Content */}
          {selectedFamily && !loadingAssign && (
            <>
              {/* Toolbar */}
              <div className="shrink-0 flex items-center gap-4 px-5 py-3
                              bg-white dark:bg-gray-900
                              border-b border-gray-200 dark:border-gray-800">
                <AddGroupMenu groups={availableGroups} onAdd={addGroup} />

                <div className="flex-1" />

                {/* Summary */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    Family:{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {label(selectedFamilyRow?.name)}
                    </span>
                  </span>
                  <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                  <span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{draft.size}</span>
                    {' '}attribute{draft.size !== 1 ? 's' : ''} assigned
                  </span>
                </div>
              </div>

              {/* Attribute list */}
              <div className="flex-1 overflow-y-auto">

                {/* Empty state — no groups added */}
                {visibleGroups.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <Layers size={32} className="mb-3 opacity-20" />
                    <p className="text-sm font-medium">No attribute groups added</p>
                    <p className="text-xs mt-1">Use "Add Attribute Group" to start assigning attributes to this family.</p>
                  </div>
                )}

                {/* Sticky column header */}
                {visibleGroups.length > 0 && (
                  <div className="sticky top-0 z-10
                                  grid grid-cols-[1fr_110px_80px_76px_36px] gap-0
                                  bg-gray-100 dark:bg-gray-800
                                  border-b border-gray-200 dark:border-gray-700
                                  px-5 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Attribute</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Type</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">Required</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 text-center">Order</span>
                    <span />
                  </div>
                )}

                {/* Groups */}
                {visibleGroups.map(groupCode => {
                  const group      = groupMap.get(groupCode);
                  const groupAttrs = attrsByGroup.get(groupCode) ?? [];
                  const isCollapsed = collapsed.has(groupCode);
                  const assigned   = groupAttrs.filter(a => draft.has(a.code as string)).length;
                  const allAssigned = assigned === groupAttrs.length && groupAttrs.length > 0;

                  return (
                    <div key={groupCode}>

                      {/* Group header */}
                      <div className="flex items-center gap-3 px-5 py-2.5
                                      bg-gray-50 dark:bg-gray-800/80
                                      border-b border-gray-200 dark:border-gray-700
                                      sticky top-[33px] z-[5]">
                        <button
                          type="button"
                          onClick={() => toggleCollapse(groupCode)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          {isCollapsed
                            ? <ChevronRight size={13} className="text-gray-400 shrink-0" />
                            : <ChevronDown  size={13} className="text-gray-400 shrink-0" />
                          }
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 truncate">
                            {label(group?.name) || groupCode}
                          </span>
                          <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            assigned > 0
                              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}>
                            {assigned} / {groupAttrs.length}
                          </span>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Select / deselect all */}
                          <button
                            type="button"
                            onClick={() => allAssigned ? deselectAllInGroup(groupCode) : selectAllInGroup(groupCode)}
                            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {allAssigned ? 'Deselect all' : 'Select all'}
                          </button>

                          <span className="w-px h-3.5 bg-gray-300 dark:bg-gray-600" />

                          <button
                            type="button"
                            onClick={() => removeGroup(groupCode)}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Attribute rows */}
                      {!isCollapsed && (
                        <div className="pim-attr-list divide-y divide-gray-100 dark:divide-gray-800">
                          {groupAttrs.map(attr => {
                            const attrCode   = attr.code as string;
                            const entry      = draft.get(attrCode);
                            const isAssigned = !!entry;

                            return (
                              <div
                                key={attrCode}
                                onClick={() => !isAssigned && toggleAttr(attrCode)}
                                className={`grid grid-cols-[1fr_110px_80px_76px_36px] gap-0 items-center px-5 py-2.5 transition-colors ${
                                  isAssigned
                                    ? 'bg-white dark:bg-gray-900'
                                    : 'bg-gray-50/60 dark:bg-gray-900/40 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10'
                                }`}
                              >
                                {/* Checkbox + name */}
                                <div className="flex items-center gap-3 min-w-0 pr-4">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-indigo-600 cursor-pointer shrink-0"
                                    checked={isAssigned}
                                    onChange={() => toggleAttr(attrCode)}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <div className="min-w-0">
                                    <p className={`truncate leading-tight ${
                                      isAssigned
                                        ? 'font-medium text-gray-900 dark:text-gray-100'
                                        : 'text-gray-500 dark:text-gray-400'
                                    }`}>
                                      {label(attr.name)}
                                    </p>
                                    <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                                      {attrCode}
                                    </p>
                                  </div>
                                </div>

                                {/* Type badge */}
                                <div>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                                    isAssigned
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                  }`}>
                                    {attr.attr_type as string}
                                  </span>
                                </div>

                                {/* Required */}
                                <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                  {isAssigned ? (
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-indigo-600 cursor-pointer"
                                      checked={entry.is_required}
                                      onChange={e => updateEntry(attrCode, { is_required: e.target.checked })}
                                    />
                                  ) : (
                                    <span className="text-gray-200 dark:text-gray-700">—</span>
                                  )}
                                </div>

                                {/* Sort order */}
                                <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                  {isAssigned ? (
                                    <input
                                      type="number"
                                      className="w-14 h-7 text-center text-xs font-mono rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                      value={entry.sort_order}
                                      min={0}
                                      onChange={e => updateEntry(attrCode, { sort_order: Number(e.target.value) })}
                                    />
                                  ) : (
                                    <span className="text-gray-200 dark:text-gray-700">—</span>
                                  )}
                                </div>

                                {/* Remove */}
                                <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                                  {isAssigned && (
                                    <button
                                      type="button"
                                      onClick={() => toggleAttr(attrCode)}
                                      className="p-1 rounded text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                      title="Unassign"
                                    >
                                      <X size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bottom padding */}
                {visibleGroups.length > 0 && <div className="h-6" />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
