const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

/** In production, leave `VITE_API_BASE_URL` unset for same-origin `/api/...` (Cloud Run). In dev, defaults to the local server. */
export const API_BASE_URL = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:4000'
    : '';

export const SESSION_HEADER = 'x-session-id';

export const BROWSER_SESSION_STORAGE_KEY = 'archislop:session-id';

const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_ALLOWED_CHARS = /[^a-zA-Z0-9._-]/g;

let inMemorySessionId: string | null = null;

export function createSessionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSessionId(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;

  const normalized = candidate.replace(SESSION_ID_ALLOWED_CHARS, '-').slice(0, MAX_SESSION_ID_LENGTH);
  return normalized || null;
}

export function getOrCreateBrowserSessionId(): string {
  if (typeof window === 'undefined') {
    inMemorySessionId ??= createSessionId();
    return inMemorySessionId;
  }

  const existing = window.localStorage.getItem(BROWSER_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const next = createSessionId();
  window.localStorage.setItem(BROWSER_SESSION_STORAGE_KEY, next);
  return next;
}

/** Clears the non-persisted session id used in SSR/test environments. */
export function clearInMemoryBrowserSessionId(): void {
  inMemorySessionId = null;
}

export function clearBrowserBackupSessionId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BROWSER_SESSION_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
