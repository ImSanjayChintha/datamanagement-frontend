import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wand2, Table2, Eye, Code2, ChevronRight,
  CheckCircle2, XCircle, ShieldCheck, Play, RotateCcw, Sparkles,
} from 'lucide-react';
import { clsx } from 'clsx';
import CodeMirror from '@uiw/react-codemirror';
import { sql as sqlLang } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { toolkitAiApi, toolkitTablesApi, toolkitSqlApi } from '@/modules/toolkit/core/api';
import type {
  AiMode, AiGenerateSqlBody, AiClarifyAnswer,
  AiTableResult, AiSqlObjectResult, AiClarifyResult, AiSqlResult,
  AiObjectMeta,
} from '@/modules/toolkit/core/api';
import type { ToolkitTable } from '@/types/toolkit';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import type { FieldDraft, TableForm } from './tableBuilder.types';
import { newField } from './tableBuilder.types';

// ── Types ─────────────────────────────────────────────────────────────────

type Phase =
  | 'idle'        // waiting for user input
  | 'generating'  // calling backend
  | 'clarify'     // AI needs more info
  | 'sql_ready'   // view/function SQL returned, awaiting review
  | 'validating'  // calling /sql/validate
  | 'validated'   // validated, ready to execute
  | 'executing'   // calling /sql/execute
  | 'done';       // successfully executed and saved

interface Banner {
  success: boolean;
  message: string;
}

interface Props {
  onGenerated: (table: TableForm, fields: FieldDraft[]) => void;
}

// ── Mode config ───────────────────────────────────────────────────────────

const MODES: { value: AiMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { value: 'auto',     label: 'Auto',     icon: <Wand2  size={13} />, hint: 'AI decides the object type from your description' },
  { value: 'table',    label: 'Table',    icon: <Table2 size={13} />, hint: 'Generate a new table definition' },
  { value: 'view',     label: 'View',     icon: <Eye    size={13} />, hint: 'Generate a SQL view joining existing tables' },
  { value: 'function', label: 'Function', icon: <Code2  size={13} />, hint: 'Generate a PostgreSQL function' },
];

const NEEDS_TABLE_PICKER: AiMode[] = ['view', 'function'];

// ── Helpers ───────────────────────────────────────────────────────────────

function mapAiTableToForm(result: AiTableResult): { tableForm: TableForm; fields: FieldDraft[] } {
  const tableForm: TableForm = {
    code:        result.code        || '',
    description: result.description || '',
    schema_name: 'public',
  };
  const fields: FieldDraft[] = (result.fields || []).map(f => ({
    ...newField(),
    code:        f.code        || '',
    label:       f.label       || f.code || '',
    description: f.description || '',
    field_type:  f.field_type  as FieldDraft['field_type'] || 'text',
    is_required: f.is_required  ?? false,
    is_unique:   f.is_unique    ?? false,
    options: (f.options || []).map(o => ({
      _optKey: Math.random().toString(36).slice(2),
      code:    o.code,
      label:   o.label,
      labelI18n: {},
    })),
    ref: f.ref_table_code
      ? { ref_table_code: f.ref_table_code, ref_table_id: null, store_field: 'code', display_field: 'label' }
      : null,
    default_value: String(f.default_value ?? ''),
    expression:    (f.config as Record<string, unknown> | undefined)?.expression as string ?? '',
  }));
  return { tableForm, fields };
}

