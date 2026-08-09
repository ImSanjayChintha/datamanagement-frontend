import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL_CONTENT, LANG_NAMES } from './data/content';
import type { LegalPageId } from './data/content';
import { clsx } from 'clsx';

function detectLang(): string {
  const lang = (navigator.language ?? 'en').split('-')[0];
  return LEGAL_CONTENT[lang] ? lang : 'en';
}

export default function LegalPage() {
  const { page } = useParams<{ page: string }>();
  const navigate = useNavigate();
  const [lang, setLang] = useState(detectLang);

  const c = LEGAL_CONTENT[lang] ?? LEGAL_CONTENT.en;
  const pageId = (page ?? 'privacy') as LegalPageId;
  const content = c.pages[pageId];

  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-500">Page not found.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-blue-600 hover:underline">
          {c.back}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={c.dir}>

      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={15} />
            {c.back}
          </button>

          {/* Language switcher */}
          <div className="flex items-center gap-1">
            {Object.keys(LEGAL_CONTENT).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                  lang === l
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                )}
              >
                {LANG_NAMES[l] ?? l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">CorexStack</p>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-4">{content.title}</h1>
          <p className="text-base text-gray-500 leading-relaxed">{content.intro}</p>
        </div>

        <div className="space-y-8">
          {content.sections.map((section, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-7">
              <h2 className="text-base font-bold text-gray-900 mb-3">{section.heading}</h2>
              <div className="space-y-2">
                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-gray-300">
          © 2026 CorexStack
        </p>
      </main>

    </div>
  );
}
