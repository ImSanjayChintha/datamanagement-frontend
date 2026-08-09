import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Database, Package, Globe, ArrowUpDown, Users, ShoppingCart, TrendingUp,
  Sparkles, Languages, Shield, Code2, ArrowRight, CheckCircle2, Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { toolkitTablesApi } from '@/modules/toolkit/core/api';
import type { ToolkitTable } from '@/types/toolkit';
import { QK } from '@/lib/queryKeys';
import { HOME_CONTENT, LANG_NAMES } from './data/content';
import type { PillarIcon } from './data/content';

// ── Module structural config ───────────────────────────────────────────────────
interface ModuleConfig {
  id: string;
  icon: LucideIcon;
  href?: string;
}

const MODULES: ModuleConfig[] = [
  { id: 'db-toolkit',    icon: Database,     href: '/toolkit' },
  { id: 'pim',           icon: Package,      href: '/pim/attributes' },
  { id: 'api',           icon: Globe },
  { id: 'import-export', icon: ArrowUpDown },
  { id: 'users',         icon: Users },
  { id: 'ecommerce',     icon: ShoppingCart },
  { id: 'sales',         icon: TrendingUp },
];

// Modules grouped by phase — structural, not localized
const PHASE_MODULES = [
  ['pim', 'api'],
  ['import-export', 'users'],
  ['ecommerce', 'sales'],
] as const;

const PILLAR_ICONS: Record<PillarIcon, LucideIcon> = {
  Sparkles, Languages, Shield, Code2,
};

