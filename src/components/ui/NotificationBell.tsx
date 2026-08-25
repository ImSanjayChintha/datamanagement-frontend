/**
 * Notification bell — dropdown panel for import/export job updates.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Download, Trash2, X } from 'lucide-react';
import { clsx } from 'clsx';
import {
  selectUnreadCount,
  useNotificationStore,
  type AppNotification,
} from '@/core/notificationStore';
import { downloadExportFile } from '@/core/importNotifications';

function timeAgo(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function kindStyles(kind: AppNotification['kind']) {
  if (kind === 'success') return 'border-l-emerald-500';
  if (kind === 'error') return 'border-l-red-500';
  return 'border-l-sky-500';
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore(selectUnreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const clearAll = useNotificationStore((s) => s.clearAll);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onItemClick = async (n: AppNotification) => {
    markRead(n.id);
    if (n.downloadable && n.jobId) {
      try {
        await downloadExportFile(n.jobId, n.fileName || 'export.xlsx');
      } catch {
        /* download errors stay silent in panel; user can retry */
      }
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-lg border',
          'border-gray-200 bg-white text-gray-600 shadow-sm',
          'hover:bg-gray-50 hover:text-gray-900 transition-colors',
        )}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={clsx(
            'absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] z-50',
            'rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="text-sm font-semibold text-gray-800">Notifications</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={unread === 0}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                  unread === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-indigo-600 hover:bg-indigo-50',
                )}
                title="Mark all read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearAll()}
                  className="inline-flex items-center rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50"
                  title="Clear all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <div
                      className={clsx(
                        'group flex gap-2 border-l-4 px-3 py-2.5 cursor-pointer transition-colors',
                        kindStyles(n.kind),
                        n.read ? 'bg-white' : 'bg-indigo-50/40',
                        'hover:bg-gray-50',
                      )}
                      onClick={() => void onItemClick(n)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void onItemClick(n);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={clsx('text-sm text-gray-900', !n.read && 'font-semibold')}>
                            {n.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-gray-400 mt-0.5">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.message}</p>
                        {n.downloadable && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600">
                            <Download size={12} />
                            Click to download
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-500 shrink-0"
                        title="Dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(n.id);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
