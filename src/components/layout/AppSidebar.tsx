import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const {
  Home, Database, Package, Globe, ArrowUpDown, Users, ShoppingCart, TrendingUp,
  Settings, LogOut, Layers, ChevronLeft, ChevronDown, Blocks,
  Columns3, Table2, Terminal, LayoutTemplate,
  Cable, Zap, FileJson, FlaskConical,
  Tag, FolderTree, Send, SlidersHorizontal, Link2,
} = LucideIcons;
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth';
import { QK } from '@/lib/queryKeys';
import { pageDefsApi } from '@/modules/page-manager/page-defs/api';
import type { PageDef } from '@/types/toolkit';

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(fullName?: string | null, email?: string | null) {
  const name = fullName ?? email ?? '?';
  return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
}

type Section = 'root' | 'studio' | 'pim';

function detectSection(pathname: string): Section {
  if (pathname.startsWith('/pim')) return 'pim';
  if (
    pathname.startsWith('/toolkit') ||
    pathname.startsWith('/gateway') ||
    pathname.startsWith('/api-bridge') ||
    pathname.startsWith('/destinations')
  ) return 'studio';
  return 'root';
}

// ── Shared nav item style ──────────────────────────────────────────────────────

const navLink = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex flex-row items-center gap-2 w-full px-3 py-1.5 rounded-lg transition-colors',
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
  );

// ── Bottom strip (shared across all sections) ──────────────────────────────────

function BottomStrip() {
  const { user, logout } = useAuthStore();
  return (
    <div className="sticky bottom-0 flex flex-col gap-0 pb-1 px-2 bg-gray-900">
      <div className="border-t border-gray-800 mb-0.5" />

      <div
        title="Settings — coming soon"
        className="flex flex-row items-center gap-2 w-full px-3 py-1 rounded-lg text-gray-700 cursor-not-allowed select-none"
      >
        <Settings size={16} />
        <span className="text-[11px] font-medium">Settings</span>
      </div>

      <div className="border-t border-gray-800 my-0.5" />

      <div className="flex flex-row items-center gap-2 px-3 py-1.5">
        <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
          {initials(user?.full_name, user?.email)}
        </div>
        <span className="text-[10px] text-gray-400 leading-none truncate">
          {user?.role ?? 'admin'}
        </span>
      </div>

      <button
        onClick={logout}
        title="Sign out"
        className="flex flex-row items-center gap-2 w-full px-3 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-red-400 transition-colors"
      >
        <LogOut size={15} />
        <span className="text-[11px] font-medium">Logout</span>
      </button>
    </div>
  );
}

// ── Section header (logo + label) ──────────────────────────────────────────────

function SectionBrand({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="sticky top-0 z-10 flex flex-col items-center justify-center py-2 gap-0.5 border-b border-gray-800 bg-gray-900">
      <Icon size={18} className="text-indigo-400" />
      <span className="text-[8px] font-bold text-indigo-400 tracking-widest uppercase">{label}</span>
    </div>
  );
}

// ── Back-to-home row ───────────────────────────────────────────────────────────

function BackToHome() {
  const navigate = useNavigate();
  return (
    <>
      <button
        onClick={() => navigate('/')}
        className="flex flex-row items-center gap-2 w-full px-3 py-1.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
        <span className="text-[11px] font-medium">Home</span>
      </button>
      <div className="border-t border-gray-800 my-1 mx-2" />
    </>
  );
}

// ── Section nav link list ──────────────────────────────────────────────────────

