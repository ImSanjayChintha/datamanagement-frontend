import { NavLink, useNavigate } from 'react-router-dom';
import { Database, Table2, Terminal, Settings, LogOut, ChevronLeft, Columns3, Zap, Cable, Tag, FolderTree } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/core/auth';

function userInitials(fullName?: string | null, email?: string | null): string {
  const name = fullName ?? email ?? '?';
  return name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg transition-colors',
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200',
  );

const NAV = [
  { to: '/toolkit',               icon: Database, label: 'Home',    end: true  },
  { to: '/toolkit/common-fields', icon: Columns3, label: 'Fields',  end: false },
  { to: '/toolkit/tables',        icon: Table2,   label: 'Tables',  end: false },
  { to: '/toolkit/sql',               icon: Terminal,  label: 'Console',  end: false },
  { to: '/pim/brands',      icon: Tag,        label: 'Brands', end: false },
  { to: '/pim/categories', icon: FolderTree, label: 'Categs', end: false },
  { to: '/gateway/endpoints',         icon: Zap,       label: 'APIs',     end: false },
  { to: '/api-bridge/resources',  icon: Cable,    label: 'Bridge',  end: false },
] as const;

export default function ToolkitSidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  return (
    <aside className="w-20 h-screen bg-gray-900 text-gray-100 shrink-0 overflow-y-auto">
      <div className="flex flex-col min-h-full">

        {/* Brand */}
        <div className="sticky top-0 z-10 flex flex-col items-center justify-center py-4 gap-0.5 border-b border-gray-800 bg-gray-900">
          <Database size={20} className="text-indigo-400" />
          <span className="text-[8px] font-bold text-indigo-400 tracking-widest uppercase">Toolkit</span>
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col items-center gap-0.5 py-3">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </NavLink>
          ))}

        </nav>

        {/* Bottom — settings + avatar + logout */}
        <div className="sticky bottom-0 flex flex-col items-center gap-1 pb-4 bg-gray-900">

          {/* Back to platform */}
          <button
            onClick={() => navigate('/')}
            title="Back to platform"
            className="flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg text-gray-600 hover:bg-gray-800 hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={18} />
            <span className="text-[10px] font-medium leading-none">Platform</span>
          </button>

          <div className="w-14 border-t border-gray-800 my-1" />

          {/* Settings */}
          <div
            title="Settings — coming soon"
            className="flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg text-gray-700 cursor-not-allowed select-none"
          >
            <Settings size={18} />
            <span className="text-[10px] font-medium leading-none">Settings</span>
          </div>

          <div className="w-14 border-t border-gray-800 my-1" />

          {/* Avatar */}
          <div className="flex flex-col items-center gap-1 w-14 py-1">
            <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-semibold text-white">
              {userInitials(user?.full_name, user?.email)}
            </div>
            <span className="text-[9px] text-gray-500 leading-none truncate w-full text-center px-1">
              {user?.role}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign out"
            className="flex flex-col items-center gap-1 w-14 py-2 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            <span className="text-[10px] font-medium leading-none">Logout</span>
          </button>
        </div>

      </div>
    </aside>
  );
}
