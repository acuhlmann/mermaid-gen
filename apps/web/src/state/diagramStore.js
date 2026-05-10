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
const DIAGRAM_CACHE_STORAGE_KEY = 'mermaid-architect:diagram-cache-v1';
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

export function readDiagramCache() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(DIAGRAM_CACHE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiagramCache(payload) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DIAGRAM_CACHE_STORAGE_KEY, JSON.stringify(payload ?? {}));
  } catch {
    // Ignore localStorage quota/privacy errors.
  }
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

export async function submitDiagramIntent({
  prompt,
  revisionId,
  mermaidSource,
  settings,
  focusNode,
  modelProfile
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/intent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders() },
      body: JSON.stringify({
        prompt,
        revisionId,
        mermaidSource,
        settings,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {})
      })
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

export async function submitDiagramTransform({ revisionId, mermaidSource, mode, focusNode, modelProfile }) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/transform`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders() },
      body: JSON.stringify({
        revisionId,
        mermaidSource,
        mode,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {})
      })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Transform agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Transform request failed');
  }

  return payload;
}

export async function submitDiagramAnalyze({ revisionId, mermaidSource, kind, focusNode, modelProfile }) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/analyze`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders() },
      body: JSON.stringify({
        revisionId,
        mermaidSource,
        kind,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {})
      })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Analyze request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Analyze request failed');
  }

  return payload;
}

/**
 * Streams SSE events from POST /api/copilotkit/agent-stream.
 * Each parsed event is passed to onEvent. Resolves when the stream ends or `done` is received.
 */
export async function streamDiagramAgent(payload, onEvent, options = {}) {
  const { signal } = options;
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/agent-stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders() },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    throwApiPayloadError(errPayload, `Stream request failed (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Streaming response had no body.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      if (!raw.startsWith('data:')) continue;
      const jsonText = raw.slice(5).trim();
      if (!jsonText) continue;
      try {
        const evt = JSON.parse(jsonText);
        onEvent(evt);
        if (evt.type === 'done') {
          return;
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    }
  }
}

export const fallbackState = createInitialDiagramState();