interface NavEntry {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

function SectionNav({ items }: { items: NavEntry[] }) {
  return (
    <nav className="flex-1 flex flex-col gap-0.5 py-1 px-2 w-full">
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to + label} to={to} end={end} className={navLink}>
          <Icon size={16} />
          <span className="text-[11px] font-medium truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

// ── Studio sidebar (Toolkit + API Manager + Page Manager) ─────────────────────

interface StudioGroup {
  key:         string;
  label:       string;
  icon:        LucideIcon;
  items:       NavEntry[];
  matchPrefix: string[];
}

const STUDIO_GROUPS: StudioGroup[] = [
  {
    key:   'toolkit',
    label: 'Toolkit',
    icon:  Database,
    items: [
      { to: '/toolkit/common-fields', icon: Columns3, label: 'Fields',  end: false },
      { to: '/toolkit/tables',        icon: Table2,   label: 'Tables',  end: false },
      { to: '/toolkit/sql',           icon: Terminal, label: 'Console', end: false },
    ],
    matchPrefix: ['/toolkit/common-fields', '/toolkit/tables', '/toolkit/sql'],
  },
  {
    key:   'api',
    label: 'API Manager',
    icon:  Globe,
    items: [
      { to: '/api-bridge/resources', icon: Cable,        label: 'Resources', end: false },
      { to: '/gateway/endpoints',    icon: Zap,          label: 'Endpoints', end: false },
      { to: '/gateway/docs',         icon: FileJson,     label: 'OpenAPI',   end: false },
      { to: '/gateway/swagger',      icon: FlaskConical, label: 'Swagger',   end: false },
      { to: '/destinations',         icon: Send,         label: 'Push',      end: false },
    ],
    matchPrefix: ['/api-bridge', '/gateway', '/destinations'],
  },
  {
    key:   'pages',
    label: 'Page Manager',
    icon:  LayoutTemplate,
    items: [
      { to: '/toolkit/page-defs', icon: LayoutTemplate, label: 'Page Definitions', end: false },
    ],
    matchPrefix: ['/toolkit/page-defs'],
  },
];

function StudioSidebar() {
  const { pathname } = useLocation();

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const g of STUDIO_GROUPS) {
      if (g.matchPrefix.some(p => pathname.startsWith(p))) open.add(g.key);
    }
    if (open.size === 0) STUDIO_GROUPS.forEach(g => open.add(g.key));
    return open;
  });

  useEffect(() => {
    for (const g of STUDIO_GROUPS) {
      if (g.matchPrefix.some(p => pathname.startsWith(p))) {
        setOpenGroups(prev => prev.has(g.key) ? prev : new Set([...prev, g.key]));
      }
    }
  }, [pathname]);

  function toggle(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <aside className="w-48 h-screen bg-gray-900 text-gray-100 shrink-0 overflow-y-auto">
      <div className="flex flex-col min-h-full">
        <SectionBrand icon={Blocks} label="Studio" />
        <div className="flex flex-col pt-1 px-2">
          <BackToHome />
        </div>
        <nav className="flex-1 flex flex-col py-1 px-2 gap-0.5">
          {STUDIO_GROUPS.map(group => (
            <div key={group.key}>
              <button
                onClick={() => toggle(group.key)}
                className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <group.icon size={14} />
                <span className="text-[10px] font-semibold uppercase tracking-wider flex-1 text-left">
                  {group.label}
                </span>
                <ChevronDown
                  size={12}
                  className={clsx('transition-transform duration-150', !openGroups.has(group.key) && '-rotate-90')}
                />
              </button>
              {openGroups.has(group.key) && (
                <div className="pl-3 flex flex-col gap-0.5 pb-1">
                  {group.items.map(({ to, icon: Icon, label, end }) => (
                    <NavLink key={to} to={to} end={end} className={navLink}>
                      <Icon size={14} />
                      <span className="text-[11px] font-medium truncate">{label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <BottomStrip />
      </div>
    </aside>
  );
}

// ── Icon resolver — fully dynamic, covers all ~1400 Lucide icons ─────────────

function resolveIcon(name: string | null | undefined): LucideIcon {
  const icon = name ? (LucideIcons as Record<string, unknown>)[name] : null;
  return (icon ?? SlidersHorizontal) as LucideIcon;
}

// ── PIM sidebar ────────────────────────────────────────────────────────────────

const HARDCODED_PIM_ITEMS: NavEntry[] = [
  { to: '/pim/products',          icon: Package,           label: 'Products',          end: false },
  { to: '/pim/attributes',        icon: SlidersHorizontal, label: 'Attributes',        end: false },
  { to: '/pim/brands',            icon: Tag,               label: 'Brands',            end: false },
  { to: '/pim/categories',        icon: FolderTree,        label: 'Categories',        end: false },
  { to: '/pim/family_attributes', icon: Link2,             label: 'Family Attributes', end: false },
];

const pimNavLink = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex flex-row items-center gap-2 w-full px-3 py-1.5 rounded-lg transition-colors',
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-300 hover:bg-gray-800 hover:text-white',
  );

function PimSectionNav({ items }: { items: NavEntry[] }) {
  return (
    <nav className="flex-1 flex flex-col gap-0.5 py-1 px-2 w-full">
      {items.map(({ to, icon: Icon, label, end }) => (
        <NavLink key={to + label} to={to} end={end} className={pimNavLink}>
          <Icon size={15} />
          <span className="text-[11px] font-medium truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function PimSidebar() {
  const { data: pageDefsResult } = useQuery({
    queryKey: QK.pageDefs('pim'),
    queryFn:  () => pageDefsApi.list({ nav_section: 'pim', is_active: true, page_size: 200 }),
    staleTime: 5 * 60_000,
  });
  const pageDefs = pageDefsResult?.rows ?? [];

  const items: NavEntry[] = pageDefs.length > 0
    ? pageDefs
        .sort((a, b) => a.nav_order - b.nav_order || a.code.localeCompare(b.code))
        .map(d => ({
          to:    `/pim/${d.code}`,
          icon:  resolveIcon(d.icon),
          label: d.nav_label ?? d.title,
          end:   false,
        }))
    : HARDCODED_PIM_ITEMS;

  return (
    <aside className="w-48 h-screen bg-gray-900 text-gray-100 shrink-0 overflow-y-auto">
      <div className="flex flex-col min-h-full">
        <SectionBrand icon={Package} label="PIM" />
        <div className="flex flex-col pt-1 px-2">
          <BackToHome />
        </div>
        <PimSectionNav items={items} />
        <BottomStrip />
      </div>
    </aside>
  );
}

// ── Root sidebar ───────────────────────────────────────────────────────────────

interface RootEntry {
  to: string;
  icon: LucideIcon;
  label: string;
  section?: Section;
  disabled?: boolean;
}

const ROOT_ITEMS: RootEntry[] = [
  { to: '/',               icon: Home,        label: 'Home',   section: 'root'   },
  { to: '/toolkit',        icon: Blocks,      label: 'Studio', section: 'studio' },
  { to: '/pim/attributes', icon: Package,     label: 'PIM',    section: 'pim'    },
  { to: '/import-export',  icon: ArrowUpDown, label: 'Import', disabled: true    },
  { to: '/users',          icon: Users,       label: 'Users',  disabled: true    },
  { to: '/ecommerce',      icon: ShoppingCart,label: 'Store',  disabled: true    },
  { to: '/sales',          icon: TrendingUp,  label: 'Sales',  disabled: true    },
];

function RootSidebar() {
  const { pathname } = useLocation();
  const currentSection = detectSection(pathname);

  return (
    <aside className="w-44 h-screen bg-gray-900 text-gray-100 shrink-0 overflow-y-auto">
      <div className="flex flex-col min-h-full">

        {/* Brand */}
        <div className="sticky top-0 z-10 flex flex-col items-center justify-center py-2 gap-0.5 border-b border-gray-800 bg-gray-900">
          <Layers size={18} className="text-indigo-400" />
          <span className="text-[8px] font-bold text-indigo-400 tracking-widest uppercase">CoreX</span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col gap-0.5 py-2 px-2">
          {ROOT_ITEMS.map(({ to, icon: Icon, label, section, disabled }) => {
            if (disabled) {
              return (
                <div
                  key={to}
                  title={`${label} — coming soon`}
                  className="flex flex-row items-center gap-2 w-full px-3 py-1 rounded-lg text-gray-700 cursor-not-allowed select-none"
                >
                  <Icon size={16} />
                  <span className="text-[11px] font-medium">{label}</span>
                </div>
              );
            }

            if (section === 'root') {
              return (
                <NavLink key={to} to={to} end className={navLink}>
                  <Icon size={16} />
                  <span className="text-[11px] font-medium">{label}</span>
                </NavLink>
              );
            }

            const isActive = section ? currentSection === section : false;
            return (
              <NavLink
                key={to}
                to={to}
                className={clsx(
                  'flex flex-row items-center gap-2 w-full px-3 py-1.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                )}
              >
                <Icon size={16} />
                <span className="text-[11px] font-medium">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <BottomStrip />
      </div>
    </aside>
  );
}

// ── Export: unified smart sidebar ─────────────────────────────────────────────

export default function AppSidebar() {
  const { pathname } = useLocation();
  const section = detectSection(pathname);

  if (section === 'studio') return <StudioSidebar />;
  if (section === 'pim')    return <PimSidebar />;
  return <RootSidebar />;
}
