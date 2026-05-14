import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_STATUS,
  LEGACY_STREAM_TYPE_A2UI,
  createInitialDiagramState,
  createInitialSessionState
} from '@archislop/shared';
import { CopilotStreamHttpAgent } from './copilotStreamHttpAgent.js';

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

/** Removes persisted diagram/insights cache for every session (prefix `archislop:diagram-cache-v2`). */
export function clearAllDiagramCachesFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === DIAGRAM_CACHE_STORAGE_KEY || k.startsWith(`${DIAGRAM_CACHE_STORAGE_KEY}:`)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore privacy / access errors.
  }
}

export function clearBrowserBackupSessionId() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(BROWSER_SESSION_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * After the server reports the session is gone (404/410), drop all client-side session payloads
 * so a new room id does not resurrect stale diagrams, insights, or backup session headers.
 */
export function wipeClientCachesAfterLostServerSession() {
  inMemorySessionId = null;
  clearAllDiagramCachesFromStorage();
  clearBrowserBackupSessionId();
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

export const SESSION_NOT_FOUND_CODE = 'SESSION_NOT_FOUND';

/**
 * Coerce GET /session-state JSON into a full dual-slot shape (stale proxies, redeploys, or
 * partial payloads should not brick the client).
 */
export function normalizeFetchedSessionDiagram(payload) {
  const base = createInitialSessionState();
  if (!payload || typeof payload !== 'object') return base;
  const m = payload.mermaid;
  const i = payload.infographic;
  return {
    activeContentType: payload.activeContentType === 'infographic' ? 'infographic' : base.activeContentType,
    mermaid: m && typeof m === 'object' && typeof m.diagramSource === 'string' ? m : base.mermaid,
    infographic: i && typeof i === 'object' && typeof i.diagramSource === 'string' ? i : base.infographic
  };
}

export async function fetchSessionDiagramState({ sessionId } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/session-state`, {
    headers: createSessionHeaders(sessionId)
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (response.status === 404 || response.status === 410) {
    const err = new Error('Session not found');
    err.code = SESSION_NOT_FOUND_CODE;
    throw err;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch session state: ${response.status}`);
  }
  return normalizeFetchedSessionDiagram(payload);
}

/**
 * Optional sibling-slot payload for diagram↔infographic intent alignment (mode switch).
 * Omits peer when the other slot is still the default seed with no revisions, or when the
 * peer's recorded `lastUserPrompt` does not match the carried topic (do not translate stale
 * content from another topic).
 *
 * @param {string | null | undefined} candidate - topic string from mode-switch carry-over
 */
export function buildIntentPeerContext(contentMode, session, candidate = null) {
  if (!session || (contentMode !== 'mermaid' && contentMode !== 'infographic')) return undefined;
  const otherMode = contentMode === 'mermaid' ? 'infographic' : 'mermaid';
  const peer = session[otherMode];
  if (!peer || typeof peer.diagramSource !== 'string') return undefined;
  const trimmed = peer.diagramSource.trim();
  if (!trimmed) return undefined;
  const initial = createInitialDiagramState(otherMode);
  const looksCustom = (peer.revisionId ?? 0) > 0 || trimmed !== initial.diagramSource.trim();
  if (!looksCustom) return undefined;
  const cand = candidate != null ? String(candidate).trim() : '';
  if (cand) {
    const peerPrompt = typeof peer.lastUserPrompt === 'string' ? peer.lastUserPrompt.trim() : '';
    if (peerPrompt !== cand) return undefined;
  }
  return { contentType: otherMode, diagramSource: peer.diagramSource };
}

/**
 * Whether to auto-fire an intent after a mode switch.
 * Runs when the target slot is not in sync, when we can translate from a topic-aligned peer,
 * or when the peer has no substantive artifact for this topic (then the client clears the
 * target slot and regenerates from the same topic).
 */
