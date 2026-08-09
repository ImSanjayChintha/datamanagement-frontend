import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import Spinner from '@/components/ui/Spinner';
import { toolkitAiApi, toolkitTranslationsApi } from '@/modules/toolkit/core/api';
import type { LangOption } from '@/types/shared';
import { DEFAULT_FIELDS } from '@/modules/toolkit/config/tableDefaults';
import type { DefaultField } from '@/modules/toolkit/config/tableDefaults';
import type { FieldDraft } from './tableBuilder.types';
import toast from 'react-hot-toast';

interface Props {
  fields: FieldDraft[];
  setFields: React.Dispatch<React.SetStateAction<FieldDraft[]>>;
  tableCode?: string;
  defaultFieldI18n: Record<string, Record<string, string>>;
  setDefaultFieldI18n: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
  scaffoldFields?: DefaultField[];
}

// Keys used to namespace texts sent to the AI translator
const OPT   = ':opt:';
const TRUE  = ':true';
const FALSE = ':false';

function Cell({
  value, placeholder, onChange, muted,
}: {
  value: string; placeholder?: string; onChange: (v: string) => void; muted?: boolean;
}) {
  return (
    <input
      className={clsx(
        'w-full h-7 px-2 text-xs rounded border transition-colors outline-none',
        'border-gray-200 hover:border-gray-300',
        'focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-200',
        value.trim() ? 'text-gray-800 bg-white' : 'text-gray-400',
        muted && !value.trim() && 'bg-gray-50',
      )}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );
}

