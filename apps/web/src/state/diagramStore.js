import { createInitialDiagramState, createInitialSessionState } from '@mermaid-architect/shared';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
/** In production, leave `VITE_API_BASE_URL` unset for same-origin `/api/...` (Cloud Run). In dev, defaults to the local server. */
export const API_BASE_URL = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:4000'
    : '';
export const SESSION_HEADER = 'x-session-id';
const BROWSER_SESSION_STORAGE_KEY = 'mermaid-architect:session-id';
const DIAGRAM_CACHE_STORAGE_KEY = 'mermaid-architect:diagram-cache-v2';
const AGENT_REQUEST_TIMEOUT_MS = 60_000;
const MAX_SESSION_ID_LENGTH = 128;
const SESSION_ID_ALLOWED_CHARS = /[^a-zA-Z0-9._-]/g;
/** Max gap between SSE events before we treat the stream as hung and abort. Resets on every event. */
const AGENT_STREAM_IDLE_TIMEOUT_MS = 60_000;

let inMemorySessionId = null;

function throwApiPayloadError(payload, fallback) {
  const text = [payload?.error, payload?.message, payload?.details].filter(Boolean).join('\n').trim();
  throw new Error(text || fallback);
}

export function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSessionId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return null;

  const normalized = candidate.replace(SESSION_ID_ALLOWED_CHARS, '-').slice(0, MAX_SESSION_ID_LENGTH);
  return normalized || null;
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

function getDiagramCacheKey(sessionId) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  return normalizedSessionId ? `${DIAGRAM_CACHE_STORAGE_KEY}:${normalizedSessionId}` : DIAGRAM_CACHE_STORAGE_KEY;
}

export function readDiagramCache(sessionId) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getDiagramCacheKey(sessionId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiagramCache(payload, sessionId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getDiagramCacheKey(sessionId), JSON.stringify(payload ?? {}));
  } catch {
    // Ignore localStorage quota/privacy errors.
  }
}

function createSessionHeaders(sessionId) {
  const resolvedSessionId = normalizeSessionId(sessionId) ?? getOrCreateBrowserSessionId();
  return {
    [SESSION_HEADER]: resolvedSessionId
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

export async function fetchDiagramState({ contentType, sessionId } = {}) {
  const url = contentType
    ? `${API_BASE_URL}/api/copilotkit/state?contentType=${encodeURIComponent(contentType)}`
    : `${API_BASE_URL}/api/copilotkit/state`;
  const response = await fetch(url, {
    headers: createSessionHeaders(sessionId)
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch state: ${response.status}`);
  }
  return response.json();
}

export async function syncClientDiagramState({ contentType = 'mermaid', diagramSource, styleConfig, sessionId }) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/state`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
    body: JSON.stringify({
      contentType,
      diagramSource,
      ...(styleConfig != null ? { styleConfig } : {})
    })
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
  diagramSource,
  contentType = 'mermaid',
  settings,
  focusNode,
  modelProfile,
  sessionId
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/intent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        prompt,
        revisionId,
        diagramSource,
        contentType,
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

export async function submitDiagramTransform({
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  mode,
  focusNode,
  modelProfile,
  goMadDepth,
  sessionId
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/transform`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        revisionId,
        diagramSource,
        contentType,
        mode,
        focusNode,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(typeof goMadDepth === 'number' && Number.isFinite(goMadDepth) ? { goMadDepth } : {})
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

export async function submitDiagramAnalyze({
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  kind,
  focusNode,
  modelProfile,
  sessionId
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/analyze`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        revisionId,
        diagramSource,
        contentType,
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
 *
 * Includes an idle timeout: if no event arrives for AGENT_STREAM_IDLE_TIMEOUT_MS, the stream is
 * aborted as if the caller's signal fired. Healthy agent runs emit phase/status/token/tool events
 * well within that gap, so this only fires on truly hung streams.
 */
export async function streamDiagramAgent(payload, onEvent, options = {}) {
  const { signal: callerSignal, sessionId } = options;
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const idleController = new AbortController();
  let idleTimedOut = false;
  let idleTimer = null;
  const armIdleTimer = () => {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      idleController.abort();
    }, AGENT_STREAM_IDLE_TIMEOUT_MS);
  };
  const clearIdleTimer = () => {
    if (idleTimer != null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  let onCallerAbort = null;
  if (callerSignal) {
    onCallerAbort = () => idleController.abort();
    callerSignal.addEventListener('abort', onCallerAbort);
  }
  const signal = idleController.signal;
  armIdleTimer();

  const isAbortError = (err) =>
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError');

  try {
    const response = await fetch(`${API_BASE_URL}/api/copilotkit/agent-stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
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

    try {
      while (true) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch (readErr) {
          if (callerSignal?.aborted || isAbortError(readErr)) {
            if (idleTimedOut) {
              throw new Error('Agent stream stalled (no events received). Please try again.');
            }
            throw new DOMException('Aborted', 'AbortError');
          }
          throw readErr;
        }
        const { done, value } = chunk;
        if (done) break;
        armIdleTimer();
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
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore double-release / aborted streams.
      }
    }
  } catch (err) {
    if (idleTimedOut && isAbortError(err)) {
      throw new Error('Agent stream stalled (no events received). Please try again.');
    }
    throw err;
  } finally {
    clearIdleTimer();
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}

export const fallbackState = createInitialDiagramState();
export const fallbackSessionState = createInitialSessionState();
