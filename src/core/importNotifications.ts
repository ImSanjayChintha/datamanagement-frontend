/**
 * Import job SSE notifications + refresh recovery (PostgreSQL is source of truth).
 * One connection per authenticated session — mounted from main.tsx.
 *
 * Reliability:
 *  - SSE for instant completion/failure toasts
 *  - PG recovery on connect/reconnect
 *  - Watched job IDs (from enqueue) get a light status check until terminal
 *    so a missed Redis event still surfaces a toast
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/core/api';
import { useAuthStore } from '@/core/auth';

const NOTIFIED_KEY = 'import-notified-job-ids';
const WATCH_KEY = 'import-watch-job-ids';
const SSE_PATH = '/admin/toolkit/import/events';
const WATCH_POLL_MS = 8_000;

type ImportEventPayload = {
  event?: string;
  job_id?: string;
  status?: string;
  file_name?: string | null;
  family_code?: string | null;
  success_rows?: number;
  failed_rows?: number;
  source_rows?: number;
  error_message?: string;
  user_id?: number;
};

type ImportJobRow = {
  job_id?: string;
  id?: string;
  status?: string;
  file_name?: string | null;
  family_code?: string | null;
  success_rows?: number;
  failed_rows?: number;
  source_rows?: number;
  rows_written?: number;
  error_message?: string | null;
  completed_at?: string | null;
};

function loadIdSet(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key: string, ids: Set<string>) {
  sessionStorage.setItem(key, JSON.stringify([...ids].slice(-200)));
}

function loadNotified(): Set<string> {
  return loadIdSet(NOTIFIED_KEY);
}

function markNotified(jobId: string) {
  const s = loadNotified();
  s.add(jobId);
  saveIdSet(NOTIFIED_KEY, s);
}

function wasNotified(jobId: string) {
  return loadNotified().has(jobId);
}

/** Call after enqueue so completion is tracked even if SSE misses the Redis event. */
export function watchImportJob(jobId: string) {
  if (!jobId) return;
  const s = loadIdSet(WATCH_KEY);
  s.add(jobId);
  saveIdSet(WATCH_KEY, s);
}

function unwatchImportJob(jobId: string) {
  const s = loadIdSet(WATCH_KEY);
  s.delete(jobId);
  saveIdSet(WATCH_KEY, s);
}

function formatCompleted(p: ImportEventPayload | ImportJobRow) {
  const name = p.file_name || p.family_code || 'Import';
  const ok = p.success_rows ?? (p as ImportJobRow).rows_written ?? 0;
  return `${name} — ${Number(ok).toLocaleString()} record(s) imported`;
}

function notifyTerminal(payload: ImportEventPayload | ImportJobRow, eventHint?: string) {
  const jobId = String(payload.job_id || (payload as ImportJobRow).id || '');
  if (!jobId || wasNotified(jobId)) return;

  const status = payload.status;
  const event =
    eventHint ||
    (status === 'completed' ? 'IMPORT_COMPLETED' : status === 'failed' ? 'IMPORT_FAILED' : '');

  if (event === 'IMPORT_COMPLETED' || status === 'completed') {
    toast.success(`Import completed successfully. ${formatCompleted(payload)}`, {
      duration: 7000,
      id: `import-ok-${jobId}`,
    });
    markNotified(jobId);
    unwatchImportJob(jobId);
    return true;
  }
  if (event === 'IMPORT_FAILED' || status === 'failed') {
    const err = (payload as ImportEventPayload).error_message || 'Import failed';
    toast.error(`Import failed: ${String(err).slice(0, 240)}`, {
      duration: 9000,
      id: `import-err-${jobId}`,
    });
    markNotified(jobId);
    unwatchImportJob(jobId);
    return true;
  }
  return false;
}

/**
 * Parse SSE text chunks into { event, data } messages.
 */
function parseSseChunk(
  buffer: string,
  onEvent: (event: string, data: string) => void,
): string {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    if (!block.trim() || block.startsWith(':')) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) onEvent(event, dataLines.join('\n'));
  }
  return rest;
}

async function fetchRecentJobs(): Promise<ImportJobRow[]> {
  const res = await apiClient.get<{ success: boolean; data: ImportJobRow[] }>(
    '/admin/toolkit/import/jobs',
    { params: { limit: 30 } },
  );
  if (!res.data?.success) return [];
  return res.data.data ?? [];
}

async function fetchJob(jobId: string): Promise<ImportJobRow | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: ImportJobRow }>(
      `/admin/toolkit/import/jobs/${jobId}`,
    );
    if (!res.data?.success) return null;
    return res.data.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Global hook: one SSE stream + PG recovery + watched-job status checks.
 */
export function useImportJobNotifications() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) {
      abortRef.current?.abort();
      abortRef.current = null;
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
      return;
    }

    let cancelled = false;
    let attempt = 0;

    const onTerminal = (payload: ImportEventPayload | ImportJobRow, eventName?: string) => {
      const shown = notifyTerminal(payload, eventName);
      if (
        shown &&
        (payload.status === 'completed' || eventName === 'IMPORT_COMPLETED')
      ) {
        qc.invalidateQueries({ queryKey: ['pim-products'] });
      }
    };

    const handlePayload = (eventName: string, raw: string) => {
      try {
        const payload = JSON.parse(raw) as ImportEventPayload;
        onTerminal(payload, eventName);
      } catch {
        /* ignore malformed */
      }
    };

    const recoverFromPostgres = async () => {
      try {
        const jobs = await fetchRecentJobs();
        const cutoff = Date.now() - 48 * 60 * 60 * 1000;
        const watched = loadIdSet(WATCH_KEY);
        for (const job of jobs) {
          const id = String(job.job_id || job.id || '');
          if (job.status === 'completed' || job.status === 'failed') {
            const doneAt = job.completed_at ? Date.parse(job.completed_at) : 0;
            // Always surface watched jobs; otherwise only recent terminals
            if (!watched.has(id) && doneAt && doneAt < cutoff) continue;
            onTerminal(job);
          }
        }
      } catch {
        /* offline / auth — ignore */
      }
    };

    const checkWatchedJobs = async () => {
      const watched = [...loadIdSet(WATCH_KEY)];
      if (!watched.length) return;
      for (const jobId of watched) {
        if (wasNotified(jobId)) {
          unwatchImportJob(jobId);
          continue;
        }
        const job = await fetchJob(jobId);
        if (!job) continue;
        if (job.status === 'completed' || job.status === 'failed') {
          onTerminal({ ...job, job_id: job.job_id || job.id || jobId });
        }
      }
    };

    const connect = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      await recoverFromPostgres();
      await checkWatchedJobs();
      if (cancelled) return;

      const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
      const url = `${base}/api/v1${SSE_PATH}`;

      try {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          buf = parseSseChunk(buf, handlePayload);
        }
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) return;
      }

      if (cancelled) return;
      attempt += 1;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      reconnectRef.current = setTimeout(() => {
        void connect();
      }, delay);
    };

    void connect();
    watchTimerRef.current = setInterval(() => {
      void checkWatchedJobs();
    }, WATCH_POLL_MS);

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, [token, qc]);
}