export function shouldAutoSubmitModeSwitchIntent({
  candidate,
  textareaDirty,
  newSlotInSync,
  peerContext,
  session,
  contentMode
}) {
  if (!candidate || textareaDirty) return false;
  if (!newSlotInSync) return true;
  if (peerContext) return true;
  if (!session || (contentMode !== 'mermaid' && contentMode !== 'infographic')) return false;
  const otherMode = contentMode === 'mermaid' ? 'infographic' : 'mermaid';
  const peer = session[otherMode];
  const peerPrompt = typeof peer?.lastUserPrompt === 'string' ? peer.lastUserPrompt.trim() : '';
  const cand = String(candidate).trim();
  const peerTopicAligned = peerPrompt === cand;
  const initial = createInitialDiagramState(otherMode);
  const peerCustom =
    peer &&
    typeof peer.diagramSource === 'string' &&
    ((peer.revisionId ?? 0) > 0 || peer.diagramSource.trim() !== initial.diagramSource.trim());
  return !peerTopicAligned || !peerCustom;
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
 * `applyAgentStreamInsightEvent` + the insights pipeline consume. State across
 * an SSE run (cached state snapshot) is held by the closure returned here.
 *
 * When adding a new AG-UI event: map it here, add server mapping in
 * `createAgUiEmit` (apps/server), then handle the legacy shape in
 * `applyAgentStreamInsightEvent` (web).
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
 *   CUSTOM(a2ui)                                 -> { type:'a2ui', messages }
 *   TOOL_CALL_START/END                          -> { type:'tool_start' | 'tool_end', name }
 *
 * Legacy event shapes pass through unchanged for forward-compat tests and proxies.
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
      case 'STEP_STARTED': {
        const raw = String(evt.stepName ?? 'step');
        const sep = raw.indexOf('\x1f');
        if (sep >= 0) {
          const id = raw.slice(0, sep) || 'step';
          const label = raw.slice(sep + 1) || id;
          return { type: 'phase', id, label };
        }
        return { type: 'phase', id: raw, label: raw };
      }
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
        if (evt.name === AGUI_CUSTOM_NAME_STATUS) {
          const text = evt.value?.text ?? '';
          return { type: 'status', text };
        }
        if (evt.name === AGUI_CUSTOM_NAME_A2UI && Array.isArray(evt.value?.messages)) {
          return { type: LEGACY_STREAM_TYPE_A2UI, messages: evt.value.messages };
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
 * Streams SSE from POST /api/copilotkit/agent-stream (AG-UI wire only). Uses
 * @ag-ui/client HttpAgent for decode + validation; `createAgUiTranslator` maps
 * each event to the legacy union consumed by `applyAgentStreamInsightEvent`.
 *
 * Includes an idle timeout: if no event arrives for AGENT_STREAM_IDLE_TIMEOUT_MS, the run is
 * aborted as if the caller's signal fired. Healthy agent runs emit events well within that gap,
 * so this only fires on truly hung streams.
 */
export async function streamDiagramAgent(payload, onEvent, options = {}) {
  const { signal: callerSignal, sessionId } = options;
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const abortController = new AbortController();
  let idleTimedOut = false;
  let idleTimer = null;
  const armIdleTimer = () => {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      abortController.abort();
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
    onCallerAbort = () => abortController.abort();
    callerSignal.addEventListener('abort', onCallerAbort);
  }
  armIdleTimer();

  const isAbortError = (err) =>
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError');

  const translate = createAgUiTranslator();

  const agent = new CopilotStreamHttpAgent(
    {
      url: `${API_BASE_URL}/api/copilotkit/agent-stream?protocol=agui`,
      headers: createSessionHeaders(sessionId)
    },
    payload
  );

  agent.subscribe({
    onEvent: ({ event }) => {
      armIdleTimer();
      const translated = translate(event);
      if (translated) onEvent(translated);
      // HttpAgent's defaultApplyEvents tries to apply STATE_DELTA/SNAPSHOT against
      // its own (always empty here) state/messages and warns on every patch miss.
      // We don't consume agent.state / agent.messages, so short-circuit the apply.
      return { stopPropagation: true };
    }
  });

  let runError = null;
  try {
    await agent.runAgent({ abortController });
  } catch (err) {
    runError = err;
  } finally {
    clearIdleTimer();
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }

  if (idleTimedOut) {
    throw new Error('Agent stream stalled (no events received). Please try again.');
  }
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (runError) {
    if (isAbortError(runError)) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (runError.payload && typeof runError.payload === 'object') {
      throwApiPayloadError(runError.payload, runError.message || 'Stream request failed');
    }
    throw runError;
  }
}

export const fallbackState = createInitialDiagramState();
export const fallbackSessionState = createInitialSessionState();
