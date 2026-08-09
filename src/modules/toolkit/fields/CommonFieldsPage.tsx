import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, Languages, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { commonFieldsApi, DATA_TYPES } from '@/modules/toolkit/core/api';
import type { CommonField } from '@/modules/toolkit/core/api';
import { QK } from '@/lib/queryKeys';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent',
          'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1',
          checked ? 'bg-indigo-600' : 'bg-gray-200',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
            'transform transition-transform duration-150',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      <div className="pt-0.5">
        <p className="text-xs font-medium text-gray-700 leading-tight">{label}</p>
        {description && <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

const TYPE_COLOUR: Record<string, string> = {
  text: 'bg-blue-50 text-blue-700', email: 'bg-blue-50 text-blue-700',
  phone: 'bg-blue-50 text-blue-700', url: 'bg-blue-50 text-blue-700',
  color: 'bg-blue-50 text-blue-700', integer: 'bg-violet-50 text-violet-700',
  number: 'bg-violet-50 text-violet-700', boolean: 'bg-amber-50 text-amber-700',
  date: 'bg-green-50 text-green-700', datetime: 'bg-green-50 text-green-700',
  select: 'bg-orange-50 text-orange-700', multiselect: 'bg-orange-50 text-orange-700',
  json: 'bg-gray-100 text-gray-600',
};

interface FieldForm {
  code: string;
  field_name: string;
  data_type: string;
  field_role: 'user' | 'log';
  sort_order: number;
  show_translation: boolean;
  default_value: string;
  true_label: string;
  false_label: string;
  is_active: boolean;
}

const EMPTY_FORM: FieldForm = {
  code: '', field_name: '', data_type: 'text', field_role: 'user',
  sort_order: 0, show_translation: true,
  default_value: '', true_label: '', false_label: '',
  is_active: true,
};

export default function CommonFieldsPage() {
  const qc       = useQueryClient();
  const navigate = useNavigate();

  const [roleFilter, setRoleFilter]     = useState<'all' | 'user' | 'log'>('all');
  const [search, setSearch]             = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal]               = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing]           = useState<CommonField | null>(null);
  const [form, setForm]                 = useState<FieldForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<CommonField | null>(null);

  const { data: fields = [], isLoading } = useQuery<CommonField[]>({
    queryKey: QK.commonFields(roleFilter === 'all' ? undefined : roleFilter, search, showInactive),
    queryFn:  () => commonFieldsApi.list({
      search:     search || undefined,
      is_active:  showInactive ? undefined : true,
      field_role: roleFilter === 'all' ? undefined : roleFilter,
    }),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['toolkit-common-fields'] });

  const createMut = useMutation({
    mutationFn: (f: FieldForm) => commonFieldsApi.create(f),
    onSuccess: () => { toast.success('Field created'); closeModal(); invalidate(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (f: FieldForm) => commonFieldsApi.update(editing!.id, f),
    onSuccess: () => { toast.success('Field updated'); closeModal(); invalidate(); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => commonFieldsApi.delete(id, true),
    onSuccess:  () => { toast.success('Field deactivated'); setDeleteTarget(null); invalidate(); },
    onError:    (e: Error) => toast.error(e.message),
  });

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setModal('create'); }

  function openEdit(f: CommonField) {
    setEditing(f);
    setForm({
      code:             f.code,
      field_name:       f.field_name,
      data_type:        f.data_type,
      field_role:       f.field_role,
      sort_order:       f.sort_order,
      show_translation: f.show_translation,
      default_value:    f.default_value  ?? '',
      true_label:       f.true_label     ?? '',
      false_label:      f.false_label    ?? '',
      is_active:        f.is_active,
    });
    setModal('edit');
  }

  function closeModal() { setModal(null); setEditing(null); setForm(EMPTY_FORM); }
  function setF<K extends keyof FieldForm>(k: K, v: FieldForm[K]) { setForm(prev => ({ ...prev, [k]: v })); }
  function handleSubmit() { if (modal === 'create') createMut.mutate(form); else updateMut.mutate(form); }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return fields.filter(f => !q || f.code.includes(q) || f.field_name.toLowerCase().includes(q));
  }, [fields, search]);

  const userFields = filtered.filter(f => f.field_role === 'user');
  const logFields  = filtered.filter(f => f.field_role === 'log');

  function FieldRow({ f }: { f: CommonField }) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
        <span className="w-6 text-[10px] text-gray-300 font-mono text-right shrink-0">{f.sort_order}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-gray-800">{f.field_name}</span>
            <span className="text-[10px] font-mono text-gray-400">{f.code}</span>
          </div>
        </div>
        <span className={clsx(
          'text-[10px] font-mono px-1.5 py-0.5 rounded',
          TYPE_COLOUR[f.data_type] ?? 'bg-gray-100 text-gray-600'
        )}>{f.data_type}</span>
        {f.show_translation
          ? <span title="Shown in Translation tab"><Languages size={12} className="text-indigo-400 shrink-0" /></span>
          : <span title="Hidden from Translation tab"><Languages size={12} className="text-gray-200 shrink-0" /></span>
        }
        {!f.is_active && (
          <span className="text-[9px] bg-red-50 text-red-400 px-1.5 py-0.5 rounded">inactive</span>
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => openEdit(f)}
            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => setDeleteTarget(f)}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50"
            title="Deactivate"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  function Section({ title, items, role }: { title: string; items: CommonField[]; role: string }) {
    if (roleFilter !== 'all' && roleFilter !== role) return null;
    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
            <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">{items.length}</span>
          </div>
          <span className="text-[10px] text-gray-400">
            {role === 'user' ? 'Appear in Key Fields section' : 'Appear in Log Fields section'}
          </span>
        </div>
        {items.length === 0
          ? <p className="px-4 py-4 text-[12px] text-gray-400 text-center">No {title.toLowerCase()} fields</p>
          : <div className="divide-y divide-gray-100">{items.map(f => <FieldRow key={f.id} f={f} />)}</div>
        }
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="px-6 pt-3 pb-6 space-y-4">

        {/* Header */}
        <div className="page-header">
          <h1 className="pim-title">Common Fields</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/toolkit/common-fields/translations')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 transition-colors shrink-0"
            >
              <Globe size={13} /> Translations
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors shrink-0 shadow-sm"
            >
              <Plus size={13} strokeWidth={2.5} /> New Field
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <input
            className="input flex-1 text-sm h-8"
            placeholder="Search fields…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1">
            {(['all', 'user', 'log'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={clsx(
                  'px-3 h-8 text-xs rounded-md font-medium transition-colors',
                  roleFilter === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {r === 'all' ? 'All' : r === 'user' ? 'User' : 'Log'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowInactive(v => !v)}
            className={clsx(
              'h-8 px-2 rounded-md border text-xs flex items-center gap-1 transition-colors',
              showInactive
                ? 'border-indigo-300 text-indigo-600 bg-indigo-50'
                : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'
            )}
            title={showInactive ? 'Showing all' : 'Showing active only'}
          >
            {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        </div>

        {/* Lists */}
        {isLoading
          ? <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>
          : <>
              <Section title="User Fields" items={userFields} role="user" />
              <Section title="Log Fields"  items={logFields}  role="log" />
            </>
        }
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                {modal === 'create' ? 'New Common Field' : 'Edit Common Field'}
              </h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* code + field_name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Code</label>
                  <input
                    className="input"
                    value={form.code}
                    onChange={e => setF('code', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    disabled={modal === 'edit'}
                    placeholder="e.g. field_name"
                  />
                </div>
                <div>
                  <label className="label">Field Name (English)</label>
                  <input
                    className="input"
                    value={form.field_name}
                    onChange={e => setF('field_name', e.target.value)}
                    placeholder="e.g. Name"
                  />
                </div>
              </div>

              {/* data_type + field_role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Data Type</label>
                  <select className="input" value={form.data_type} onChange={e => setF('data_type', e.target.value)}>
                    {Object.entries(
                      DATA_TYPES.reduce<Record<string, typeof DATA_TYPES>>((acc, dt) => {
                        (acc[dt.group] ??= []).push(dt); return acc;
                      }, {})
                    ).map(([group, opts]) => (
                      <optgroup key={group} label={group}>
                        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Field Role</label>
                  <div className="flex gap-2 mt-1">
                    {(['user', 'log'] as const).map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setF('field_role', r)}
                        className={clsx(
                          'flex-1 py-1.5 text-xs rounded-md border font-medium transition-colors',
                          form.field_role === r
                            ? r === 'user'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        {r === 'user' ? 'User' : 'Log'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {form.field_role === 'user'
                      ? 'Appears in Key Fields (id, code, name…)'
                      : 'Appears in Log Fields (sort_order, is_active, audit…)'}
                  </p>
                </div>
              </div>

              {/* sort_order + default_value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Sort Order</label>
                  <input
                    type="number"
                    className="input"
                    value={form.sort_order}
                    onChange={e => setF('sort_order', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="label">Default Value</label>
                  {form.data_type === 'boolean' ? (
                    <select
                      className="input"
                      value={form.default_value}
                      onChange={e => setF('default_value', e.target.value)}
                    >
                      <option value="">(none)</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      className="input"
                      placeholder="e.g. 0 or leave empty"
                      value={form.default_value}
                      onChange={e => setF('default_value', e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* true_label / false_label — only for boolean fields */}
              {form.data_type === 'boolean' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Label when ON (true)</label>
                    <input
                      className="input"
                      placeholder="e.g. Active"
                      value={form.true_label}
                      onChange={e => setF('true_label', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Label when OFF (false)</label>
                    <input
                      className="input"
                      placeholder="e.g. Inactive"
                      value={form.false_label}
                      onChange={e => setF('false_label', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* toggles */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <Toggle
                  checked={form.show_translation}
                  onChange={v => setF('show_translation', v)}
                  label="Show in Translation tab"
                  description="Field label will appear in the Translations grid for every table"
                />
                <Toggle
                  checked={form.is_active}
                  onChange={v => setF('is_active', v)}
                  label="Active"
                  description="Inactive fields are hidden from new table defaults"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={closeModal} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="btn-primary text-sm"
              >
                {modal === 'create' ? 'Create Field' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Deactivate field"
        message={`Deactivate "${deleteTarget?.field_name}" (${deleteTarget?.code})? It will no longer appear in new table defaults.`}
        confirmLabel="Deactivate"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
