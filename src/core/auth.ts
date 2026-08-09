import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser { id: number; email: string; full_name: string | null; role: string; }

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  mustChangePassword: boolean;
  setAuth: (token: string, user: AuthUser, mustChange: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      mustChangePassword: false,
      setAuth: (token, user, mustChangePassword) => {
        set({ token, user, mustChangePassword });
      },
      logout: () => {
        set({ token: null, user: null, mustChangePassword: false });
      },
    }),
    { name: 'admin-auth', partialize: (s) => ({ token: s.token, user: s.user, mustChangePassword: s.mustChangePassword }) },
  ),
);
