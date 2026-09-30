import { createInitialDiagramState, createInitialSessionState } from '@archislop/shared';
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
import {
  AGENT_REQUEST_TIMEOUT_MS,
  agentMutationTimeoutMs,
  createSessionHeaders,
  fetchWithTimeout,
  throwApiPayloadError
} from './diagramStoreHttp.js';

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
export { streamDiagramAgent } from './diagramStoreStreaming.js';

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

export const fallbackState = createInitialDiagramState();
export const fallbackSessionState = createInitialSessionState();
