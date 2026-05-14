import { createInitialDiagramState, createInitialSessionState } from '@archislop/shared';

const rawApiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
/** In production, leave `VITE_API_BASE_URL` unset for same-origin `/api/...` (Cloud Run). In dev, defaults to the local server. */
export const API_BASE_URL = rawApiBase
  ? rawApiBase.replace(/\/+$/, '')
  : import.meta.env.DEV
    ? 'http://localhost:4000'
    : '';
export const SESSION_HEADER = 'x-session-id';
const BROWSER_SESSION_STORAGE_KEY = 'archislop:session-id';
const DIAGRAM_CACHE_STORAGE_KEY = 'archislop:diagram-cache-v2';
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
 * Translates an AG-UI wire event back into the legacy internal event shape that
 * App.jsx already consumes. State across an SSE run (open message id, cached
 * state snapshot) is held by the closure returned from createAgUiTranslator.
 *
 * Mapping summary:
 *   STEP_STARTED                                 -> { type:'phase', id, label }
 *   TEXT_MESSAGE_CONTENT                         -> { type:'token', text }
 *   STATE_DELTA(/lastPatchSummary)               -> { type:'artifact', kind:'patch_summary' }
 *   STATE_DELTA(/<contentType>/draftSource)      -> { type:'draftPreview', contentType, source }
 *   STATE_SNAPSHOT                               -> cached, attached to RUN_FINISHED
 *   RUN_FINISHED                                 -> { type:'final', state, message, ... }
 *   RUN_ERROR                                    -> { type:'error', message }
 *   CUSTOM(status)                               -> { type:'status', text }
 *   TOOL_CALL_START/END                          -> { type:'tool_start' | 'tool_end', name }
 *
 * Legacy event shapes pass through unchanged so the server can mix protocols.
 */
export function createAgUiTranslator() {
  let lastSnapshot = null;
  return function translate(evt) {
    if (!evt || typeof evt !== 'object') return null;
    switch (evt.type) {
      case 'RUN_STARTED':
        // Surface so the UI can show "starting" affordances; carries no
        // user-visible text but the optimistic chip path needs the trigger.
        return { type: 'phase', id: 'run_started', label: 'Starting…' };
      case 'STEP_STARTED':
        return { type: 'phase', id: evt.stepName || 'step', label: evt.stepName || 'Working…' };
      case 'STEP_FINISHED':
        return null; // no legacy equivalent; the next STEP_STARTED overwrites
      case 'TEXT_MESSAGE_START':
      case 'TEXT_MESSAGE_END':
        return null;
      case 'TEXT_MESSAGE_CONTENT': {
        const text = typeof evt.delta === 'string' ? evt.delta : '';
        if (!text) return null;
        return { type: 'token', text };
      }
      case 'TOOL_CALL_START':
        return { type: 'tool_start', name: String(evt.toolCallName ?? 'tool') };
      case 'TOOL_CALL_END':
        return { type: 'tool_end', name: '' };
      case 'TOOL_CALL_ARGS':
        return null; // not surfaced legacy-side
      case 'STATE_SNAPSHOT':
        lastSnapshot = evt.snapshot ?? null;
        return null;
      case 'STATE_DELTA': {
        const ops = Array.isArray(evt.delta) ? evt.delta : [];
        // Live infographic/mermaid draft preview rides on /<contentType>/draftSource.
        // Surface as the legacy draftPreview event the App.jsx switch already
        // consumes, so the React state plumbing doesn't need to know the wire
        // moved from CUSTOM to STATE_DELTA.
        const draftOp = ops.find(
          (op) => typeof op?.path === 'string' && /^\/(mermaid|infographic)\/draftSource$/.test(op.path)
        );
        if (draftOp) {
          const ct = draftOp.path.split('/')[1];
          if (draftOp.op === 'remove') {
            return { type: 'draftPreview', contentType: ct, source: '', delta: '' };
          }
          const v = typeof draftOp.value === 'string' ? draftOp.value : '';
          return { type: 'draftPreview', contentType: ct, source: v, delta: '' };
        }
        // Convert the route's synthetic JSON Patch back into a patch_summary
        // artifact so existing UI sparklines/insight chips keep working.
        const summaryOp = ops.find((op) => op?.path === '/lastPatchSummary');
        if (summaryOp?.value) {
          const v = summaryOp.value;
          return {
            type: 'artifact',
            kind: 'patch_summary',
            revisionId: v.revisionId ?? 0,
            linesAdded: v.linesAdded ?? 0,
            linesRemoved: v.linesRemoved ?? 0
          };
        }
        return null;
      }
      case 'RUN_FINISHED': {
        const result = evt.result ?? {};
        const out = {
          type: 'final',
          revisionChanged: Boolean(result.revisionChanged),
          ...(typeof result.message === 'string' ? { message: result.message } : {}),
          ...(typeof result.analyzeText === 'string' ? { analyzeText: result.analyzeText } : {}),
          ...(lastSnapshot ? { state: lastSnapshot } : {})
        };
        lastSnapshot = null;
        return out;
      }
      case 'RUN_ERROR':
        return { type: 'error', message: String(evt.message ?? 'Unknown error') };
      case 'CUSTOM': {
        if (evt.name === 'status') {
          const text = evt.value?.text ?? '';
          return { type: 'status', text };
        }
        if (evt.name === 'artifact') return evt.value ?? null;
        return null;
      }
      default:
        // Legacy event shape — pass through unchanged.
        return evt;
    }
  };
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

  const translate = createAgUiTranslator();

  try {
    const response = await fetch(`${API_BASE_URL}/api/copilotkit/agent-stream?protocol=agui`, {
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
            const translated = translate(evt);
            if (translated) onEvent(translated);
            if (evt?.type === 'done' || evt?.type === 'RUN_FINISHED' || evt?.type === 'RUN_ERROR') {
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
