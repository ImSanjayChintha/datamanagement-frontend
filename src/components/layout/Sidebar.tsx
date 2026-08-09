import { NavLink } from 'react-router-dom';
import { Layers, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '@/core/auth';
import { NAV_ITEMS, BOTTOM_NAV_ITEMS } from '@/lib/navConfig';

/** Derives display initials from full_name ("John Doe" → "JD") or email ("j@…" → "J"). */
function userInitials(fullName?: string | null, email?: string | null): string {
  const name = fullName ?? email ?? '?';
  return name
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg transition-colors',
    isActive ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200',
  );

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="w-20 h-screen bg-gray-900 text-gray-100 shrink-0 overflow-y-auto">
      <div className="flex flex-col min-h-full">

        {/* Brand — sticks to top while scrolling */}
        <div className="sticky top-0 z-10 flex flex-col items-center justify-center py-4 gap-0.5 border-b border-gray-800 bg-gray-900">
          <Layers size={20} className="text-indigo-400" />
          <span className="text-[8px] font-bold text-indigo-400 tracking-widest uppercase">CoreX</span>
        </div>

        {/* Main nav — grows to push bottom section down */}
        <nav className="flex-1 flex flex-col items-center gap-0.5 py-3">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end, disabled }) =>
            disabled ? (
              <div
                key={to}
                title={`${label} — coming soon`}
                className="flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg text-gray-700 cursor-not-allowed select-none"
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </div>
            ) : (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon size={18} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </NavLink>
            )
          )}
        </nav>

        {/* Bottom — sticks to bottom while scrolling */}
        <div className="sticky bottom-0 flex flex-col items-center gap-1 pb-4 bg-gray-900">
          {BOTTOM_NAV_ITEMS.map(({ to, icon: Icon, label, disabled }) =>
            disabled ? (
              <div
                key={to}
                title={`${label} — coming soon`}
                className="flex flex-col items-center gap-1 w-14 py-2.5 rounded-lg text-gray-700 cursor-not-allowed select-none"
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </div>
            ) : (
              <NavLink key={to} to={to} className={navLinkClass}>
                <Icon size={18} />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </NavLink>
            )
          )}

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
