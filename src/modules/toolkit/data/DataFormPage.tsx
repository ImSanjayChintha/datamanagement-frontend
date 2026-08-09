import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { toolkitTablesApi, toolkitDataApi } from '@/modules/toolkit/core/api';
import { QK } from '@/lib/queryKeys';
import Spinner from '@/components/ui/Spinner';
import TranslationInput from '@/components/ui/TranslationInput';
import DynamicFieldInput from '@/components/ui/DynamicFieldInput';
import toast from 'react-hot-toast';

type FormValues = Record<string, unknown>;

interface Props {
  tableCode?: string;
  basePath?: string;
}

export default function DataFormPage({ tableCode: tcProp, basePath }: Props = {}) {
  const { tableCode: tcParam, id } = useParams<{ tableCode?: string; id?: string }>();
  const tableCode = tcProp ?? tcParam;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;
  const [values, setValues] = useState<FormValues>({});

  const { data: tableDef, isLoading: loadingMeta } = useQuery({
    queryKey: QK.table(tableCode!),
    queryFn: () => toolkitTablesApi.getByCode(tableCode!),
    enabled: !!tableCode,
  });

  const { data: existing, isLoading: loadingRecord } = useQuery({
    queryKey: QK.record(tableCode!, id),
    queryFn: () => toolkitDataApi.get(tableCode!, Number(id)),
    enabled: isEdit,
  });

  // Populate form from existing record when editing
  useEffect(() => {
    if (!existing || !tableDef) return;
    const rec = existing as Record<string, unknown>;
    const init: FormValues = {};
    for (const f of tableDef.fields) {
      if (f.is_system) continue;
      if (f.is_multilingual) {
        init[f.code] = (rec._translations as Record<string, Record<string, string>>)?.[f.code] ?? {};
      } else {
        init[f.code] = rec[f.code] ?? '';
      }
    }
    init.is_active = rec.is_active ?? true;
    init.sort_order = rec.sort_order ?? 0;
    if (tableDef.has_label) {
      init._label_translations = (rec._translations as Record<string, Record<string, string>>)?.['label'] ?? {};
    }
    setValues(init);
  }, [existing, tableDef]);

  // Set defaults for new record
  useEffect(() => {
    if (isEdit || !tableDef) return;
    const init: FormValues = { is_active: true, sort_order: 0 };
    for (const f of tableDef.fields) {
      if (f.is_system) continue;
      if (f.is_multilingual) init[f.code] = {};
      else if (f.field_type === 'toggle') init[f.code] = f.default_value === 'true';
      else init[f.code] = f.default_value ?? '';
    }
    if (tableDef.has_label) init._label_translations = {};
    setValues(init);
  }, [tableDef, isEdit]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: FormValues = { ...values };
      if (tableDef?.has_label) {
        payload._label_translations = values._label_translations;
      }
      if (isEdit) return toolkitDataApi.update(tableCode!, { id: Number(id), ...payload });
      return toolkitDataApi.create(tableCode!, payload);
    },
    onSuccess: () => {
      const listPath = basePath ?? `/toolkit/tables/${tableCode}/data`;
      toast.success(isEdit ? 'Record updated' : 'Record created');
      qc.invalidateQueries({ queryKey: QK.data(tableCode!) });
      navigate(listPath);
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  function set(field: string, val: unknown) {
    setValues(prev => ({ ...prev, [field]: val }));
  }

  const listPath = basePath ?? `/toolkit/tables/${tableCode}/data`;

  if (loadingMeta || (isEdit && loadingRecord)) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }
  if (!tableDef) return <p className="text-red-500">Table not found: {tableCode}</p>;

  const customFields = tableDef.fields.filter(f => !f.is_system);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link to={listPath} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit record' : `New ${tableDef.label}`}
          </h1>
        </div>
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="btn-primary flex items-center gap-2"
        >
          {saveMut.isPending ? <Spinner size="sm" /> : <Save size={14} />}
          {isEdit ? 'Save changes' : 'Create'}
        </button>
      </div>

      <form onSubmit={e => { e.preventDefault(); saveMut.mutate(); }} className="card p-6 space-y-5">
        {/* Multilingual label (if table has_label) */}
        {tableDef.has_label && (
          <TranslationInput
            fieldCode="label"
            label="Label"
            value={(values._label_translations as Record<string, string>) ?? {}}
            onChange={v => set('_label_translations', v)}
            required
          />
        )}

        {customFields.map(f => (
          <div key={f.id}>
            <label className="label">
              {f.label}
              {f.is_required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {f.description && <p className="helper mb-1">{f.description}</p>}
            <DynamicFieldInput
              field={f}
              value={values[f.code]}
              onChange={v => set(f.code, v)}
              fieldOptions={f.field_type === 'inline_select'
                ? (tableDef.options ?? []).filter(o => o.field_id === f.id)
                : undefined}
            />
          </div>
        ))}

        <hr className="border-gray-100" />

        {/* Standard system fields editable inline */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Sort order</label>
            <input
              type="number"
              step="1"
              className="input"
              value={String(values.sort_order ?? 0)}
              onChange={e => set('sort_order', Number(e.target.value))}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!values.is_active}
                onChange={e => set('is_active', e.target.checked)}
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>
      </form>
    </div>
  );
}
