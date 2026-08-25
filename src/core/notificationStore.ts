/**
 * In-app notification store (bell panel). Persisted per browser.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationKind = 'success' | 'error' | 'info';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  kind: NotificationKind;
  jobId?: string;
  jobType?: string;
  fileName?: string;
  downloadable?: boolean;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  items: AppNotification[];
  add: (n: Omit<AppNotification, 'read' | 'createdAt'> & { createdAt?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

const MAX_ITEMS = 50;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      items: [],
      add: (n) =>
        set((state) => {
          const id = n.id;
          const without = state.items.filter((x) => x.id !== id);
          const next: AppNotification = {
            ...n,
            read: false,
            createdAt: n.createdAt ?? new Date().toISOString(),
          };
          return { items: [next, ...without].slice(0, MAX_ITEMS) };
        }),
      markRead: (id) =>
        set((state) => ({
          items: state.items.map((x) => (x.id === id ? { ...x, read: true } : x)),
        })),
      markAllRead: () =>
        set((state) => ({
          items: state.items.map((x) => ({ ...x, read: true })),
        })),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter((x) => x.id !== id),
        })),
      clearAll: () => set({ items: [] }),
    }),
    { name: 'app-notifications' },
  ),
);

export function selectUnreadCount(state: NotificationState) {
  return state.items.filter((x) => !x.read).length;
}
