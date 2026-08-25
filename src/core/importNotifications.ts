/**
 * Toolkit job SSE notifications (import + export) + refresh recovery.
 * One connection per authenticated session — mounted from main.tsx.
 * Terminal events go to the notification bell (not toast popups).
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { useAuthStore } from '@/core/auth';
import { useNotificationStore } from '@/core/notificationStore';

const NOTIFIED_KEY = 'import-notified-job-ids';
const WATCH_KEY = 'import-watch-job-ids';
const SSE_PATH = '/admin/toolkit/import/events';
const WATCH_POLL_MS = 8_000;

type JobEventPayload = {
  event?: string;
  job_id?: string;
  status?: string;
  job_type?: string;
  file_name?: string | null;
  family_code?: string | null;
  success_rows?: number;
  failed_rows?: number;
  source_rows?: number;
  error_message?: string;
  user_id?: number;
  download_ready?: boolean;
};

type JobRow = {
  job_id?: string;
  id?: string;
  status?: string;
  job_type?: string;
  file_name?: string | null;
  family_code?: string | null;
  success_rows?: number;
  failed_rows?: number;
  source_rows?: number;
  rows_written?: number;
  error_message?: string | null;
  completed_at?: string | null;
  result_file_path?: string | null;
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

export const watchToolkitJob = watchImportJob;

function unwatchImportJob(jobId: string) {
  const s = loadIdSet(WATCH_KEY);
  s.delete(jobId);
  saveIdSet(WATCH_KEY, s);
}

export async function downloadExportFile(jobId: string, fileName: string) {
  const res = await apiClient.get(`/admin/toolkit/export/jobs/${jobId}/download`, {
    responseType: 'blob',
  });
  const blob = res.data as Blob;
  if (blob.type.includes('application/json')) {
    const parsed = JSON.parse(await blob.text()) as { error?: string };
    throw new Error(parsed.error || 'Download failed');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'export.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

function isExportJob(jobType?: string | null) {
  return jobType === 'export_template' || jobType === 'export_data';
}

function isFailureEvent(event?: string, status?: string) {
  return (
    status === 'failed'
    || event === 'IMPORT_FAILED'
    || event === 'EXPORT_TEMPLATE_FAILED'
    || event === 'EXPORT_DATA_FAILED'
    || event === 'JOB_FAILED'
  );
}

function isSuccessEvent(event?: string, status?: string) {
  return (
    status === 'completed'
    || event === 'IMPORT_COMPLETED'
    || event === 'EXPORT_TEMPLATE_COMPLETED'
    || event === 'EXPORT_DATA_COMPLETED'
    || event === 'JOB_COMPLETED'
  );
}

function pushBell(payload: JobEventPayload | JobRow, eventHint?: string) {
  const jobId = String(payload.job_id || (payload as JobRow).id || '');
  if (!jobId || wasNotified(jobId)) return false;

  const status = payload.status;
  const event = eventHint || '';
  const jobType = payload.job_type || 'import';
  const add = useNotificationStore.getState().add;

  if (isFailureEvent(event, status)) {
    const label = isExportJob(jobType) ? 'Export' : 'Import';
    const err = (payload as JobEventPayload).error_message || `${label} failed`;
    add({
      id: `job-${jobId}`,
      jobId,
      jobType,
      kind: 'error',
      title: `${label} failed`,
      message: String(err).slice(0, 400),
    });
    markNotified(jobId);
    unwatchImportJob(jobId);
    return true;
  }

  if (isSuccessEvent(event, status)) {
    if (isExportJob(jobType)) {
      const name = payload.file_name || 'Excel file';
      const kindLabel = jobType === 'export_template' ? 'Template' : 'Export';
      add({
        id: `job-${jobId}`,
        jobId,
        jobType,
        fileName: name,
        downloadable: true,
        kind: 'success',
        title: `${kindLabel} ready`,
        message: `${name} — click to download`,
      });
      void downloadExportFile(jobId, name).catch(() => {
        add({
          id: `job-${jobId}-dl`,
          jobId,
          jobType,
          kind: 'error',
          title: 'Download failed',
          message: `Could not download ${name}. Open notifications and try again.`,
        });
      });
    } else {
      const rows = payload.success_rows ?? (payload as JobRow).rows_written ?? 0;
      const name = payload.file_name || payload.family_code || 'Import';
      add({
        id: `job-${jobId}`,
        jobId,
        jobType,
        kind: 'success',
        title: 'Import completed',
        message: `${name} — ${Number(rows).toLocaleString()} record(s) imported`,
      });
    }
    markNotified(jobId);
    unwatchImportJob(jobId);
    return true;
  }
  return false;
}

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

async function fetchRecentJobs(): Promise<JobRow[]> {
  const res = await apiClient.get<{ success: boolean; data: JobRow[] }>(
    '/admin/toolkit/import/jobs',
    { params: { limit: 30 } },
  );
  if (!res.data?.success) return [];
  return res.data.data ?? [];
}

async function fetchJob(jobId: string): Promise<JobRow | null> {
  try {
    const res = await apiClient.get<{ success: boolean; data: JobRow }>(
      `/admin/toolkit/import/jobs/${jobId}`,
    );
    if (!res.data?.success) return null;
    return res.data.data ?? null;
  } catch {
    return null;
  }
}

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

    const onTerminal = (payload: JobEventPayload | JobRow, eventName?: string) => {
      const shown = pushBell(payload, eventName);
      if (
        shown
        && (payload.job_type === 'import' || !payload.job_type)
        && isSuccessEvent(eventName, payload.status)
      ) {
        qc.invalidateQueries({ queryKey: ['pim-products'] });
      }
    };

    const handlePayload = (eventName: string, raw: string) => {
      try {
        const payload = JSON.parse(raw) as JobEventPayload;
        onTerminal(payload, eventName);
      } catch {
        /* ignore */
      }
    };

    const recoverFromPostgres = async () => {
      try {
        const jobs = await fetchRecentJobs();
        const cutoff = Date.now() - 48 * 60 * 60 * 1000;
        const watched = loadIdSet(WATCH_KEY);
        for (const job of jobs) {
          const id = String(job.job_id || job.id || '');
          if (job.status !== 'completed' && job.status !== 'failed') continue;
          const doneAt = job.completed_at ? Date.parse(job.completed_at) : 0;
          if (!watched.has(id) && doneAt && doneAt < cutoff) continue;
          onTerminal(job);
        }
      } catch {
        /* ignore */
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
        if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`);
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
