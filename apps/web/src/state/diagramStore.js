import {
  buildAgentRunBudgetExceededMessage,
  createInitialDiagramState,
  createInitialSessionState,
  resolveAgentRunBudgetMs,
  sanitizeAgentStreamPayload
} from '@archislop/shared';
import { CopilotStreamHttpAgent } from './copilotStreamHttpAgent.js';
import { createAgUiTranslator } from './agUiTranslator.js';
import {
  API_BASE_URL,
  SESSION_HEADER,
  createSessionId,
  getOrCreateBrowserSessionId,
  normalizeSessionId
} from './diagramSession.js';
import { wipeClientCachesAfterLostServerSession } from './diagramCacheStorage.js';
import { isSlotCustomized, slotLastTopic } from './diagramModeSwitch.js';

export { createAgUiTranslator } from './agUiTranslator.js';
export {
  buildIntentPeerContext,
  CONTENT_MODES,
  createEmptyCrossModeSyncMarkers,
  defaultModeSwitchPrompt,
  isPeerSlotAhead,
  isSlotCustomized,
  isSlotInSyncForTopic,
  isValidModeSwitchSource,
  mergeLeavingSlotSnapshot,
  needsModeSwitchPeerSync,
  peerRequiresModeSwitchTranslation,
  pickPrimaryPeerMode,
  resolveModeSwitchCandidate,
  shouldAutoSubmitModeSwitchIntent,
  siblingContentModes,
  slotLastTopic
} from './diagramModeSwitch.js';
export {
  API_BASE_URL,
  SESSION_HEADER,
  createSessionId,
  normalizeSessionId,
  getOrCreateBrowserSessionId,
  clearBrowserBackupSessionId
} from './diagramSession.js';
export {
  clearAllArchislopAppStorage,
  clearAllDiagramCachesFromStorage,
  clearSessionScopedArchislopStorage,
  isDiagramCacheSubstantial,
  PERSISTENT_ARCHISLOP_STORAGE_KEYS,
  readDiagramCache,
  wipeClientCachesAfterLostServerSession,
  writeDiagramCache
} from './diagramCacheStorage.js';

const AGENT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Timeout for REST mutation requests (intent/transform) that run a full server-side agent
 * loop. Must exceed the server's run budget for the profile — a flat 60s would abort Fast
 * runs client-side at 60s while the server is allowed 75s, producing spurious
 * "request timed out" failures with no root cause.
 */
function agentMutationTimeoutMs(modelProfile, mode = null) {
  return resolveAgentRunBudgetMs(modelProfile, {}, mode) + AGENT_STREAM_MAX_DURATION_GRACE_MS;
}
/** Max gap between SSE events before we treat the stream as hung and abort. Resets on every event. */
const AGENT_STREAM_IDLE_TIMEOUT_MS = 60_000;
/**
 * Extra headroom past the server's run budget before the client force-aborts the stream.
 * The server now enforces its own deadline (aborting in-flight model turns) and emits a
 * `run_budget_exceeded` error that carries the last validator diagnostic — give it time
 * to do that instead of racing it with a client-side abort that loses the root cause.
 */
const AGENT_STREAM_MAX_DURATION_GRACE_MS = 15_000;

function throwApiPayloadError(payload, fallback) {
  const text = [payload?.error, payload?.message, payload?.details]
    .filter(Boolean)
    .join('\n')
    .trim();
  throw new Error(text || fallback);
}

/** True when every slot is still the default empty seed (server restart / new room). */
export function isServerSessionPristine(session) {
  if (!session || typeof session !== 'object') return true;
  return (
    isSlotPristine(session.mermaid) &&
    isSlotPristine(session.infographic) &&
    isSlotPristine(session.metaphor3d) &&
    isSlotPristine(session.chart) &&
    isSlotPristine(session.anything) &&
    isSlotPristine(session.forms)
  );
}

function isSlotPristine(slot) {
  if (!slot || typeof slot !== 'object') return true;
  if ((slot.revisionId ?? 0) > 0) return false;
  if (slotLastTopic(slot)) return false;
  return !isSlotCustomized(slot);
}

