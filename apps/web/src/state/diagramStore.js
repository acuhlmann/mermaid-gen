import { createInitialDiagramState, createInitialSessionState } from '@archislop/shared';
import { API_BASE_URL, createSessionId, normalizeSessionId } from './diagramSession.js';
import { wipeClientCachesAfterLostServerSession } from './diagramCacheStorage.js';
import { isSlotCustomized, slotLastTopic } from './diagramModeSwitch.js';
import { createSessionHeaders } from './diagramStoreHttp.js';
import { syncClientDiagramState } from './diagramStoreMutations.js';

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
export {
  applyUserDiagramEdit,
  submitDiagramAnalyze,
  submitDiagramIntent,
  submitDiagramRenderRepair,
  submitDiagramStyle,
  submitDiagramTransform,
  syncClientDiagramState
} from './diagramStoreMutations.js';

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

export const fallbackState = createInitialDiagramState();
export const fallbackSessionState = createInitialSessionState();
