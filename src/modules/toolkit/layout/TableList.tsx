import { useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Table2, ChevronRight, ChevronDown, Layers, X } from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitTablesApi, toolkitSchemasApi } from '@/modules/toolkit/core/api';
import type { ToolkitTable, ToolkitSchema } from '@/types/toolkit';
import { QK } from '@/lib/queryKeys';
import Spinner from '@/components/ui/Spinner';

// ── Inline create-schema form ─────────────────────────────────────────────────

function NewSchemaForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () =>
      toolkitSchemasApi.create({ name: name.trim(), label: label.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.schemas() });
      onClose();
    },
  });

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (name.trim()) mut.mutate(); }}
      className="mx-2 mb-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide">New schema</span>
        <button type="button" onClick={onClose} className="text-indigo-400 hover:text-indigo-600">
          <X size={13} />
        </button>
      </div>
      <div>
        <label className="block text-[10px] font-medium text-indigo-600 mb-1">Name <span className="text-indigo-400 font-normal">(SQL identifier)</span></label>
        <input
          autoFocus
          className="w-full px-2 py-1.5 text-xs border border-indigo-200 rounded-md bg-white font-mono placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="e.g. pim"
          value={name}
          onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
        />
      </div>
      <div>
        <label className="block text-[10px] font-medium text-indigo-600 mb-1">Display label <span className="text-indigo-400 font-normal">(optional)</span></label>
        <input
          className="w-full px-2 py-1.5 text-xs border border-indigo-200 rounded-md bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="e.g. PIM"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={!name.trim() || mut.isPending}
        className="w-full py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {mut.isPending ? 'Creating…' : 'Create schema'}
      </button>
    </form>
  );
}

// ── Schema section ────────────────────────────────────────────────────────────

interface SchemaSectionProps {
  schema: ToolkitSchema;
  tables: ToolkitTable[];
  activeCode: string | undefined;
  search: string;
}

function SchemaSection({ schema, tables, activeCode, search }: SchemaSectionProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const filtered = search
    ? tables.filter(t => t.code.toLowerCase().includes(search.toLowerCase()))
    : tables;

  if (search && filtered.length === 0) return null;

  return (
    <div>
      {/* Schema header */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 group cursor-pointer hover:bg-gray-50"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-gray-400 shrink-0">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
        <Layers size={11} className="text-gray-400 shrink-0" />
        <span className="flex-1 text-[11px] font-bold text-gray-700 tracking-wide truncate">
          {schema.label ?? schema.name}
        </span>
        <span className="text-[9px] text-gray-400 tabular-nums">{tables.length}</span>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/toolkit/tables/new?schema=${schema.name}`); }}
          title={`New table in ${schema.name}`}
          className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Tables */}
      {open && (
        <div className="ml-3 border-l border-gray-100">
          {filtered.length === 0 ? (
            <p className="pl-3 py-2 text-[10px] text-gray-400 italic">No tables</p>
          ) : (
            filtered.map(t => {
              const active = activeCode === t.code;
              return (
                <Link
                  key={t.code}
                  to={`/toolkit/tables/${t.code}/edit`}
                  className={clsx(
                    'flex items-center justify-between pl-3 pr-2 py-1.5 border-l-2 -ml-px transition-colors',
                    active
                      ? 'border-l-indigo-500 bg-indigo-50'
                      : 'border-l-transparent hover:bg-gray-50',
                  )}
                >
                  <p className={clsx('font-medium truncate text-xs', active ? 'text-indigo-700' : 'text-gray-600')}>
                    {t.code}
                  </p>
                  <span className="text-[10px] text-gray-400 ml-2 shrink-0">{t.field_count ?? 0}</span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TableList() {
  const { tableCode } = useParams();
  const [search, setSearch] = useState('');
  const [showNewSchema, setShowNewSchema] = useState(false);

  const { data: schemas = [], isLoading: loadingSchemas } = useQuery<ToolkitSchema[]>({
    queryKey: QK.schemas(),
    queryFn: () => toolkitSchemasApi.list(),
  });

  const { data: tables = [], isLoading: loadingTables } = useQuery<ToolkitTable[]>({
    queryKey: QK.tables(),
    queryFn: () => toolkitTablesApi.list(),
  });

  const tablesBySchema = useMemo(() => {
    const map = new Map<string, ToolkitTable[]>();
    for (const t of tables) {
      if (t.is_system) continue;
      const key = t.schema_name ?? 'public';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tables]);

  // Merge API schemas + any schema_names that appear only in tables
  const allSchemas = useMemo(() => {
    const apiNames = new Set(schemas.map(s => s.name));
    const extra: ToolkitSchema[] = [];
    for (const name of tablesBySchema.keys()) {
      if (!apiNames.has(name)) {
        extra.push({ id: -1, name, table_count: tablesBySchema.get(name)!.length });
      }
    }
    return [...schemas, ...extra];
  }, [schemas, tablesBySchema]);

  const isLoading = loadingSchemas || loadingTables;

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 bg-white">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Schema</span>
        <button
          onClick={() => setShowNewSchema(s => !s)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="New schema"
        >
          <Plus size={13} />
          Add
        </button>
      </div>

      {/* New schema form */}
      {showNewSchema && <NewSchemaForm onClose={() => setShowNewSchema(false)} />}

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            placeholder="Filter tables…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Schema list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        )}

        {!isLoading && allSchemas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Table2 size={24} className="text-gray-300 mb-2" />
            <p className="text-xs text-gray-400">No schemas yet</p>
          </div>
        )}

        {!isLoading && allSchemas.map(schema => (
          <SchemaSection
            key={schema.name}
            schema={schema}
            tables={tablesBySchema.get(schema.name) ?? []}
            activeCode={tableCode}
            search={search}
          />
        ))}
      </div>

    </aside>
  );
}