/**
 * After a server restart, mint a new session id and prime empty dual-slot state on the server.
 */
export async function mintFreshServerSession() {
  wipeClientCachesAfterLostServerSession();
  const targetId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
  await Promise.all([
    syncClientDiagramState({ contentType: 'mermaid', diagramSource: '', sessionId: targetId }),
    syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: targetId }),
    syncClientDiagramState({ contentType: 'metaphor3d', diagramSource: '', sessionId: targetId }),
    syncClientDiagramState({ contentType: 'chart', diagramSource: '', sessionId: targetId }),
    syncClientDiagramState({ contentType: 'anything', diagramSource: '', sessionId: targetId }),
    syncClientDiagramState({ contentType: 'forms', diagramSource: '', sessionId: targetId })
  ]);
  return targetId;
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
 * Coerce GET /session-state JSON into a full multi-slot shape (stale proxies, redeploys, or
 * partial payloads should not brick the client).
 */
export function normalizeFetchedSessionDiagram(payload) {
  const base = createInitialSessionState();
  if (!payload || typeof payload !== 'object') return base;
  const m = payload.mermaid;
  const i = payload.infographic;
  const p = payload.metaphor3d;
  const c = payload.chart;
  const a = payload.anything;
  const f = payload.forms;
  const activeFromPayload =
    payload.activeContentType === 'infographic' ||
    payload.activeContentType === 'metaphor3d' ||
    payload.activeContentType === 'chart' ||
    payload.activeContentType === 'anything' ||
    payload.activeContentType === 'forms'
      ? payload.activeContentType
      : base.activeContentType;
  return {
    activeContentType: activeFromPayload,
    mermaid: m && typeof m === 'object' && typeof m.diagramSource === 'string' ? m : base.mermaid,
    infographic:
      i && typeof i === 'object' && typeof i.diagramSource === 'string' ? i : base.infographic,
    metaphor3d:
      p && typeof p === 'object' && typeof p.diagramSource === 'string' ? p : base.metaphor3d,
    chart: c && typeof c === 'object' && typeof c.diagramSource === 'string' ? c : base.chart,
    anything: a && typeof a === 'object' && typeof a.diagramSource === 'string' ? a : base.anything,
    forms: f && typeof f === 'object' && typeof f.diagramSource === 'string' ? f : base.forms
  };
}

export async function fetchSessionDiagramState({ sessionId } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/session-state`, {
    headers: createSessionHeaders(sessionId)
  });
  let payload;
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
    if (
      response.status === 401 &&
      typeof payload?.error === 'string' &&
      payload.error.includes('Visitor Badge')
    ) {
      throw new Error(
        'Visitor Badge required — comment out VISITOR_BADGE_SECRETS in .env for local dev, or unlock with POST /api/visitor-badge'
      );
    }
    throw new Error(`Failed to fetch session state: ${response.status}`);
  }
  return normalizeFetchedSessionDiagram(payload);
}

export async function syncClientDiagramState({
  contentType = 'mermaid',
  diagramSource,
  styleConfig,
  sessionId
}) {
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

/**
 * Discrete canvas graph edit. Unlike `syncClientDiagramState`, this records an
 * `origin: user` history patch and refuses stale revisions (409).
 */
export async function applyUserDiagramEdit({
  contentType = 'mermaid',
  diagramSource,
  previousRevisionId,
  reason,
  sessionId
}) {
  const response = await fetch(`${API_BASE_URL}/api/copilotkit/user-edit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
    body: JSON.stringify({
      contentType,
      diagramSource,
      previousRevisionId,
      reason
    })
  });

  const payload = await response.json();
  if (response.status === 409) {
    const err = new Error(payload?.error ?? 'Diagram changed');
    err.code = 'stale_revision';
    throw err;
  }
  if (!response.ok) {
    throwApiPayloadError(payload, 'Failed to apply diagram edit');
  }
  return payload;
}

