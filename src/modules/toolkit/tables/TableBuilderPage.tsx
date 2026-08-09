import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2, Terminal, Trash2, Languages, Save, TableProperties, Cable, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitTablesApi, toolkitOptionsApi, toolkitDataApi, toolkitFieldsApi, commonFieldsApi } from '@/modules/toolkit/core/api';
import type { CommonField } from '@/modules/toolkit/core/api';
import { QK } from '@/lib/queryKeys';
import type { ToolkitTable, ToolkitTableDetail } from '@/types/toolkit';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import { type FieldDraft, type TableForm, newField } from './tableBuilder.types';
import { DEFAULT_FIELDS, DEFAULT_FIELD_CODES, BACKEND_MANAGED_FIELD_CODES } from '@/modules/toolkit/config/tableDefaults';
import type { DefaultField } from '@/modules/toolkit/config/tableDefaults';
import type { FieldType } from '@/types/toolkit';
import TableDesignerTab from './TableDesignerTab';
import AIGenerateTab from './AIGenerateTab';
import PreviewDdlTab from './PreviewDdlTab';
import TranslateTab from './TranslateTab';
import TranslateTabComplete from './TranslateTabComplete';
import ApiTab from './ApiTab';

const TABS = ['Table Designer', 'Translations', 'AI Generate', 'Preview DDL', 'API'] as const;
type Tab = typeof TABS[number];
type DefaultOverride = { description: string; true_label?: string; false_label?: string };

