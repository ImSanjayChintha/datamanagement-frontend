import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Wand2, Loader2, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { commonFieldsApi, toolkitAiApi, toolkitTranslationsApi } from '@/modules/toolkit/core/api';
import type { CommonField } from '@/modules/toolkit/core/api';
import type { LangOption } from '@/types/shared';
import { QK } from '@/lib/queryKeys';
import Spinner from '@/components/ui/Spinner';


function Cell({
  value, placeholder, edited, onChange,
}: {
  value: string; placeholder: string; edited: boolean; onChange: (v: string) => void;
}) {
  return (
    <input
      className={clsx(
        'w-full h-7 px-2 text-xs rounded border transition-colors outline-none',
        'hover:border-gray-300 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200',
        edited
          ? 'border-indigo-200 bg-indigo-50/50 text-gray-800'
          : value
            ? 'border-gray-200 bg-white text-gray-800'
            : 'border-gray-100 bg-gray-50 text-gray-400',
      )}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export default function CommonFieldsTranslationPage() {
  const qc       = useQueryClient();
  const dropRef  = useRef<HTMLDivElement>(null);
  const [srcLang,   setSrcLang]   = useState('');
  const [dropOpen,  setDropOpen]  = useState(false);
  const [translating, setTranslating] = useState(false);

  // fieldId (string) → langCode → label
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: allFields = [], isLoading: loadingFields } = useQuery<CommonField[]>({
    queryKey: [...QK.commonFields(), 'translate-source'],
    queryFn:  () => commonFieldsApi.list({ is_active: true }),
    staleTime: 60_000,
  });

  const fields = useMemo(() => allFields, [allFields]);

  const { data: languages = [], isLoading: loadingLangs } = useQuery<LangOption[]>({
    queryKey: QK.langs(),
    queryFn:  () => toolkitTranslationsApi.languages(),
    staleTime: 5 * 60_000,
  });

  const { data: saved = {}, isLoading: loadingSaved } = useQuery<Record<string, Record<string, string>>>({
    queryKey: QK.commonFieldTranslations(),
    queryFn:  () => commonFieldsApi.getTranslations(),
    staleTime: 30_000,
    enabled:  fields.length > 0,
  });

  // Clear local edits when saved data refreshes
  useEffect(() => { setEdits({}); }, [saved]);

  const defaultLang = languages.find(l => l.is_default) ?? languages[0];
  const sourceLang  = languages.find(l => l.code === srcLang) ?? defaultLang;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getValue(fieldId: number, langCode: string) {
    const id = String(fieldId);
    return edits[id]?.[langCode] ?? saved[id]?.[langCode] ?? '';
  }

  function isEdited(fieldId: number, langCode: string) {
    return edits[String(fieldId)]?.[langCode] !== undefined;
  }

  function setValue(fieldId: number, langCode: string, value: string) {
    const id = String(fieldId);
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [langCode]: value } }));
  }

  const hasUnsaved = Object.keys(edits).length > 0;

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      const merged: Record<string, Record<string, string>> = {};
      for (const f of fields) {
        const id = String(f.id);
        merged[id] = { ...(saved[id] ?? {}), ...(edits[id] ?? {}) };
      }
      return commonFieldsApi.saveTranslations(merged);
    },
    onSuccess: () => {
      toast.success('Translations saved');
      qc.invalidateQueries({ queryKey: QK.commonFieldTranslations() });
    },
    onError: () => toast.error('Save failed'),
  });

  // ── AI Translate ─────────────────────────────────────────────────────────
  async function handleAiTranslate(srcCode: string) {
    setDropOpen(false);
    const targetCodes = languages.map(l => l.code).filter(c => c !== srcCode);
    if (!targetCodes.length) { toast.error('Only one language configured'); return; }

    const texts: Record<string, string> = {};
    for (const f of fields) {
      const id    = String(f.id);
      const label = edits[id]?.[srcCode] ?? saved[id]?.[srcCode] ?? f.field_name;
      if (label) texts[id] = label;
    }
    if (!Object.keys(texts).length) { toast.error('No source labels to translate'); return; }

    setTranslating(true);
    try {
      const result = await toolkitAiApi.translate(texts, srcCode, targetCodes);
      setEdits(prev => {
        const next = { ...prev };
        for (const f of fields) {
          const id = String(f.id);
          const tr = result[id] ?? {};
          if (Object.keys(tr).length) next[id] = { ...(next[id] ?? {}), ...tr };
        }
        return next;
      });
      toast.success(
        `Translated into ${targetCodes.length} language${targetCodes.length !== 1 ? 's' : ''} — click Save to persist`
      );
    } catch {
      toast.error('AI translation failed');
    } finally {
      setTranslating(false);
    }
  }

  // ── Loading / empty states ────────────────────────────────────────────────
  if (loadingFields || loadingLangs || loadingSaved) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!languages.length) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-sm text-gray-400">
          No locales configured — add locales in PIM Settings.
        </p>
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-sm text-gray-400">No common fields defined yet.</p>
      </div>
    );
  }

  const FIELD_COL = '170px';
  const LANG_COL  = '180px';
  const gridCols  = `${FIELD_COL} repeat(${languages.length}, minmax(${LANG_COL}, 1fr))`;

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
        <div>
          <h1 className="page-title">Common Fields — Translations</h1>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {fields.length} fields · {languages.length} languages
            {hasUnsaved && <span className="ml-2 text-indigo-500 font-medium">· unsaved changes</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Translate split button */}
          <div className="relative flex" ref={dropRef}>
            <button
              onClick={() => handleAiTranslate(sourceLang?.code ?? '')}
              disabled={translating || languages.length < 2}
              className="flex items-center gap-1.5 text-xs font-medium pl-3 pr-2 py-1.5 rounded-l-md
                bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors
                border-r border-orange-400"
            >
              {translating
                ? <Loader2 size={11} className="animate-spin" />
                : <Wand2 size={11} />
              }
              AI Translate
              {sourceLang && (
                <span className="text-[10px] text-orange-200 font-normal">
                  from {sourceLang.code.toUpperCase()}
                </span>
              )}
            </button>
            <button
              onClick={() => setDropOpen(v => !v)}
              disabled={translating || languages.length < 2}
              className="flex items-center px-1.5 py-1.5 rounded-r-md
                bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              <ChevronDown size={11} />
            </button>

            {dropOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-md border border-gray-200
                bg-white shadow-lg py-1">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Translate from
                </p>
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { setSrcLang(lang.code); handleAiTranslate(lang.code); }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors',
                      sourceLang?.code === lang.code ? 'text-indigo-600 font-medium' : 'text-gray-700',
                    )}
                  >
                    <span className="flex-1 text-left font-mono">{lang.code.toUpperCase()}</span>
                    {lang.is_default && <span className="text-[9px] text-indigo-400">default</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Save */}
          <button
            onClick={() => saveMut.mutate()}
            disabled={!hasUnsaved || saveMut.isPending}
            className={clsx(
              'flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-md font-medium transition-colors',
              hasUnsaved && !saveMut.isPending
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
            )}
          >
            {saveMut.isPending
              ? <Loader2 size={13} className="animate-spin" />
              : <Save size={13} />
            }
            Save
          </button>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="w-full" style={{ minWidth: `calc(${FIELD_COL} + ${languages.length} * ${LANG_COL})` }}>

          {/* Column headers — sticky */}
          <div
            className="grid sticky top-0 z-10 border-b border-gray-200 bg-gray-50 shadow-sm"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              Field
            </div>
            {languages.map(lang => (
              <div key={lang.code} className="px-3 py-2 border-l border-gray-200 flex items-center gap-1.5">
                <p className="text-[11px] font-semibold text-gray-700 font-mono">{lang.code.toUpperCase()}</p>
                {lang.is_default && (
                  <span className="ml-auto text-[9px] bg-indigo-50 text-indigo-400 px-1 py-0.5 rounded font-medium">
                    default
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Data rows */}
          <div className="divide-y divide-gray-100 bg-white">
            {fields.map((f, fi) => (
              <div
                key={f.id}
                className={clsx('grid items-center', fi % 2 === 1 && 'bg-gray-50/30')}
                style={{ gridTemplateColumns: gridCols }}
              >
                {/* Field info */}
                <div className="px-4 py-2.5">
                  <p className="text-[11px] font-semibold text-gray-800 leading-tight truncate">
                    {f.field_name}
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono leading-tight mt-0.5">{f.code}</p>
                  <span className={clsx(
                    'text-[8px] font-mono px-1 py-0.5 rounded mt-0.5 inline-block',
                    f.field_role === 'user'
                      ? 'bg-blue-50 text-blue-500'
                      : 'bg-gray-100 text-gray-500',
                  )}>
                    {f.field_role}
                  </span>
                </div>

                {/* One cell per language */}
                {languages.map(lang => (
                  <div key={lang.code} className="px-2 py-2 border-l border-gray-100">
                    <Cell
                      value={getValue(f.id, lang.code)}
                      placeholder={f.field_name}
                      edited={isEdited(f.id, lang.code)}
                      onChange={v => setValue(f.id, lang.code, v)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Click-away for dropdown */}
      {dropOpen && <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />}
    </div>
  );
}