/**
 * Cheap render-error repair: posts the current source plus the browser's Mermaid render error
 * to the dedicated render-error endpoint. The server runs only the single-shot syntax-fixer
 * model (no full agent loop), so this returns in roughly one LLM call instead of an entire
 * agent turn.
 *
 * Returns `{repaired: true, state}` when the server applied a fix, `{repaired: false, ...}` when
 * the fixer rejected, the revision was stale, or the server isn't configured. Callers should
 * fall back to the heavyweight agent-based fix on `repaired: false`.
 */
export async function submitDiagramRenderRepair({
  revisionId,
  source,
  renderError,
  contentType = 'mermaid',
  sessionId
}) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/diagram/render-error`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({ revisionId, source, renderError, contentType })
    },
    AGENT_REQUEST_TIMEOUT_MS,
    'Render-error repair timed out.'
  );

  const payload = await response.json();
  if (!response.ok) {
    // Don't throw — let the caller decide whether to fall back to the heavyweight path.
    return { repaired: false, error: payload?.error ?? `HTTP ${response.status}` };
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
  sessionId,
  uiLocale
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
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile),
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
  russDepth,
  sessionId,
  uiLocale
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
        ...(typeof russDepth === 'number' && Number.isFinite(russDepth) ? { russDepth } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile, mode),
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
  sessionId,
  uiLocale
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
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
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

export async function submitDiagramStyle({
  prompt,
  stylePrompt,
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  settings,
  modelProfile,
  sessionId,
  uiLocale
}) {
  const resolvedPrompt = (stylePrompt ?? prompt ?? '').trim();
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/api/copilotkit/style`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...createSessionHeaders(sessionId) },
      body: JSON.stringify({
        prompt: resolvedPrompt,
        stylePrompt: resolvedPrompt,
        revisionId,
        diagramSource,
        contentType,
        settings,
        ...(modelProfile != null ? { modelProfile } : {}),
        ...(uiLocale != null ? { uiLocale } : {})
      })
    },
    agentMutationTimeoutMs(modelProfile),
    'Style agent request timed out. Please try again.'
  );

  const payload = await response.json();
  if (!response.ok) {
    throwApiPayloadError(payload, 'Style request failed');
  }

  return payload;
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
  const wirePayload = sanitizeAgentStreamPayload(payload);
  const { signal: callerSignal, sessionId } = options;
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const abortController = new AbortController();
  let idleTimedOut = false;
  let maxDurationTimedOut = false;
  let idleTimer = null;
  let maxDurationTimer = null;
  // Mirror the server's budget, including per-mode headroom (Russ runs get a longer
  // server budget; without the mode here the client would abort those runs early).
  const runBudgetMs = resolveAgentRunBudgetMs(
    wirePayload.modelProfile,
    {},
    typeof wirePayload.mode === 'string' ? wirePayload.mode : null
  );
  const maxDurationMs = runBudgetMs + AGENT_STREAM_MAX_DURATION_GRACE_MS;
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
  const armMaxDurationTimer = () => {
    maxDurationTimer = setTimeout(() => {
      maxDurationTimedOut = true;
      abortController.abort();
    }, maxDurationMs);
  };
  const clearMaxDurationTimer = () => {
    if (maxDurationTimer != null) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  let onCallerAbort = null;
  if (callerSignal) {
    onCallerAbort = () => abortController.abort();
    callerSignal.addEventListener('abort', onCallerAbort);
  }
  armIdleTimer();
  armMaxDurationTimer();

  const isAbortError = (err) =>
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError');

  const translate = createAgUiTranslator();

  const agent = new CopilotStreamHttpAgent(
    {
      url: `${API_BASE_URL}/api/copilotkit/agent-stream?protocol=agui`,
      headers: createSessionHeaders(sessionId)
    },
    wirePayload
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
    clearMaxDurationTimer();
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }

  if (idleTimedOut) {
    throw new Error('Agent stream stalled (no events received). Please try again.');
  }
  if (maxDurationTimedOut) {
    throw new Error(buildAgentRunBudgetExceededMessage(wirePayload.modelProfile, runBudgetMs));
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