export default function TranslateTab({
  fields, setFields,
  defaultFieldI18n, setDefaultFieldI18n,
  scaffoldFields,
}: Props) {

  const { data: languages = [], isLoading: loadingLangs } = useQuery<LangOption[]>({
    queryKey: ['toolkit-langs'],
    queryFn:  () => toolkitTranslationsApi.languages(),
    staleTime: 5 * 60 * 1000,
  });

  const defaultLang = languages.find(l => l.is_default) ?? languages[0];
  const defCode     = defaultLang?.code ?? '';

  const scaffoldCodes = useMemo(() => {
    const base = scaffoldFields ?? DEFAULT_FIELDS;
    return new Set(base.map(f => f.code));
  }, [scaffoldFields]);

  const scaffoldFieldsToShow = useMemo(
    () => (scaffoldFields ?? DEFAULT_FIELDS).filter(f => f.show_translation === true),
    [scaffoldFields],
  );

  const userFields = useMemo(
    () => fields.filter(f => f.code.trim() !== '' && !scaffoldCodes.has(f.code)),
    [fields, scaffoldCodes],
  );

  // ── state ─────────────────────────────────────────────────────────────────
  const [srcLang, setSrcLang]         = useState('');
  const [dropOpen, setDropOpen]       = useState(false);
  const [translating, setTranslating] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const sourceLang = languages.find(l => l.code === srcLang) ?? defaultLang;

  // ── update helpers ────────────────────────────────────────────────────────
  function updateDefaultLabel(code: string, langCode: string, value: string) {
    setDefaultFieldI18n(prev => ({
      ...prev,
      [code]: { ...(prev[code] ?? {}), [langCode]: value },
    }));
  }

  function updateFieldLabel(key: string, langCode: string, value: string) {
    setFields(prev => prev.map(f =>
      f._key !== key ? f : { ...f, labelI18n: { ...f.labelI18n, [langCode]: value } },
    ));
  }

  function updateToggleValue(key: string, which: 'true' | 'false', langCode: string, value: string) {
    setFields(prev => prev.map(f => {
      if (f._key !== key) return f;
      const tl = f.toggleLabels;
      return {
        ...f,
        toggleLabels: which === 'true'
          ? { ...tl, trueLabelI18n:  { ...tl.trueLabelI18n,  [langCode]: value } }
          : { ...tl, falseLabelI18n: { ...tl.falseLabelI18n, [langCode]: value } },
      };
    }));
  }

  function updateOptionLabel(key: string, optKey: string, langCode: string, value: string) {
    setFields(prev => prev.map(f => {
      if (f._key !== key) return f;
      return {
        ...f,
        options: f.options.map(o =>
          o._optKey !== optKey ? o : { ...o, labelI18n: { ...o.labelI18n, [langCode]: value } },
        ),
      };
    }));
  }

  // ── AI translate ─────────────────────────────────────────────────────────
  async function handleAiTranslate(srcCode: string) {
    setDropOpen(false);
    const targetCodes = languages.map(l => l.code).filter(c => c !== srcCode);
    if (!targetCodes.length) { toast.error('Only one language configured'); return; }

    const texts: Record<string, string> = {};

    for (const sf of scaffoldFieldsToShow) {
      const src = defaultFieldI18n[sf.code]?.[srcCode] || sf.label;
      if (src) texts['__df__' + sf.code] = src;
    }

    for (const f of userFields) {
      const labelSrc = f.labelI18n[srcCode] || f.label;
      if (labelSrc) texts[f._key] = labelSrc;

      if (f.field_type === 'toggle') {
        const tl = f.toggleLabels;
        const t  = tl.trueLabelI18n[srcCode]  || tl.true_label;
        const fl = tl.falseLabelI18n[srcCode] || tl.false_label;
        if (t)  texts[f._key + TRUE]  = t;
        if (fl) texts[f._key + FALSE] = fl;
      }

      if (f.field_type === 'inline_select') {
        for (const o of f.options) {
          const src = o.labelI18n[srcCode] || o.label;
          if (src) texts[f._key + OPT + o._optKey] = src;
        }
      }
    }

    if (!Object.keys(texts).length) { toast.error('No text to translate'); return; }
    setTranslating(true);

    try {
      const result = await toolkitAiApi.translate(texts, srcCode, targetCodes);

      setDefaultFieldI18n(prev => {
        const next = { ...prev };
        for (const sf of scaffoldFieldsToShow) {
          const tr = result['__df__' + sf.code] ?? {};
          if (Object.keys(tr).length) {
            next[sf.code] = { ...(next[sf.code] ?? {}), ...tr };
          }
        }
        return next;
      });

      setFields(prev => prev.map(f => {
        if (!userFields.find(vf => vf._key === f._key)) return f;
        let updated = { ...f };

        const ltr = result[f._key] ?? {};
        if (Object.keys(ltr).length) updated = { ...updated, labelI18n: { ...updated.labelI18n, ...ltr } };

        if (f.field_type === 'toggle') {
          const trTrue  = result[f._key + TRUE]  ?? {};
          const trFalse = result[f._key + FALSE] ?? {};
          const tl = updated.toggleLabels;
          updated = {
            ...updated,
            toggleLabels: {
              ...tl,
              trueLabelI18n:  { ...tl.trueLabelI18n,  ...trTrue  },
              falseLabelI18n: { ...tl.falseLabelI18n, ...trFalse },
            },
          };
        }

        if (f.field_type === 'inline_select') {
          updated = {
            ...updated,
            options: updated.options.map(o => {
              const tr = result[f._key + OPT + o._optKey] ?? {};
              return Object.keys(tr).length ? { ...o, labelI18n: { ...o.labelI18n, ...tr } } : o;
            }),
          };
        }

        return updated;
      }));

      toast.success(`Translated into ${targetCodes.length} language${targetCodes.length !== 1 ? 's' : ''} — Save Table to persist`);
    } catch {
      toast.error('AI translation failed');
    } finally {
      setTranslating(false);
    }
  }

  // ── early returns ──────────────────────────────────────────────────────────
  if (loadingLangs) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }
  if (!languages.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
        No locales configured — add locales in PIM Settings.
      </div>
    );
  }

  const totalFields = scaffoldFieldsToShow.length + userFields.length;
  const FIELD_COL   = '160px';
  const LANG_COL    = '180px';
  const gridCols    = `${FIELD_COL} repeat(${languages.length}, ${LANG_COL})`;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[11px] text-gray-400">
          {totalFields} fields · save table after translating
        </p>

        <div className="relative flex" ref={dropRef}>
          <button
            onClick={() => handleAiTranslate(sourceLang?.code ?? '')}
            disabled={translating || languages.length < 2}
            className="flex items-center gap-1.5 text-xs font-medium pl-3 pr-2 py-1.5 rounded-l-md
              bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors
              border-r border-orange-400"
          >
            {translating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
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
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div>

          {/* Column headers */}
          <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: gridCols }}>
            <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Field</div>
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

          <div className="divide-y divide-gray-100">

            {/* ── Scaffold fields ── */}
            {scaffoldFieldsToShow.map((sf, sfi) => (
              <div key={sf.code} className={clsx(sfi % 2 === 1 && 'bg-gray-50/40')}>
                <div className="grid items-center" style={{ gridTemplateColumns: gridCols }}>
                  <div className="px-3 py-2">
                    <p className="text-[11px] font-semibold text-gray-700 truncate leading-tight">{sf.label}</p>
                    <p className="text-[9px] text-gray-400 font-mono leading-tight mt-0.5">{sf.field_type}</p>
                    <p className="text-[9px] text-indigo-300 font-mono leading-tight">{sf.code}</p>
                  </div>
                  {languages.map(lang => {
                    const isDefault = lang.code === defCode;
                    const val    = defaultFieldI18n[sf.code]?.[lang.code] || (isDefault ? sf.label : '');
                    const srcVal = defaultFieldI18n[sf.code]?.[defCode] || sf.label;
                    return (
                      <div key={lang.code} className="px-2 py-1.5 border-l border-gray-100">
                        <Cell
                          value={val}
                          placeholder={isDefault ? '' : srcVal ? `"${srcVal}"` : ''}
                          onChange={v => updateDefaultLabel(sf.code, lang.code, v)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ── User-defined fields ── */}
            {userFields.length > 0 && (
              <div className="border-t-2 border-gray-200">
                <div className="px-3 py-1.5 bg-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custom Fields</p>
                </div>
              </div>
            )}

            {userFields.map((f, fi) => {
              const isToggle  = f.field_type === 'toggle';
              const isSelect  = f.field_type === 'inline_select';
              const hasValues = (isToggle && !!(f.toggleLabels.true_label || f.toggleLabels.false_label)) ||
                                (isSelect && f.options.length > 0);

              return (
                <div key={f._key} className={clsx(fi % 2 === 1 && 'bg-gray-50/40')}>

                  {/* Field label row */}
                  <div className="grid items-center" style={{ gridTemplateColumns: gridCols }}>
                    <div className="px-3 py-2">
                      <p className="text-[11px] font-semibold text-gray-700 truncate leading-tight">{f.label || f.code}</p>
                      <p className="text-[9px] text-gray-400 font-mono leading-tight mt-0.5">
                        {f.field_type}
                        {hasValues && <span className="ml-1 text-indigo-400">+values</span>}
                      </p>
                    </div>
                    {languages.map(lang => {
                      const isDefault = lang.code === defCode;
                      const val    = f.labelI18n[lang.code] || (isDefault ? f.label : '');
                      const srcVal = f.labelI18n[defCode] || f.label;
                      return (
                        <div key={lang.code} className="px-2 py-1.5 border-l border-gray-100">
                          <Cell
                            value={val}
                            placeholder={isDefault ? '' : srcVal ? `"${srcVal}"` : ''}
                            onChange={v => updateFieldLabel(f._key, lang.code, v)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Toggle value sub-rows */}
                  {isToggle && (
                    <>
                      {!!f.toggleLabels.true_label && (
                        <div className="grid items-center border-t border-gray-100 bg-gray-50"
                          style={{ gridTemplateColumns: gridCols }}>
                          <div className="px-3 py-1.5 flex items-center gap-1.5">
                            <span className="w-3 h-px bg-gray-300 shrink-0" />
                            <div>
                              <p className="text-[10px] text-gray-500">When ON</p>
                              <p className="text-[9px] text-gray-400 font-mono truncate">{f.toggleLabels.true_label}</p>
                            </div>
                          </div>
                          {languages.map(lang => {
                            const isDefault = lang.code === defCode;
                            const val    = f.toggleLabels.trueLabelI18n[lang.code] || (isDefault ? f.toggleLabels.true_label : '');
                            const srcVal = f.toggleLabels.trueLabelI18n[defCode] || f.toggleLabels.true_label;
                            return (
                              <div key={lang.code} className="px-2 py-1 border-l border-gray-100">
                                <Cell value={val} muted
                                  placeholder={isDefault ? '' : srcVal ? `"${srcVal}"` : ''}
                                  onChange={v => updateToggleValue(f._key, 'true', lang.code, v)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!!f.toggleLabels.false_label && (
                        <div className="grid items-center border-t border-gray-100 bg-gray-50"
                          style={{ gridTemplateColumns: gridCols }}>
                          <div className="px-3 py-1.5 flex items-center gap-1.5">
                            <span className="w-3 h-px bg-gray-300 shrink-0" />
                            <div>
                              <p className="text-[10px] text-gray-500">When OFF</p>
                              <p className="text-[9px] text-gray-400 font-mono truncate">{f.toggleLabels.false_label}</p>
                            </div>
                          </div>
                          {languages.map(lang => {
                            const isDefault = lang.code === defCode;
                            const val    = f.toggleLabels.falseLabelI18n[lang.code] || (isDefault ? f.toggleLabels.false_label : '');
                            const srcVal = f.toggleLabels.falseLabelI18n[defCode] || f.toggleLabels.false_label;
                            return (
                              <div key={lang.code} className="px-2 py-1 border-l border-gray-100">
                                <Cell value={val} muted
                                  placeholder={isDefault ? '' : srcVal ? `"${srcVal}"` : ''}
                                  onChange={v => updateToggleValue(f._key, 'false', lang.code, v)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Inline select option sub-rows */}
                  {isSelect && f.options.map(o => (
                    <div key={o._optKey} className="grid items-center border-t border-gray-100 bg-gray-50"
                      style={{ gridTemplateColumns: gridCols }}>
                      <div className="px-3 py-1.5 flex items-center gap-1.5">
                        <span className="w-3 h-px bg-gray-300 shrink-0" />
                        <div>
                          <p className="text-[10px] text-gray-500 truncate">{o.label || o.code}</p>
                          <p className="text-[9px] text-gray-400 font-mono">{o.code}</p>
                        </div>
                      </div>
                      {languages.map(lang => {
                        const isDefault = lang.code === defCode;
                        const val    = o.labelI18n[lang.code] || (isDefault ? o.label : '');
                        const srcVal = o.labelI18n[defCode] || o.label;
                        return (
                          <div key={lang.code} className="px-2 py-1 border-l border-gray-100">
                            <Cell value={val} muted
                              placeholder={isDefault ? '' : srcVal ? `"${srcVal}"` : ''}
                              onChange={v => updateOptionLabel(f._key, o._optKey, lang.code, v)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dropOpen && <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />}
    </div>
  );
}
