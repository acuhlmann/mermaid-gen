import { createInitialDiagramState } from '@mermaid-architect/shared';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
/** In production, leave `VITE_API_BASE_URL` unset for same-origin `/api/...` (Cloud Run). In dev, defaults to the local server. */
export const API_BASE_URL = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:4000'
    : '';
export const SESSION_HEADER = 'x-session-id';
const BROWSER_SESSION_STORAGE_KEY = 'mermaid-architect:session-id';
const AGENT_REQUEST_TIMEOUT_MS = 60_000;

let inMemorySessionId = null;

function throwApiPayloadError(payload, fallback) {
  const text = [payload?.error, payload?.message, payload?.details].filter(Boolean).join('\n').trim();
  throw new Error(text || fallback);
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateBrowserSessionId() {
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

function createSessionHeaders() {
  return {
    [SESSION_HEADER]: getOrCreateBrowserSessionId()
  };
}

async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(timeoutMessage)), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message === timeoutMessage) {
      throw new Error(timeoutMessage, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDiagramState() {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`, {
    headers: createSessionHeaders()
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch state: ${response.status}`);
  }
  return response.json();
}

export async function syncClientDiagramState({ mermaidSource, styleConfig }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders() },
    body: JSON.stringify({ mermaidSource, styleConfig })
  });

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Failed to sync diagram state');
  }

  return payload;
}

export async function submitDiagramIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/intent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders() },
      body: JSON.stringify({ prompt, revisionId, mermaidSource, settings })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Helper agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Intent request failed');
  }

  return payload;
}

export async function submitCoAuthorIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/coauthor`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders() },
      body: JSON.stringify({ prompt, revisionId, mermaidSource, trigger: 'manual', settings })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Surprise me agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Co-author request failed');
  }

  return payload;
}

export const fallbackState = createInitialDiagramState();
