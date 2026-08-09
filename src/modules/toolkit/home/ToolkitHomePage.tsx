import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutGrid, Database, Terminal, Sparkles, Languages, Code2,
  Globe, Plus, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitTablesApi } from '@/modules/toolkit/core/api';
import type { ToolkitTable } from '@/types/toolkit';
import { QK } from '@/lib/queryKeys';
import { HOME_CONTENT, LANG_NAMES } from './data/content';

function detectLang(): string {
  const lang = (navigator.language ?? 'en').split('-')[0];
  return HOME_CONTENT[lang] ? lang : 'en';
}
import type { FeatureItem } from './data/content';

// ── Icon registry — keeps tree-shaking intact (no dynamic lookups) ─────────────
const ICONS = {
  LayoutGrid, Database, Terminal, Sparkles, Languages, Code2,
} as const;

// ── Static color class maps (full strings so Tailwind JIT includes them) ───────
const COLOR = {
  blue: {
    card:  'bg-blue-50 border-blue-100 hover:border-blue-300',
    icon:  'bg-blue-100 text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  sky: {
    card:  'bg-sky-50 border-sky-100 hover:border-sky-300',
    icon:  'bg-sky-100 text-sky-600',
    badge: 'bg-sky-100 text-sky-700',
  },
  emerald: {
    card:  'bg-emerald-50 border-emerald-100 hover:border-emerald-300',
    icon:  'bg-emerald-100 text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  violet: {
    card:  'bg-violet-50 border-violet-100 hover:border-violet-300',
    icon:  'bg-violet-100 text-violet-600',
    badge: 'bg-violet-100 text-violet-700',
  },
  amber: {
    card:  'bg-amber-50 border-amber-100 hover:border-amber-300',
    icon:  'bg-amber-100 text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  rose: {
    card:  'bg-rose-50 border-rose-100 hover:border-rose-300',
    icon:  'bg-rose-100 text-rose-600',
    badge: 'bg-rose-100 text-rose-700',
  },
} as const;

