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

let inMemorySessionId = null;

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
    throw new Error(payload.error ?? 'Failed to sync diagram state');
  }

  return payload;
}

export async function submitDiagramIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/intent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders() },
    body: JSON.stringify({ prompt, revisionId, mermaidSource, settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Intent request failed');
  }

  return payload;
}

export async function submitCoAuthorIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/coauthor`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders() },
    body: JSON.stringify({ prompt, revisionId, mermaidSource, trigger: 'manual', settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Co-author request failed');
  }

  return payload;
}

export async function submitStyleIntent({ prompt, revisionId, mermaidSource, settings }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/style`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders() },
    body: JSON.stringify({ prompt, stylePrompt: prompt, revisionId, mermaidSource, settings })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? 'Style request failed');
  }

  return payload;
}

export function deriveOptimisticState(currentState, prompt) {
  return {
    ...currentState,
    mermaidSource: `${currentState.mermaidSource}\n  Pending[${prompt.slice(0, 30)}...]`,
    updatedAt: new Date().toISOString()
  };
}

export const fallbackState = createInitialDiagramState();