function objectTypeLabel(type: string): string {
  if (type === 'view')     return 'View';
  if (type === 'function') return 'Function';
  return type;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AIGenerateTab({ onGenerated }: Props) {
  // ── Core state ────────────────────────────────────────────────────────
  const [mode, setMode]                 = useState<AiMode>('auto');
  const [prompt, setPrompt]             = useState('');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [phase, setPhase]               = useState<Phase>('idle');
  const [statusMsg, setStatusMsg]       = useState('');

  // ── Clarify state ─────────────────────────────────────────────────────
  const [clarify, setClarify]               = useState<AiClarifyResult | null>(null);
  const [clarifySelections, setClarifySelections] = useState<string[]>([]);
  const [clarifySpec, setClarifySpec]       = useState('');

  // ── SQL review state ──────────────────────────────────────────────────
  const [sqlResult, setSqlResult]           = useState<AiSqlObjectResult | null>(null);
  const [validateBanner, setValidateBanner] = useState<Banner | null>(null);
  const [executeBanner, setExecuteBanner]   = useState<Banner | null>(null);
  const [savedObject, setSavedObject]       = useState<{ id: number; code: string } | null>(null);

  // ── Available tables (for picker) ─────────────────────────────────────
  const { data: allTables = [] } = useQuery<ToolkitTable[]>({
    queryKey: ['toolkit-tables'],
    queryFn:  () => toolkitTablesApi.list({ is_active: true }),
    staleTime: 30_000,
  });

  const isLoading = phase === 'generating' || phase === 'validating' || phase === 'executing';

  // ── Toggle a table in the picker ─────────────────────────────────────
  function toggleTable(code: string) {
    setSelectedTables(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    );
  }

  // ── Toggle a clarify suggestion ───────────────────────────────────────
  function toggleClarifySelection(val: string) {
    if (!clarify) return;
    if (clarify.allow_multiple) {
      setClarifySelections(prev =>
        prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val],
      );
    } else {
      setClarifySelections([val]);
    }
  }

  // ── Main generate call ────────────────────────────────────────────────
  async function handleGenerate(clarifyAnswer?: AiClarifyAnswer) {
    if (!prompt.trim()) {
      toast.error('Enter a description first');
      return;
    }

    setPhase('generating');
    setStatusMsg('Asking AI…');
    setValidateBanner(null);
    setExecuteBanner(null);
    setSavedObject(null);

    const body: AiGenerateSqlBody = {
      prompt,
      object_type:     mode === 'auto' ? undefined : mode,
      selected_tables: selectedTables.length ? selectedTables : undefined,
      clarify_answer:  clarifyAnswer,
    };

    try {
      const raw = await toolkitAiApi.generateSql(body);
      const result = raw as AiSqlResult;

      if (result.type === 'table') {
        const r = result as AiTableResult;
        const { tableForm, fields } = mapAiTableToForm(r);
        onGenerated(tableForm, fields);
        toast.success('Table generated — review and save in Table Designer');
        setPhase('idle');
        setStatusMsg('');

      } else if (result.type === 'view' || result.type === 'function') {
        setSqlResult(result as AiSqlObjectResult);
        setPhase('sql_ready');
        setStatusMsg('');

      } else if (result.type === 'clarify') {
        setClarify(result as AiClarifyResult);
        // Pre-select suggestions if table_selection and tables were already chosen
        if ((result as AiClarifyResult).clarify_type === 'table_selection' && selectedTables.length) {
          setClarifySelections(selectedTables);
        } else {
          setClarifySelections([]);
        }
        setClarifySpec('');
        setPhase('clarify');
        setStatusMsg('');
      } else {
        toast.error('Unexpected AI response type');
        setPhase('idle');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI generation failed');
      setPhase('idle');
      setStatusMsg('');
    }
  }

  // ── Submit clarify answer ─────────────────────────────────────────────
  async function handleClarifySubmit() {
    if (!clarify) return;

    const hasAnswer =
      clarify.clarify_type === 'table_selection'
        ? clarifySelections.length > 0
        : clarifySpec.trim().length > 0 || clarifySelections.length > 0;

    if (!hasAnswer) {
      toast.error('Please make a selection before continuing');
      return;
    }

    const answer: AiClarifyAnswer = {
      clarify_type: clarify.clarify_type,
      ...(clarify.clarify_type === 'table_selection'
        ? { selected: clarifySelections }
        : {
            selected:      clarifySelections,
            specification: clarifySpec.trim() || clarifySelections[0],
          }),
    };

    // If table_selection, also update the selectedTables picker
    if (clarify.clarify_type === 'table_selection' && clarifySelections.length) {
      setSelectedTables(clarifySelections);
    }

    setClarify(null);
    await handleGenerate(answer);
  }

  // ── Validate SQL ──────────────────────────────────────────────────────
  async function handleValidate() {
    if (!sqlResult?.sql) return;
    setPhase('validating');
    setValidateBanner(null);
    try {
      const res = await toolkitSqlApi.validate(sqlResult.sql);
      setValidateBanner({ success: true, message: res.message });
      setPhase('validated');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      setValidateBanner({ success: false, message: msg });
      setPhase('sql_ready');
    }
  }

  // ── Execute + auto-save ───────────────────────────────────────────────
  async function handleExecute() {
    if (!sqlResult?.sql) return;
    setPhase('executing');
    setExecuteBanner(null);

    const objectMeta: AiObjectMeta = {
      label:         sqlResult.label,
      description:   sqlResult.description,
      metadata_json: sqlResult.metadata_json,
    };

    try {
      const res = await toolkitSqlApi.execute(sqlResult.sql, undefined, objectMeta);
      const saved = res.saved_object;
      if (saved) {
        setSavedObject({ id: saved.id, code: saved.code });
        setExecuteBanner({
          success: true,
          message: `${objectTypeLabel(sqlResult.type)} "${saved.code}" applied and saved to catalog (id: ${saved.id})`,
        });
        toast.success(`${objectTypeLabel(sqlResult.type)} applied to database`);
      } else {
        setExecuteBanner({ success: true, message: 'SQL executed successfully' });
        toast.success('SQL executed');
      }
      setPhase('done');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Execution failed';
      setExecuteBanner({ success: false, message: msg });
      setPhase('validated'); // allow retry
      toast.error(msg);
    }
  }

  // ── Reset to start ────────────────────────────────────────────────────
  function handleReset() {
    setPhase('idle');
    setStatusMsg('');
    setClarify(null);
    setClarifySelections([]);
    setClarifySpec('');
    setSqlResult(null);
    setValidateBanner(null);
    setExecuteBanner(null);
    setSavedObject(null);
  }

  // ── Render ────────────────────────────────────────────────────────────

  const activeMode = MODES.find(m => m.value === mode)!;

  return (
    <div className="space-y-4">

      {/* ── Mode selector ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">What do you want to create?</p>
        <div className="flex gap-2 flex-wrap">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => { setMode(m.value); handleReset(); }}
              disabled={isLoading}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
                mode === m.value
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                isLoading && 'opacity-40 cursor-not-allowed',
              )}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 italic">{activeMode.hint}</p>
      </div>

      {/* ── Table picker (view / function mode) ───────────────────────── */}
      {NEEDS_TABLE_PICKER.includes(mode) && allTables.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Tables to use <span className="font-normal text-gray-300">(optional — AI uses all if none selected)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allTables.map(t => {
              const active = selectedTables.includes(t.code);
              return (
                <button
                  key={t.code}
                  onClick={() => toggleTable(t.code)}
                  disabled={isLoading}
                  className={clsx(
                    'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    active
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                    isLoading && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {active ? '✓ ' : ''}{t.code}
                </button>
              );
            })}
          </div>
          {selectedTables.length > 0 && (
            <p className="text-[11px] text-indigo-500">
              {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''} selected — AI will focus on these
            </p>
          )}
        </div>
      )}

      {/* ── Prompt + Generate ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Describe what you want</p>
        <textarea
          className="input min-h-[320px] text-sm resize-y"
          placeholder={
            mode === 'view'     ? 'e.g. A view joining customer and item showing customer name, unit price and tariff rate' :
            mode === 'function' ? 'e.g. A function that returns all active items for a given customer_id with their tariff rate' :
            mode === 'table'    ? 'e.g. A table for tracking customer orders with status, reference number and delivery date' :
            'e.g. A view joining customer and item, or a table for product categories, or a function to calculate totals…'
          }
          value={prompt}
          disabled={isLoading}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleGenerate()}
            disabled={isLoading || !prompt.trim()}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors',
              isLoading || !prompt.trim()
                ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
                : 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400',
            )}
          >
            {phase === 'generating' ? <Spinner size="sm" /> : <Sparkles size={14} />}
            {phase === 'generating' ? 'Generating…' : 'Generate with AI'}
          </button>

          {(phase === 'sql_ready' || phase === 'validated' || phase === 'done' || phase === 'clarify') && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RotateCcw size={12} />
              Start over
            </button>
          )}

          {phase === 'generating' && (
            <span className="text-xs text-gray-400 italic animate-pulse">{statusMsg}</span>
          )}
        </div>
        <p className="text-[11px] text-gray-300">Tip: Ctrl+Enter to generate</p>
      </div>

      {/* ── Clarify step ──────────────────────────────────────────────── */}
      {phase === 'clarify' && clarify && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50/60">
            <Wand2 size={13} className="text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">AI needs clarification</span>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700 font-medium">{clarify.question}</p>
            {clarify.hint && (
              <p className="text-xs text-gray-400 italic">{clarify.hint}</p>
            )}

            {/* table_selection — multi-select chips */}
            {clarify.clarify_type === 'table_selection' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {clarify.suggestions.map(s => {
                  const active = clarifySelections.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleClarifySelection(s)}
                      className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        active
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      {active ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
            )}

            {/* specification — radio-style options */}
            {clarify.clarify_type === 'specification' && (
              <div className="space-y-2 pt-1">
                {clarify.suggestions.map(s => (
                  <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="radio"
                      name="clarify-spec"
                      value={s}
                      checked={clarifySelections[0] === s}
                      onChange={() => toggleClarifySelection(s)}
                      className="accent-indigo-600"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-800">{s}</span>
                  </label>
                ))}
                <div className="pt-1">
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="Or type your own answer…"
                    value={clarifySpec}
                    onChange={e => { setClarifySpec(e.target.value); setClarifySelections([]); }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleClarifySubmit}
                disabled={
                  clarify.clarify_type === 'table_selection'
                    ? clarifySelections.length === 0
                    : clarifySelections.length === 0 && !clarifySpec.trim()
                }
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  (clarifySelections.length === 0 && !clarifySpec.trim())
                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                    : 'border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100',
                )}
              >
                <ChevronRight size={13} />
                Continue
              </button>
              {clarify.clarify_type === 'table_selection' && clarifySelections.length > 0 && (
                <span className="text-xs text-indigo-500">
                  {clarifySelections.length} selected
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SQL review panel (view / function) ────────────────────────── */}
      {(phase === 'sql_ready' || phase === 'validating' || phase === 'validated' || phase === 'executing' || phase === 'done') && sqlResult && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {sqlResult.type === 'view'     ? <Eye    size={13} className="text-gray-400 shrink-0" /> : null}
                {sqlResult.type === 'function' ? <Code2  size={13} className="text-gray-400 shrink-0" /> : null}
                <span className="text-xs font-semibold text-gray-700">
                  {objectTypeLabel(sqlResult.type)}: <span className="font-mono text-indigo-600">{sqlResult.code}</span>
                </span>
                {phase === 'done' && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                    <CheckCircle2 size={10} />
                    saved
                  </span>
                )}
              </div>
              {sqlResult.description && (
                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{sqlResult.description}</p>
              )}
              {phase === 'validated' && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 mt-1">
                  <ShieldCheck size={11} /> Validated — ready to apply to database
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Validate */}
              {phase !== 'done' && (
                <button
                  onClick={handleValidate}
                  disabled={phase === 'validating' || phase === 'executing'}
                  title="Validate SQL using PostgreSQL — dry-run in a rolled-back transaction"
                  className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors',
                    phase === 'validating' || phase === 'executing'
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : phase === 'validated'
                      ? 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400',
                  )}
                >
                  {phase === 'validating' ? <Spinner size="sm" /> : <ShieldCheck size={12} />}
                  {phase === 'validated' ? 'Re-validate' : 'Validate SQL'}
                </button>
              )}

              {/* Execute — only after validation; remains visible while executing so the spinner shows */}
              {(phase === 'validated' || phase === 'executing') && (
                <button
                  onClick={handleExecute}
                  disabled={phase !== 'validated'}
                  title="Execute SQL against the database — auto-saved to catalog on success"
                  className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors',
                    phase !== 'validated'
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400',
                  )}
                >
                  {phase === 'executing' ? <Spinner size="sm" /> : <Play size={12} />}
                  Apply to DB
                </button>
              )}
            </div>
          </div>

          {/* Validation banner */}
          {validateBanner && (
            <div className={clsx(
              'flex items-start gap-2 px-4 py-2.5 text-xs border-b',
              validateBanner.success
                ? 'bg-blue-50 border-blue-100 text-blue-700'
                : 'bg-red-50 border-red-100 text-red-700',
            )}>
              {validateBanner.success
                ? <ShieldCheck size={13} className="text-blue-500 shrink-0 mt-0.5" />
                : <XCircle     size={13} className="text-red-500 shrink-0 mt-0.5" />
              }
              <span className="font-mono leading-relaxed whitespace-pre-wrap break-all">{validateBanner.message}</span>
            </div>
          )}

          {/* Execute result banner */}
          {executeBanner && (
            <div className={clsx(
              'flex items-start gap-2 px-4 py-2.5 text-xs border-b',
              executeBanner.success
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-red-700',
            )}>
              {executeBanner.success
                ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                : <XCircle      size={13} className="text-red-500 shrink-0 mt-0.5" />
              }
              <span className="font-mono leading-relaxed whitespace-pre-wrap break-all">{executeBanner.message}</span>
            </div>
          )}

          {/* SQL viewer (read-only CodeMirror) */}
          <CodeMirror
            value={sqlResult.sql}
            extensions={[sqlLang()]}
            theme={oneDark}
            editable={false}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false }}
            style={{ fontSize: '12px', minHeight: '200px', maxHeight: '480px', overflowY: 'auto' }}
          />

          {/* Done footer */}
          {phase === 'done' && savedObject && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Saved to catalog as <span className="font-mono text-gray-700">{savedObject.code}</span>
                <span className="text-gray-300"> · id {savedObject.id}</span>
              </span>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
              >
                <Wand2 size={12} />
                Generate another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