// ── Hero Illustration — mini toolkit UI mockup ─────────────────────────────────
function HeroIllustration() {
  return (
    <div className="relative w-full h-64 xl:h-72 select-none pointer-events-none" aria-hidden>
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-blue-400/15 blur-3xl" />

      {/* Table card */}
      <div
        className="absolute inset-x-0 top-0 mx-2 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.13)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Window chrome */}
        <div
          className="flex items-center gap-1.5 px-3 py-2.5"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
          <span className="ml-2 text-[10px] font-mono text-white/50">pim_products</span>
          <span className="ml-auto text-[9px] text-white/25">4 cols · 4 rows</span>
        </div>

        {/* Column headers */}
        <div
          className="grid font-mono text-[9px]"
          style={{
            gridTemplateColumns: '2fr 3fr 5fr 3fr',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          {['id', 'code', 'label', 'is_active'].map(col => (
            <div key={col} className="px-2.5 py-1.5 text-white/40">{col}</div>
          ))}
        </div>

        {/* Data rows */}
        {[
          { id: '1', code: 'PRD-001', w: 68, active: true },
          { id: '2', code: 'SVC-012', w: 50, active: true },
          { id: '3', code: 'PKG-003', w: 80, active: false },
          { id: '4', code: 'CAT-021', w: 42, active: true },
        ].map((row, i) => (
          <div
            key={i}
            className="grid font-mono"
            style={{
              gridTemplateColumns: '2fr 3fr 5fr 3fr',
              borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : undefined,
            }}
          >
            <div className="px-2.5 py-1.5 text-[9px] text-blue-300/80">{row.id}</div>
            <div className="px-2.5 py-1.5 text-[9px] text-white/55">{row.code}</div>
            <div className="px-2.5 py-2 flex items-center">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${row.w}%`, background: 'rgba(255,255,255,0.18)' }}
              />
            </div>
            <div className="px-2.5 py-1.5">
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                style={
                  row.active
                    ? { background: 'rgba(52,211,153,0.18)', color: 'rgba(110,231,183,0.9)' }
                    : { background: 'rgba(107,114,128,0.18)', color: 'rgba(156,163,175,0.8)' }
                }
              >
                {row.active ? 'true' : 'false'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* SQL terminal */}
      <div
        className="absolute bottom-0 right-0 w-44 rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(9,14,27,0.88)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          className="flex items-center gap-1 px-2.5 py-2"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="w-2 h-2 rounded-full bg-red-400/60" />
          <span className="w-2 h-2 rounded-full bg-yellow-400/60" />
          <span className="w-2 h-2 rounded-full bg-green-400/60" />
          <span className="ml-1.5 text-[9px] font-mono text-gray-500">SQL Console</span>
        </div>
        <div className="p-2.5 space-y-0.5">
          <p className="text-[10px] font-mono">
            <span className="text-sky-400">SELECT</span>{' '}
            <span className="text-white/40">*</span>
          </p>
          <p className="text-[10px] font-mono">
            <span className="text-sky-400">FROM</span>{' '}
            <span className="text-emerald-400">pim_products</span>
          </p>
          <p className="text-[10px] font-mono">
            <span className="text-sky-400">WHERE</span>{' '}
            <span className="text-white/60">is_active</span>{' '}
            <span className="text-yellow-400">=</span>{' '}
            <span className="text-orange-300">true</span>
          </p>
          <p className="mt-1.5 text-[9px] font-mono text-gray-600">-- 3 rows returned</p>
        </div>
      </div>

      {/* AI badge */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
        style={{
          background: 'rgba(139,92,246,0.22)',
          border: '1px solid rgba(139,92,246,0.38)',
          color: 'rgba(216,180,254,0.9)',
        }}
      >
        <Sparkles size={9} />
        AI Generate
      </div>
    </div>
  );
}

// ── Feature Card ───────────────────────────────────────────────────────────────
function FeatureCard({
  feat,
  onNavigate,
}: {
  feat: FeatureItem;
  onNavigate: (href: string) => void;
}) {
  const Icon = ICONS[feat.icon];
  const col = COLOR[feat.color];
  const linked = !!feat.href;

  return (
    <div
      className={clsx(
        'group flex flex-col p-5 rounded-xl border transition-all duration-200',
        col.card,
        linked && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
      )}
      onClick={linked ? () => onNavigate(feat.href!) : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', col.icon)}>
          <Icon size={18} />
        </div>
        {feat.badge && (
          <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none mt-1', col.badge)}>
            {feat.badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{feat.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed flex-1">{feat.description}</p>
      {linked && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
          <span>Open</span>
          <ChevronRight size={12} />
        </div>
      )}
    </div>
  );
}

// ── Home Page ──────────────────────────────────────────────────────────────────
export default function ToolkitHomePage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(detectLang);
  const c = HOME_CONTENT[lang] ?? HOME_CONTENT.en;
  const availableLangs = Object.keys(HOME_CONTENT);

  const { data: tables = [] } = useQuery<ToolkitTable[]>({
    queryKey: QK.tables(),
    queryFn: () => toolkitTablesApi.list(),
    staleTime: 30_000,
  });

  const totalTables = tables.length;
  const activeTables = tables.filter(t => t.is_active).length;
  const totalFields = tables.reduce((sum, t) => sum + (t.field_count ?? 0), 0);

  return (
    <div dir={c.dir} className="-m-6">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0c3170 0%, #0052a3 40%, #0078d4 75%, #40a9ff 100%)' }}
      >
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Language switcher */}
        <div className="absolute top-4 right-6 flex items-center gap-1 z-10">
          {availableLangs.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                lang === l
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/10',
              )}
            >
              {LANG_NAMES[l] ?? l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative px-8 py-12 lg:py-16 max-w-5xl mx-auto grid lg:grid-cols-[55%_45%] gap-10 items-center">

          {/* Left: text content */}
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 border border-blue-400/30 text-blue-200">
              <Globe size={11} />
              {c.hero.eyebrow}
            </span>

            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight tracking-tight">
              {c.hero.title}{' '}
              <span className="bg-gradient-to-r from-blue-300 via-indigo-200 to-sky-200 bg-clip-text text-transparent">
                {c.hero.title_accent}
              </span>
            </h1>

            <p className="text-base text-blue-100/65 leading-relaxed max-w-lg">
              {c.hero.subtitle}
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => navigate('/toolkit/tables/new')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-blue-900 hover:bg-blue-50 transition-colors shadow-lg shadow-black/20"
              >
                <Plus size={15} />
                {c.hero.cta_new}
              </button>
              <button
                onClick={() => navigate('/toolkit/sql')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/15 transition-colors"
              >
                <Terminal size={14} />
                {c.hero.cta_sql}
              </button>
            </div>
          </div>

          {/* Right: illustration (hidden on narrow viewports) */}
          <div className="hidden lg:block">
            <HeroIllustration />
          </div>

        </div>
      </section>

      {/* ── Stats Bar ──────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-8 py-5 grid grid-cols-3 divide-x divide-gray-100">
          {[
            { label: c.stats.tables, value: totalTables },
            { label: c.stats.active, value: activeTables },
            { label: c.stats.fields, value: totalFields },
          ].map(({ label, value }) => (
            <div key={label} className="px-6 first:pl-0 last:pr-0 flex flex-col">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{value}</span>
              <span className="text-xs text-gray-500 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features Grid ──────────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-8 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">{c.features_heading}</h2>
            <p className="mt-2 text-sm text-gray-500">{c.features_sub}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.features.map(feat => (
              <FeatureCard key={feat.id} feat={feat} onNavigate={navigate} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ────────────────────────────────────────────────────── */}
      <section className="bg-white border-t border-gray-100 px-8 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">
              {c.quickstart.eyebrow}
            </p>
            <h2 className="text-2xl font-bold text-gray-900">{c.quickstart.heading}</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connector line between steps */}
            <div className="hidden sm:block absolute top-6 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-gray-200 via-blue-200 to-gray-200" />

            {c.quickstart.steps.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="relative mb-4 z-10">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-blue-500/25">
                    {i + 1}
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-100 px-8 py-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{c.footer.copyright}</p>
          <nav className="flex items-center gap-4">
            <Link to="/legal/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">{c.footer.privacy}</Link>
            <span className="text-gray-200 text-xs">·</span>
            <Link to="/legal/legal" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">{c.footer.legal}</Link>
            <span className="text-gray-200 text-xs">·</span>
            <Link to="/legal/cookies" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">{c.footer.cookies}</Link>
          </nav>
        </div>
      </footer>

    </div>
  );
}
