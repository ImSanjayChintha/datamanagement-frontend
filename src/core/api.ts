import axios from 'axios';
import { useAuthStore } from './auth';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export const apiClient = axios.create({
  baseURL: `${BASE}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().token;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err as Error);
  },
);

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await apiClient.post<ApiResponse<T>>(path, body);
  if (!res.data.success) throw new Error(res.data.error ?? 'Request failed');
  return res.data.data;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    post<{ access_token: string; role: string; admin_id: number; full_name: string | null; must_change_password: boolean }>(
      '/auth/admin/login', { email, password },
    ),
  me: () => post<{ id: number; email: string; full_name: string; role: string }>('/admin/users/me'),
  changePassword: (data: { current_password?: string; new_password: string }) =>
    post<{ changed: boolean }>('/auth/admin/change-password', data),
};

export async function postBlob(
  path: string,
  body: unknown = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await apiClient.post(path, body, { responseType: 'blob' });
  const blob = res.data as Blob;

  // Backend errors return JSON with the same envelope shape
  if (blob.type.includes('application/json')) {
    const parsed = JSON.parse(await blob.text()) as { success?: boolean; error?: string };
    throw new Error(parsed.error || 'Request failed');
  }

  const disposition = String(res.headers['content-disposition'] ?? '');
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return { blob, filename: match?.[1] ?? null };
}