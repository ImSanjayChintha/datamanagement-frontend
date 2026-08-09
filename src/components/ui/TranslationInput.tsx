import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { toolkitTranslationsApi, toolkitAiApi } from '@/modules/toolkit/core/api';
import toast from 'react-hot-toast';
import Spinner from './Spinner';

interface Props {
  fieldCode:  string;
  value:      Record<string, string>;
  onChange:   (v: Record<string, string>) => void;
  required?:  boolean;
  label?:     string;
  /** When true: all languages shown as rows, AI button icon-only, no collapse control */
  alwaysOpen?: boolean;
}

export default function TranslationInput({ fieldCode, value, onChange, required, label, alwaysOpen }: Props) {
  const [open,        setOpen]       = useState(false);
  const [translating, setTranslating] = useState(false);

  const { data: langs = [] } = useQuery({
    queryKey: ['toolkit-langs'],
    queryFn:  () => toolkitTranslationsApi.languages(),
    staleTime: 60_000,
  });

  // English always first
  const sorted = [...langs].sort((a, b) => (a.code === 'en' ? -1 : b.code === 'en' ? 1 : 0));

  function set(lang: string, v: string) {
    onChange({ ...value, [lang]: v });
  }

  async function aiTranslate() {
    const enText = value['en'];
    if (!enText) { toast.error('Enter an English value first'); return; }
    const targetLangs = langs.filter(l => l.code !== 'en').map(l => l.code);
    if (!targetLangs.length) { toast('No other languages available'); return; }
    setTranslating(true);
    try {
      const result = await toolkitAiApi.translate({ [fieldCode]: enText }, 'en', targetLangs);
      const fieldResult = result[fieldCode] ?? {};
      onChange({ ...value, ...fieldResult });
      toast.success('AI translations applied');
    } catch {
      toast.error('Translation failed');
    } finally {
      setTranslating(false);
    }
  }

  const hasValue = Object.values(value).some(v => v);
  const isOpen   = alwaysOpen || open;

  return (
    <div className="space-y-1">

      {/* ── Header: label + controls ── */}
      {label && (
        <div className="flex items-center justify-between">
          <span className="label">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
          <div className="flex items-center gap-1">
            {langs.length > 1 && (
              <button
                type="button"
                onClick={aiTranslate}
                disabled={translating}
                title="AI Translate from English"
                className="p-1 rounded text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50
                           dark:hover:bg-indigo-900/20 disabled:opacity-40 transition-colors"
              >
                {translating ? <Spinner size="sm" /> : <Wand2 size={13} />}
              </button>
            )}
            {!alwaysOpen && (
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600
                           dark:hover:text-gray-300 px-1 py-0.5 rounded transition-colors"
              >
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {isOpen ? 'Collapse' : `${sorted.length} languages`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Always-open mode: all languages as uniform rows ── */}
      {alwaysOpen ? (
        <div className="space-y-1">
          {sorted.map(lang => (
            <div key={lang.code} className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider w-8 shrink-0
                               ${lang.code === 'en'
                                 ? 'text-indigo-500 dark:text-indigo-400'
                                 : 'text-gray-400 dark:text-gray-500'}`}>
                {lang.code}
              </span>
              <input
                type="text"
                className="input flex-1"
                placeholder={`${lang.name ?? lang.code}${lang.flag_emoji ? ' ' + lang.flag_emoji : ''}`}
                value={value[lang.code] ?? ''}
                onChange={e => set(lang.code, e.target.value)}
                required={required && lang.code === 'en'}
              />
            </div>
          ))}
        </div>
      ) : (
        /* ── Collapsible mode (original) ── */
        <>
          <input
            type="text"
            className="input"
            placeholder="English (EN)"
            value={value['en'] ?? ''}
            onChange={e => set('en', e.target.value)}
            required={required}
          />
          {isOpen && sorted.filter(l => l.code !== 'en').map(lang => (
            <div key={lang.code} className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 w-8 shrink-0 uppercase">{lang.code}</span>
              <input
                type="text"
                className="input flex-1"
                placeholder={`${lang.name ?? lang.code}${lang.flag_emoji ? ' ' + lang.flag_emoji : ''}`}
                value={value[lang.code] ?? ''}
                onChange={e => set(lang.code, e.target.value)}
              />
            </div>
          ))}
          {!isOpen && hasValue && langs.length > 1 && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {Object.keys(value).filter(k => value[k]).length} / {langs.length} languages filled
            </button>
          )}
        </>
      )}
    </div>
  );
}