export default function TableBuilderPage() {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isEdit = !!tableCode;

  const [tab, setTab] = useState<Tab>('Table Designer');
  useEffect(() => { setTab('Table Designer'); }, [tableCode]);
  const [tableForm, setTableForm] = useState<TableForm>({
    code: '', description: '', schema_name: searchParams.get('schema') ?? 'public',
  });
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [defaultFieldI18n, setDefaultFieldI18n] = useState<Record<string, Record<string, string>>>({});
  type AssociatedObjects = {
    views:     { code: string; schema_name: string }[];
    functions: { code: string; schema_name: string }[];
    apis:      { id: number; name: string; url_path: string; method: string; status: string }[];
    page_defs: { id: number; code: string; title: string }[];
  };
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    rowCount: number;
    checking: boolean;
    associated: AssociatedObjects | null;
    step: 1 | 2;
  }>({ open: false, rowCount: 0, checking: false, associated: null, step: 2 });
  const [defaultOverrides, setDefaultOverrides] = useState<Record<string, DefaultOverride>>({});
  const hydratedIdRef = useRef<number | null>(null);

  const { data: allTables = [] } = useQuery<ToolkitTable[]>({
    queryKey: QK.tables(),
    queryFn: () => toolkitTablesApi.list(),
  });

  const { data: commonFields = [] } = useQuery({
    queryKey: QK.commonFields(),
    queryFn:  () => commonFieldsApi.list({ is_active: true }),
    staleTime: 60_000,
  });

  // Map toolkit.common_fields rows to DefaultField shape.
  // Falls back to the static constants when the DB hasn't been seeded yet.
  const { dynamicDefaultFields, dynamicKeyFields, dynamicLogFields, dynamicDefaultCodes } =
    useMemo(() => {
      if (!commonFields.length) {
        return {
          dynamicDefaultFields: DEFAULT_FIELDS,
          dynamicKeyFields:     DEFAULT_FIELDS.filter(f => ['id', 'code'].includes(f.code)),
          dynamicLogFields:     DEFAULT_FIELDS.filter(f => !['id', 'code'].includes(f.code)),
          dynamicDefaultCodes:  DEFAULT_FIELD_CODES,
        };
      }
      const toDefault = (fd: CommonField): DefaultField => {
        const typeMap: Record<string, FieldType> = {
          text: 'text', email: 'email', phone: 'phone', url: 'url', color: 'color',
          boolean: 'toggle', date: 'datetime', datetime: 'datetime',
          number: 'integer', select: 'select', multiselect: 'multiselect', json: 'text',
          integer: 'text',
        };
        let field_type: FieldType = typeMap[fd.data_type] ?? 'text';
        if (fd.code === 'id')         field_type = 'id';
        if (fd.code === 'sort_order') field_type = 'sequence';
        return {
          code:             fd.code,
          field_type,
          label:            fd.field_name,
          description:      '',
          is_required:      fd.code === 'id' || fd.code === 'code',
          is_unique:        fd.code === 'code',
          show_translation: fd.show_translation,
          default_value:    fd.default_value ?? undefined,
          true_label:       fd.true_label    ?? undefined,
          false_label:      fd.false_label   ?? undefined,
        };
      };
      const all  = commonFields.map(toDefault);
      const keys = commonFields.filter(f => f.field_role === 'user').map(toDefault);
      const logs = commonFields.filter(f => f.field_role === 'log').map(toDefault);
      return {
        dynamicDefaultFields: all,
        dynamicKeyFields:     keys,
        dynamicLogFields:     logs,
        dynamicDefaultCodes:  new Set(all.map(f => f.code)),
      };
    }, [commonFields]);

  // Sync schema_name from the URL query param whenever ?schema= changes.
  // useState only reads the initializer once (on mount), so navigating from
  // /toolkit/tables/new?schema=public → /toolkit/tables/new?schema=pim while
  // the component stays mounted (static key="new") would leave schema stale.
  useEffect(() => {
    if (isEdit) return;
    const schemaFromUrl = searchParams.get('schema') ?? 'public';
    setTableForm(prev => {
      if (prev.schema_name === schemaFromUrl) return prev;
      return { ...prev, schema_name: schemaFromUrl };
    });
  }, [searchParams, isEdit]);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: QK.table(tableCode!),
    queryFn: () => toolkitTablesApi.getByCode(tableCode!),
    enabled: isEdit,
  });

  // Hydrate form from server data — skip on background refetches to avoid overwriting unsaved changes
  useEffect(() => {
    if (!existing) return;
    if (hydratedIdRef.current === existing.id) return;
    hydratedIdRef.current = existing.id;

    setTableForm({
      code:        existing.code,
      description: existing.description ?? '',
      schema_name: existing.schema_name,
    });

    const overrides: Record<string, DefaultOverride> = {};
    const di18n: Record<string, Record<string, string>> = {};
    for (const sf of existing.fields.filter(f => dynamicDefaultCodes.has(f.code))) {
      overrides[sf.code] = { description: sf.description };
      const cfg = sf.config as Record<string, unknown> | null;
      di18n[sf.code] = (cfg?.label_i18n as Record<string, string>) ?? {};
    }
    setDefaultOverrides(overrides);
    setDefaultFieldI18n(di18n);

    setFields(
      existing.fields
        .filter(f => !dynamicDefaultCodes.has(f.code))
        .map(f => ({
          _key:          String(f.id),
          code:          f.code,
          label:         f.label        ?? '',
          labelI18n:     (f.config as Record<string, unknown> | null)?.label_i18n as Record<string, string> ?? {},
          description:   f.description  ?? '',
          descriptionI18n: (f.config as Record<string, unknown> | null)?.description_i18n as Record<string, string> ?? {},
          field_type:    f.field_type,
          is_required:   f.is_required,
          is_unique:     f.is_unique,
          is_multilingual: f.is_multilingual,
          is_system:     f.is_system ?? false,
          options: existing.options
            .filter(o => o.field_id === f.id)
            .map(o => ({ _optKey: String(o.id), code: o.code, label: o.label, labelI18n: o.label_i18n ?? {} })),
          ref: f.ref_table_code
            ? {
                ref_table_code: f.ref_table_code,
                ref_table_id:   f.ref_table_id,
                store_field:    f.store_field ?? 'code',
                display_field:  f.display_field ?? 'label',
              }
            : null,
          toggleLabels: {
            true_label:    (f.config as Record<string, unknown> | null)?.true_label   as string ?? '',
            false_label:   (f.config as Record<string, unknown> | null)?.false_label  as string ?? '',
            trueLabelI18n: (f.config as Record<string, unknown> | null)?.true_label_i18n  as Record<string, string> ?? {},
            falseLabelI18n:(f.config as Record<string, unknown> | null)?.false_label_i18n as Record<string, string> ?? {},
          },
          default_value:    f.default_value ?? '',
          expression:       (f.config as Record<string, unknown> | null)?.expression       as string ?? '',
          gateway_endpoint: (f.config as Record<string, unknown> | null)?.gateway_endpoint as string ?? '',
          show_in_list:     (f.config as Record<string, unknown> | null)?.show_in_list     as boolean ?? true,
        })),
    );
  }, [existing]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        ...tableForm,
        label: tableForm.code,
        fields: [
          // System defaults — only description is editable
          ...dynamicDefaultFields.map(f => ({
            code:        f.code,
            label:       f.label,
            description: defaultOverrides[f.code]?.description ?? f.description,
            field_type:  f.field_type,
            is_required: f.is_required,
            is_unique:   f.is_unique,
            is_system:   true,
            label_i18n:  defaultFieldI18n[f.code] ?? {},
            config:      {},
          })),
          // User-defined fields — skip blank rows and scaffold codes (already in scaffold section above)
          ...fields
            .filter(f => f.code.trim() !== '' && !BACKEND_MANAGED_FIELD_CODES.has(f.code) && !dynamicDefaultCodes.has(f.code))
            .map(f => {
              const dbId = parseInt(f._key, 10);
              const isExistingField = !isNaN(dbId) && String(dbId) === f._key;
              return {
                ...(isExistingField ? { id: dbId } : {}),
                code:        f.code,
                label:       f.label,
                description: f.description,
                label_i18n:  f.labelI18n,
                description_i18n: f.descriptionI18n,
                field_type:      f.field_type,
                is_required:     f.is_required,
                is_unique:       f.is_unique,
                is_multilingual: f.is_multilingual,
                config: f.field_type === 'toggle'
                  ? {
                      true_label:       f.toggleLabels.true_label,
                      false_label:      f.toggleLabels.false_label,
                      true_label_i18n:  f.toggleLabels.trueLabelI18n,
                      false_label_i18n: f.toggleLabels.falseLabelI18n,
                    }
                  : f.field_type === 'computed'
                  ? { expression: f.expression }
                  : {},
                default_value: f.default_value || null,
                // Include option-level translations so save_table_translations can persist them.
                ...(f.field_type === 'inline_select' ? {
                  options: f.options
                    .filter(o => !isNaN(parseInt(o._optKey, 10)))
                    .map(o => ({ id: parseInt(o._optKey, 10), label_i18n: o.labelI18n })),
                } : {}),
              };
            }),
        ],
      };

      // Translation tab: only update toolkit_fields.config (label_i18n etc.) — no DDL.
      if (isEdit && tab === 'Translations') {
        return await toolkitTablesApi.saveTranslations({ id: existing!.id, fields: payload.fields });
      }

      // Delete user-created fields whose codes clash with backend-managed columns (e.g. 'label').
      // Do NOT delete scaffold/common fields here — they have is_system=false on old tables
      // and would be incorrectly treated as conflicting if their code appears in dynamicDefaultCodes.
      if (existing) {
        const conflicting = existing.fields.filter(
          f => f.id && !f.is_system && BACKEND_MANAGED_FIELD_CODES.has(f.code),
        );
        for (const cf of conflicting) {
          await toolkitFieldsApi.delete(cf.id!).catch(() => {});
        }
      }

      // Bug fix: field code renames are not handled by the table update endpoint (which uses
      // ON CONFLICT (table_id, code) and would insert a duplicate with the new code).
      // Detect renames by matching the draft _key (== field DB id) against existing.fields,
      // then call the dedicated fields/update endpoint which runs ALTER TABLE RENAME COLUMN.
      if (isEdit && existing) {
        for (const f of fields.filter(
          f => f.code.trim() && !f.is_system && !BACKEND_MANAGED_FIELD_CODES.has(f.code) && !dynamicDefaultCodes.has(f.code),
        )) {
          const dbId = parseInt(f._key, 10);
          if (isNaN(dbId) || String(dbId) !== f._key) continue; // new field, no rename needed
          const orig = existing.fields.find(ef => ef.id === dbId);
          if (!orig || orig.code === f.code) continue; // code unchanged
          // Skip rename if the target code is already occupied by a different field in the DB
          // (can happen after catalog corruption where two rows have the same code)
          if (existing.fields.some(ef => ef.code === f.code && ef.id !== dbId)) continue;
          // Run the rename via the dedicated update endpoint (handles DDL + catalog + translations)
          await toolkitFieldsApi.update({
            id:             dbId,
            code:           f.code,
            label:          f.label,
            description:    f.description,
            is_required:    f.is_required,
            is_unique:      f.is_unique,
            is_multilingual: f.is_multilingual,
          });
        }
      }

      let result: ToolkitTableDetail;
      if (isEdit) {
        result = await toolkitTablesApi.update({ id: existing!.id, ...payload });
      } else {
        result = await toolkitTablesApi.create(payload) as ToolkitTableDetail;
      }

      // Save inline_select options — create new, update changed, delete removed
      for (const f of fields) {
        if (f.field_type !== 'inline_select') continue;
        const dbField = result.fields?.find(rf => rf.code === f.code);
        if (!dbField) continue;

        // IDs still present in the UI (numeric _optKey = existing DB row)
        const survivingIds = new Set(
          f.options
            .map(o => parseInt(o._optKey, 10))
            .filter(n => !isNaN(n)),
        );

        // Delete options that existed in DB but were removed from the UI
        const originalOpts = existing?.options?.filter(o => o.field_id === dbField.id) ?? [];
        for (const orig of originalOpts) {
          if (!survivingIds.has(orig.id)) {
            await toolkitOptionsApi.delete(orig.id).catch(() => {});
          }
        }

        // Create new options or update existing ones
        for (const opt of f.options) {
          if (!opt.code || !opt.label) continue;
          const existingId = parseInt(opt._optKey, 10);
          if (!isNaN(existingId)) {
            await toolkitOptionsApi.update({ id: existingId, code: opt.code, label: opt.label, label_i18n: opt.labelI18n }).catch(() => {});
          } else {
            await toolkitOptionsApi.create({ field_id: dbField.id, code: opt.code, label: opt.label, label_i18n: opt.labelI18n }).catch(() => {});
          }
        }
      }

      // Re-fetch so onSuccess receives options that reflect all creates/updates above.
      return await toolkitTablesApi.get(result.id);
    },
    onSuccess: (result: ToolkitTableDetail) => {
      toast.success(isEdit ? 'Table updated' : 'Table created');

      // Re-hydrate state from the server result immediately after save.
      // This ensures the UI always reflects what the backend actually stored,
      // guarding against stale-state or race-condition issues where fields
      // might appear missing after a save + navigate cycle.
      if (result.fields) {
        // Reload scaffold field translations from config (if backend persisted them).
        // Use merge (not replace) so any that the backend skipped are preserved in memory.
        const di18n: Record<string, Record<string, string>> = {};
        for (const sf of result.fields.filter(f => dynamicDefaultCodes.has(f.code))) {
          const cfg = (sf.config as Record<string, unknown> | null);
          const i18n = (cfg?.label_i18n as Record<string, string>) ?? {};
          if (Object.keys(i18n).length) di18n[sf.code] = i18n;
        }
        if (Object.keys(di18n).length) {
          setDefaultFieldI18n(prev => ({ ...prev, ...di18n }));
        }

        // Reload user fields from the server response.
        // Mark hydratedIdRef so the useEffect guard does not overwrite this.
        hydratedIdRef.current = result.id;
        setFields(
          result.fields
            .filter(f => !dynamicDefaultCodes.has(f.code))
            .map(f => ({
              _key:            String(f.id),
              code:            f.code,
              label:           f.label        ?? '',
              labelI18n:       (f.config as Record<string, unknown> | null)?.label_i18n as Record<string, string> ?? {},
              description:     f.description  ?? '',
              descriptionI18n: (f.config as Record<string, unknown> | null)?.description_i18n as Record<string, string> ?? {},
              field_type:      f.field_type,
              is_required:     f.is_required,
              is_unique:       f.is_unique,
              is_multilingual: f.is_multilingual,
              is_system:       f.is_system ?? false,
              options: (result.options ?? [])
                .filter(o => o.field_id === f.id)
                .map(o => ({ _optKey: String(o.id), code: o.code, label: o.label, labelI18n: o.label_i18n ?? {} })),
              ref: f.ref_table_code ? {
                ref_table_code: f.ref_table_code,
                ref_table_id:   f.ref_table_id,
                store_field:    f.store_field ?? 'code',
                display_field:  f.display_field ?? 'label',
              } : null,
              toggleLabels: {
                true_label:     (f.config as Record<string, unknown> | null)?.true_label   as string ?? '',
                false_label:    (f.config as Record<string, unknown> | null)?.false_label  as string ?? '',
                trueLabelI18n:  (f.config as Record<string, unknown> | null)?.true_label_i18n  as Record<string, string> ?? {},
                falseLabelI18n: (f.config as Record<string, unknown> | null)?.false_label_i18n as Record<string, string> ?? {},
              },
              default_value:    f.default_value ?? '',
              expression:       (f.config as Record<string, unknown> | null)?.expression       as string ?? '',
              gateway_endpoint: (f.config as Record<string, unknown> | null)?.gateway_endpoint as string ?? '',
              show_in_list:     (f.config as Record<string, unknown> | null)?.show_in_list     as boolean ?? true,
            }))
        );
      }

      const userFieldCount = result.fields
        ? result.fields.filter(f => !f.is_system && !DEFAULT_FIELD_CODES.has(f.code)).length
        : 0;

      // Patch sidebar cache immediately so field count updates without waiting for a refetch
      qc.setQueryData<ToolkitTable[]>(QK.tables(), old =>
        old ? old.map(t => t.id === result.id ? { ...t, field_count: userFieldCount } : t) : old,
      );
      qc.invalidateQueries({ queryKey: QK.tables() });
      qc.invalidateQueries({ queryKey: ['toolkit-table'] });

      navigate(`/toolkit/tables/${result.code}/edit`);
    },
    onError: (e: Error) => toast.error(e.message ?? 'Save failed'),
  });

  const deleteMut = useMutation({
    mutationFn: () => toolkitTablesApi.delete(existing!.id),
    onSuccess: () => {
      toast.success(`Table "${tableCode}" deleted`);
      qc.invalidateQueries({ queryKey: QK.tables() });
      navigate('/toolkit/tables');
    },
    onError: (e: Error) => {
      setDeleteDialog({ open: false, rowCount: 0, checking: false, associated: null, step: 2 });
      toast.error(e.message ?? 'Cannot delete — constraints exist');
    },
  });

  async function handleDeleteClick() {
    setDeleteDialog({ open: false, rowCount: 0, checking: true, associated: null, step: 2 });
    try {
      const [dataRows, associated] = await Promise.all([
        toolkitDataApi.list(tableCode!, { limit: 1 }) as Promise<unknown[]>,
        toolkitTablesApi.associatedObjects(existing!.id),
      ]);
      const hasAssociated =
        associated.views.length > 0 ||
        associated.functions.length > 0 ||
        associated.page_defs.length > 0 ||
        associated.apis.length > 0;
      setDeleteDialog({
        open: true,
        rowCount: dataRows.length,
        checking: false,
        associated,
        step: hasAssociated ? 1 : 2,
      });
    } catch {
      setDeleteDialog({ open: true, rowCount: 0, checking: false, associated: null, step: 2 });
    }
  }

  if (isEdit && loadingExisting) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-600">
          {isEdit ? `Edit — ${tableCode}` : 'Create Table'}
        </h1>
        <div className="flex items-center gap-1.5">
          {isEdit && (
            <button
              onClick={handleDeleteClick}
              disabled={deleteDialog.checking}
              title="Delete table"
              className={clsx(
                'p-1.5 rounded-md border transition-colors',
                deleteDialog.checking
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-red-100 text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600',
              )}
            >
              {deleteDialog.checking ? <Spinner size="sm" /> : <Trash2 size={20} />}
            </button>
          )}
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            title={isEdit ? 'Save changes' : 'Create table'}
            className={clsx(
              'p-1.5 rounded-md border transition-colors',
              saveMut.isPending
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-indigo-200 text-indigo-500 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700',
            )}
          >
            {saveMut.isPending ? <Spinner size="sm" /> : <Save size={20} />}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-3">
        {TABS.filter(t => t !== 'API' || isEdit).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              tab === t
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'Table Designer' && <TableProperties size={12} />}
            {t === 'Translations'  && <Languages size={12} />}
            {t === 'AI Generate'   && <Wand2 size={12} />}
            {t === 'Preview DDL'   && <Terminal size={12} />}
            {t === 'API'           && <Cable size={12} />}
            {t}
          </button>
        ))}
      </div>

      {tab === 'Table Designer' && (
        <TableDesignerTab
          tableForm={tableForm}
          setTableForm={setTableForm}
          fields={fields}
          setFields={setFields}
          isEdit={isEdit}
          allTables={allTables}
          existing={existing}
          tableCode={tableCode}
          defaultOverrides={defaultOverrides}
          keyFields={dynamicKeyFields}
          logFields={dynamicLogFields}
          onDefaultOverride={(code, patch) =>
            setDefaultOverrides(prev => ({
              ...prev,
              [code]: { ...(prev[code] ?? { description: '' }), ...patch },
            }))
          }
        />
      )}

      {tab === 'AI Generate' && (
        <AIGenerateTab
          onGenerated={(table, generatedFields) => {
            setTableForm(prev => ({ ...prev, ...table, schema_name: prev.schema_name }));
            setFields(generatedFields);
            setTab('Table Designer');
          }}
        />
      )}

      {tab === 'Preview DDL' && (
        <PreviewDdlTab tableCode={tableCode} existingId={existing?.id} />
      )}

      {tab === 'API' && isEdit && existing && (
        <ApiTab
          tableId={existing.id}
          tableCode={existing.code}
          schema={existing.schema_name}
          label={existing.label}
        />
      )}

      {tab === 'Translations' && (
        tableCode === 'common_fields'
          ? <TranslateTabComplete
              fields={fields}
              setFields={setFields}
              tableCode={tableCode}
              defaultFieldI18n={defaultFieldI18n}
              setDefaultFieldI18n={setDefaultFieldI18n}
              scaffoldFields={dynamicDefaultFields}
            />
          : <TranslateTab
              fields={fields}
              setFields={setFields}
              tableCode={tableCode}
              defaultFieldI18n={defaultFieldI18n}
              setDefaultFieldI18n={setDefaultFieldI18n}
              scaffoldFields={dynamicDefaultFields}
            />
      )}

      {/* Step 1 — associated-objects warning */}
      {deleteDialog.open && deleteDialog.step === 1 && (() => {
        const a = deleteDialog.associated!;
        const METHOD_CLS: Record<string, string> = {
          GET:    'bg-emerald-50 text-emerald-600 border-emerald-200',
          POST:   'bg-blue-50 text-blue-600 border-blue-200',
          PUT:    'bg-amber-50 text-amber-600 border-amber-200',
          PATCH:  'bg-amber-50 text-amber-600 border-amber-200',
          DELETE: 'bg-red-50 text-red-500 border-red-200',
        };
        return (
          <Modal
            open
            onClose={() => setDeleteDialog(d => ({ ...d, open: false }))}
            title="Confirm deletion"
            size="md"
          >
            {/* Warning banner */}
            <div className="flex gap-2.5 items-start p-3 rounded-lg bg-red-50 border border-red-200 mb-4">
              <AlertTriangle size={15} className="text-red-500 shrink-0 mt-px" />
              <p className="text-xs text-red-700 leading-relaxed">
                Dropping <span className="font-semibold font-mono">{tableCode}</span> will
                permanently remove the table and every object listed below. This cannot be undone.
              </p>
            </div>

            {/* Object groups */}
            <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100 text-xs">

              {/* Table row */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50">
                <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Table</span>
                <span className="font-mono text-gray-700">{tableCode}</span>
                {deleteDialog.rowCount > 0 && (
                  <span className="ml-auto text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                    {deleteDialog.rowCount}+ rows
                  </span>
                )}
              </div>

              {a.views.map(v => (
                <div key={v.code} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-sky-400">View</span>
                  <span className="font-mono text-gray-600">{v.schema_name}.{v.code}</span>
                </div>
              ))}

              {a.functions.map(f => (
                <div key={f.code} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-violet-400">Function</span>
                  <span className="font-mono text-gray-600">{f.schema_name}.{f.code}()</span>
                </div>
              ))}

              {a.apis.map(ep => (
                <div key={ep.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">API</span>
                  <span className={clsx(
                    'text-[9px] font-bold uppercase border rounded px-1 py-px shrink-0',
                    METHOD_CLS[ep.method] ?? 'bg-gray-50 text-gray-500 border-gray-200',
                  )}>{ep.method}</span>
                  <span className="font-mono text-gray-600 truncate">{ep.url_path}</span>
                  <span className="ml-auto text-gray-400 truncate max-w-[120px]">{ep.name}</span>
                </div>
              ))}

              {a.page_defs.map(pd => (
                <div key={pd.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-orange-400">Page Def</span>
                  <span className="font-mono text-gray-600">{pd.code}</span>
                  {pd.title && (
                    <span className="ml-auto text-gray-400 truncate max-w-[160px]">{pd.title}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteDialog(d => ({ ...d, open: false }))}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => setDeleteDialog(d => ({ ...d, step: 2 }))}
                className="btn-danger text-xs"
              >
                Yes, delete all
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* Step 2 — final confirmation */}
      <ConfirmDialog
        open={deleteDialog.open && deleteDialog.step === 2}
        title="Delete table permanently"
        message={
          deleteDialog.rowCount > 0
            ? `This table contains data. Deleting "${tableCode}" will permanently drop the table and all its records. This cannot be undone.`
            : `Delete table "${tableCode}"? This will drop the table from the database and cannot be undone.`
        }
        confirmLabel="Delete permanently"
        danger
        onConfirm={() => deleteMut.mutate()}
        onCancel={() => setDeleteDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