// ── Color themes — all static Tailwind strings for JIT ────────────────────────
const THEMES = {
  'db-toolkit': {
    stripe:       'from-blue-500 to-indigo-600',
    icon_bg:      'bg-blue-600',
    icon_txt:     'text-white',
    hover_border: 'hover:border-blue-300',
    cta_txt:      'text-blue-700 hover:text-blue-800',
    pill_active:  'bg-emerald-50 text-emerald-700 border border-emerald-200',
    panel_bg:     'bg-blue-50',
    icon_color:   'text-blue-500',
    label_txt:    'text-blue-600',
    accent_ring:  'ring-blue-100',
  },
  pim: {
    stripe:       'from-violet-500 to-purple-600',
    icon_bg:      'bg-violet-100',
    icon_txt:     'text-violet-600',
    hover_border: 'hover:border-violet-200',
    cta_txt:      'text-violet-600',
    pill_active:  '',
    panel_bg:     'bg-violet-50',
    icon_color:   'text-violet-500',
    label_txt:    'text-violet-600',
    accent_ring:  'ring-violet-100',
  },
  api: {
    stripe:       'from-emerald-500 to-teal-600',
    icon_bg:      'bg-emerald-100',
    icon_txt:     'text-emerald-600',
    hover_border: 'hover:border-emerald-200',
    cta_txt:      'text-emerald-600',
    pill_active:  '',
    panel_bg:     'bg-emerald-50',
    icon_color:   'text-emerald-500',
    label_txt:    'text-emerald-600',
    accent_ring:  'ring-emerald-100',
  },
  'import-export': {
    stripe:       'from-amber-400 to-orange-500',
    icon_bg:      'bg-amber-100',
    icon_txt:     'text-amber-600',
    hover_border: 'hover:border-amber-200',
    cta_txt:      'text-amber-600',
    pill_active:  '',
    panel_bg:     'bg-amber-50',
    icon_color:   'text-amber-500',
    label_txt:    'text-amber-600',
    accent_ring:  'ring-amber-100',
  },
  users: {
    stripe:       'from-cyan-500 to-sky-600',
    icon_bg:      'bg-cyan-100',
    icon_txt:     'text-cyan-600',
    hover_border: 'hover:border-cyan-200',
    cta_txt:      'text-cyan-600',
    pill_active:  '',
    panel_bg:     'bg-cyan-50',
    icon_color:   'text-cyan-500',
    label_txt:    'text-cyan-600',
    accent_ring:  'ring-cyan-100',
  },
  ecommerce: {
    stripe:       'from-rose-500 to-pink-600',
    icon_bg:      'bg-rose-100',
    icon_txt:     'text-rose-600',
    hover_border: 'hover:border-rose-200',
    cta_txt:      'text-rose-600',
    pill_active:  '',
    panel_bg:     'bg-rose-50',
    icon_color:   'text-rose-500',
    label_txt:    'text-rose-600',
    accent_ring:  'ring-rose-100',
  },
  sales: {
    stripe:       'from-indigo-500 to-violet-600',
    icon_bg:      'bg-indigo-100',
    icon_txt:     'text-indigo-600',
    hover_border: 'hover:border-indigo-200',
    cta_txt:      'text-indigo-600',
    pill_active:  '',
    panel_bg:     'bg-indigo-50',
    icon_color:   'text-indigo-500',
    label_txt:    'text-indigo-600',
    accent_ring:  'ring-indigo-100',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

// ── Featured card art ──────────────────────────────────────────────────────────
function FeaturedArt() {
  return (
    <div className="relative w-full h-full flex items-center justify-center min-h-[200px] rounded-2xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="absolute top-4 right-4 w-24 h-24 rounded-full bg-blue-100/60" />
      <div className="absolute bottom-4 left-4 w-16 h-16 rounded-full bg-indigo-100/50" />
      <div className="absolute inset-0 m-6 rounded-xl border border-blue-100/70" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-200">
          <Database size={38} className="text-white" />
        </div>
      </div>
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-blue-200 shadow-sm text-[9px] font-semibold text-blue-700 whitespace-nowrap">
        SQL Console
      </div>
      <div className="absolute bottom-5 left-5 flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-violet-200 shadow-sm text-[9px] font-semibold text-violet-700">
        <Sparkles size={8} /> AI Generate
      </div>
      <div className="absolute bottom-5 right-5 flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-emerald-200 shadow-sm text-[9px] font-semibold text-emerald-700">
        <Languages size={8} /> i18n
      </div>
    </div>
  );
}

// ── Featured module card ───────────────────────────────────────────────────────
interface FeaturedCardProps {
  config: ModuleConfig;
  text: { title: string; description: string; status_label: string; launch_label?: string; features?: string[] };
  onNavigate: (href: string) => void;
}

function FeaturedModuleCard({ config, text, onNavigate }: FeaturedCardProps) {
  const theme = THEMES[config.id as ThemeKey];
  return (
    <div
      className="group relative flex flex-col lg:flex-row rounded-2xl overflow-hidden border border-blue-100 bg-white cursor-pointer transition-all duration-200 hover:border-blue-300 hover:shadow-2xl hover:shadow-blue-50 hover:-translate-y-1"
      onClick={() => onNavigate(config.href!)}
    >
      <div className="lg:w-72 shrink-0 p-5">
        <FeaturedArt />
      </div>
      <div className="flex-1 p-7 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-blue-50">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mb-3', theme.pill_active)}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {text.status_label}
            </span>
            <h3 className="text-2xl font-extrabold text-gray-900 leading-tight">{text.title}</h3>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-5 max-w-lg">{text.description}</p>
        {text.features && (
          <div className="flex flex-wrap gap-2 mb-6">
            {text.features.map(f => (
              <span key={f} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700">
                <Check size={11} className="text-blue-500" />
                {f}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 group-hover:shadow-blue-200">
            {text.launch_label}
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onNavigate('/toolkit/sql'); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            SQL Console
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Roadmap module card (horizontal, storytelling) ─────────────────────────────
interface ModuleCardProps {
  config: ModuleConfig;
  text: { title: string; hook?: string; description: string; status_label: string };
}

function ModuleCard({ config, text }: ModuleCardProps) {
  const navigate = useNavigate();
  const theme = THEMES[config.id as ThemeKey];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'group flex rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5', theme.hover_border,
        config.href ? 'cursor-pointer' : '',
      )}
      onClick={() => config.href && navigate(config.href)}
    >
      {/* Left color panel */}
      <div className={clsx('w-24 shrink-0 flex items-center justify-center py-6', theme.panel_bg)}>
        <Icon size={26} className={theme.icon_color} />
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-5 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={clsx('text-[10px] font-bold uppercase tracking-widest', theme.label_txt)}>
            {text.title}
          </span>
          {config.href && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1 h-1 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-800 leading-snug mb-1.5">
          {text.hook ?? text.title}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {text.description}
        </p>
      </div>
    </div>
  );
}

// ── Hero illustration ──────────────────────────────────────────────────────────
function PlatformIllustration() {
  const icons = [
    { icon: Database,     bg: 'rgba(59,130,246,0.25)',  label: 'DB Toolkit' },
    { icon: Package,      bg: 'rgba(139,92,246,0.25)',  label: 'PIM Admin' },
    { icon: Globe,        bg: 'rgba(16,185,129,0.25)',  label: 'API Admin' },
    { icon: ArrowUpDown,  bg: 'rgba(245,158,11,0.25)',  label: 'Import/Export' },
    { icon: Users,        bg: 'rgba(6,182,212,0.25)',   label: 'Users' },
    { icon: ShoppingCart, bg: 'rgba(244,63,94,0.25)',   label: 'E-Commerce' },
  ];
  return (
    <div className="relative w-full select-none pointer-events-none" aria-hidden>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.12)' }} />
      <div className="relative grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {icons.map(({ icon: Icon, bg, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2.5 p-3 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: bg }}>
              <Icon size={20} className="text-white/85" />
            </div>
            <span className="text-[8px] font-semibold text-white/80 text-center leading-tight">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Browser language detection ─────────────────────────────────────────────────
function detectLang(): string {
  const lang = (navigator.language ?? 'en').split('-')[0];
  return HOME_CONTENT[lang] ? lang : 'en';
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AppHomePage() {
  const navigate = useNavigate();
  const modulesRef = useRef<HTMLElement>(null);
  const [lang, setLang] = useState(detectLang);
  const c = HOME_CONTENT[lang] ?? HOME_CONTENT.en;
  const availableLangs = Object.keys(HOME_CONTENT);

  const { data: tables = [] } = useQuery<ToolkitTable[]>({
    queryKey: QK.tables(),
    queryFn: () => toolkitTablesApi.list(),
    staleTime: 30_000,
  });

  const totalTables = tables.length;
  const totalFields = tables.reduce((sum, t) => sum + (t.field_count ?? 0), 0);

  const stats = [
    { label: c.stats.modules_total,  value: MODULES.length.toString() },
    { label: c.stats.modules_active, value: MODULES.filter(m => m.href).length.toString() },
    { label: c.stats.tables,         value: totalTables.toString() },
    { label: c.stats.fields,         value: totalFields.toString() },
  ];

  const featuredModule = MODULES.find(m => m.href)!;

  return (
    <div className="-m-6 overflow-x-hidden" dir={c.dir}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0c3170 0%, #0052a3 40%, #0078d4 75%, #40a9ff 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.08)' }} />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(59,130,246,0.07)' }} />

        {/* Language switcher */}
        <div className="absolute top-4 right-6 flex items-center gap-1 z-10">
          {availableLangs.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                lang === l ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/10',
              )}
            >
              {LANG_NAMES[l] ?? l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative max-w-6xl mx-auto px-8 py-16 lg:py-20 grid lg:grid-cols-[58%_42%] gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: 'rgba(199,210,254,0.9)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              {c.hero.eyebrow}
            </div>
            <div>
              <p className="text-lg text-white/50 font-medium mb-1">{c.platform_name}</p>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] tracking-tight">
                {c.hero.title}
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-violet-300 bg-clip-text text-transparent">
                  {c.hero.title_accent}
                </span>
              </h1>
            </div>
            <p className="text-base text-white/55 leading-relaxed max-w-xl">{c.hero.subtitle}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => navigate('/toolkit')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white text-slate-900 hover:bg-blue-50 transition-colors shadow-2xl shadow-black/30"
              >
                <Database size={15} />
                {c.hero.cta_toolkit}
              </button>
              <button
                onClick={() => modulesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white/8 text-white border border-white/15 hover:bg-white/12 transition-colors"
              >
                {c.hero.cta_modules}
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1">
              {['DB Toolkit', 'PIM Admin', 'API Admin', 'Import/Export', 'User Auth', 'E-Commerce', 'Sales'].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-[11px] text-white/70">
                  <CheckCircle2 size={11} className="text-blue-200/80 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex items-center justify-center">
            <PlatformIllustration />
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="max-w-6xl mx-auto px-8 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x divide-white/8">
            {stats.map(({ label, value }) => (
              <div key={label} className="px-4 first:pl-0 last:pr-0 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white tabular-nums">{value}</span>
                <span className="text-[10px] text-white/35 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Module Suite ───────────────────────────────────────────────────── */}
      <section ref={modulesRef} className="bg-white px-8 py-16">
        <div className="max-w-6xl mx-auto">

          {/* Heading */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{c.suite_heading}</h2>
            <p className="mt-3 text-base text-gray-500 max-w-2xl mx-auto">{c.suite_sub}</p>
          </div>

          {/* ── Available now ── */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {c.label_available}
              </div>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {featuredModule && c.modules[featuredModule.id] && (
              <FeaturedModuleCard
                config={featuredModule}
                text={c.modules[featuredModule.id]}
                onNavigate={navigate}
              />
            )}
          </div>

          {/* ── Roadmap ── */}
          <div>
            {/* Editorial intro */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-gray-200" />
                {c.label_coming_soon}
              </div>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <div className="mb-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{c.roadmap_heading}</h3>
              <p className="text-base text-gray-500 max-w-2xl">{c.roadmap_sub}</p>
            </div>

            {/* Phase groups */}
            <div className="space-y-10">
              {c.phases.map((phase, phaseIdx) => {
                const moduleIds = PHASE_MODULES[phaseIdx];
                return (
                  <div key={phase.label} className="flex gap-6">

                    {/* Timeline column */}
                    <div className="flex flex-col items-center shrink-0 pt-1">
                      <div className="w-9 h-9 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
                        <span className="text-xs font-bold text-gray-400">{phaseIdx + 2}</span>
                      </div>
                      {phaseIdx < c.phases.length - 1 && (
                        <div className="w-px flex-1 mt-3 min-h-[60px]" style={{ background: 'linear-gradient(to bottom, #e5e7eb, transparent)' }} />
                      )}
                    </div>

                    {/* Phase content */}
                    <div className="flex-1 pb-2">
                      {/* Phase header */}
                      <div className="mb-5">
                        <div className="flex items-baseline gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{phase.label}</span>
                          <span className="text-sm font-bold text-gray-700">{phase.name}</span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">{phase.story}</p>
                      </div>

                      {/* Module cards */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        {moduleIds.map(id => {
                          const config = MODULES.find(m => m.id === id);
                          const text = c.modules[id];
                          if (!config || !text) return null;
                          return <ModuleCard key={id} config={config} text={text} />;
                        })}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* ── Platform Pillars ───────────────────────────────────────────────── */}
      <section className="bg-gray-50 px-8 py-16 border-t border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">{c.pillars_heading}</h2>
            <p className="mt-2 text-sm text-gray-500 max-w-xl mx-auto">{c.pillars_sub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[p.icon];
              const colors = [
                'text-indigo-600 bg-indigo-50',
                'text-amber-600 bg-amber-50',
                'text-blue-600 bg-blue-50',
                'text-emerald-600 bg-emerald-50',
              ];
              return (
                <div key={i} className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-white border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colors[i % colors.length])}>
                    <Icon size={18} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{p.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section
        className="px-8 py-16"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #4f46e5 100%)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{c.cta.heading}</h2>
            <p className="mt-2 text-sm text-blue-200/70 max-w-lg">{c.cta.sub}</p>
          </div>
          <button
            onClick={() => navigate('/toolkit')}
            className="shrink-0 flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-sm font-bold bg-white text-blue-900 hover:bg-blue-50 transition-colors shadow-2xl shadow-black/25 whitespace-nowrap"
          >
            <Database size={15} />
            {c.cta.button}
            <ArrowRight size={14} />
          </button>
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
