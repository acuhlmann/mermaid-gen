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
  BROWSER_SESSION_STORAGE_KEY,
  SESSION_HEADER,
  clearBrowserBackupSessionId,
  clearInMemoryBrowserSessionId,
  createSessionId,
  getOrCreateBrowserSessionId,
  normalizeSessionId
} from './diagramSession.js';
import {
  CONTENT_MODE_STORAGE_KEY,
  MODEL_PROFILE_STORAGE_KEY
} from '../utils/appSessionLocation.js';
import { STORAGE_KEY as SLOPITECT_PROGRESS_STORAGE_KEY } from './runGamificationStore.js';

export { createAgUiTranslator } from './agUiTranslator.js';
export {
  API_BASE_URL,
  SESSION_HEADER,
  createSessionId,
  normalizeSessionId,
  getOrCreateBrowserSessionId,
  clearBrowserBackupSessionId
} from './diagramSession.js';

const DIAGRAM_CACHE_STORAGE_KEY = 'archislop:diagram-cache-v2';
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

function getDiagramCacheKey(sessionId) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  return normalizedSessionId
    ? `${DIAGRAM_CACHE_STORAGE_KEY}:${normalizedSessionId}`
    : DIAGRAM_CACHE_STORAGE_KEY;
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

/** User-global keys that survive room rotation / server restarts. */
export const PERSISTENT_ARCHISLOP_STORAGE_KEYS = new Set([
  SLOPITECT_PROGRESS_STORAGE_KEY,
  'archislop:stakeholder-intro-seen',
  'archislop:mode-reveal-seen',
  'archislop:advisor-muted',
  'archislop.uiLocale',
  'archislop:mermaid-vite-reload'
]);

function isSessionScopedArchislopStorageKey(key) {
  if (!key) return false;
  if (key === 'archislop' || key.startsWith('archislop-')) return true;
  if (!key.startsWith('archislop:')) return false;
  return !PERSISTENT_ARCHISLOP_STORAGE_KEYS.has(key);
}

/** Drops every `archislop` / `archislop:*` key (diagram caches, gamification, prefs, etc.). */
export function clearAllArchislopAppStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === 'archislop' || k.startsWith('archislop:') || k.startsWith('archislop-')) {
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

/**
 * Drop session-scoped client payloads after the server reports a room is gone (404/410).
 * Preserves user-global progress (Slopitect level/XP, lifetime cost, achievements, etc.).
 */
export function clearSessionScopedArchislopStorage() {
  if (typeof window === 'undefined') return;
  try {
    clearAllDiagramCachesFromStorage();
    const keys = [
      BROWSER_SESSION_STORAGE_KEY,
      MODEL_PROFILE_STORAGE_KEY,
      CONTENT_MODE_STORAGE_KEY,
      'archislop-stream-debug'
    ];
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (isSessionScopedArchislopStorageKey(k)) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore privacy / access errors.
  }
}

/**
 * After the server reports the session is gone (404/410), drop all client-side session payloads
 * so a new room id does not resurrect stale diagrams, insights, or backup session headers.
 */
export function wipeClientCachesAfterLostServerSession() {
  clearInMemoryBrowserSessionId();
  clearSessionScopedArchislopStorage();
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

/** True when a persisted per-session cache still has user-visible work to restore. */
export function isDiagramCacheSubstantial(cache) {
  if (!cache || typeof cache !== 'object') return false;
  if (Array.isArray(cache.insightsEntries) && cache.insightsEntries.length > 0) return true;
  if (typeof cache.latestCritique?.text === 'string' && cache.latestCritique.text.trim())
    return true;
  const src = typeof cache.diagramSource === 'string' ? cache.diagramSource.trim() : '';
  if (!src) return false;
  const initial = createInitialDiagramState('mermaid');
  return src !== initial.diagramSource.trim();
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
    throw new Error(`Failed to fetch session state: ${response.status}`);
  }
  return normalizeFetchedSessionDiagram(payload);
}

export function slotLastTopic(slot) {
  const p = slot?.lastUserPrompt;
  return typeof p === 'string' && p.trim() ? p.trim() : null;
}

export const CONTENT_MODES = ['mermaid', 'infographic', 'metaphor3d', 'chart', 'forms', 'anything'];

export function createEmptyCrossModeSyncMarkers() {
  return {
    mermaid: null,
    infographic: null,
    metaphor3d: null,
    chart: null,
    forms: null,
    anything: null
  };
}

export function siblingContentModes(contentMode) {
  if (!CONTENT_MODES.includes(contentMode)) return [];
  return CONTENT_MODES.filter((mode) => mode !== contentMode);
}

/**
 * Among sibling slots, pick the peer whose content should drive a mode-switch conversion.
 * Prefers the most recently updated customized slot that matches the carried topic.
 */
export function pickPrimaryPeerMode({ contentMode, session, candidate }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return null;
  const cand = candidate != null ? String(candidate).trim() : '';
  let bestMode = null;
  let bestUpdatedAt = '';
  for (const mode of siblingContentModes(contentMode)) {
    const slot = session[mode];
    if (!isSlotCustomized(slot)) continue;
    const peerTopic = slotLastTopic(slot);
    if (cand && peerTopic && peerTopic !== cand) continue;
    const updatedAt = slot?.updatedAt ?? '';
    if (!bestMode || updatedAt > bestUpdatedAt) {
      bestMode = mode;
      bestUpdatedAt = updatedAt;
    }
  }
  return bestMode;
}

/** Fallback intent prompt when switching modes with peer content but no stored topic. */
export function defaultModeSwitchPrompt(contentMode, peerMode = null) {
  if (contentMode === 'infographic') {
    if (peerMode === 'metaphor3d') {
      return 'Convert the current 3D metaphor into an equivalent infographic.';
    }
    return 'Convert the current Mermaid architecture diagram into an equivalent infographic.';
  }
  if (contentMode === 'metaphor3d') {
    return 'Re-imagine the current diagram as a 3D spatial metaphor that surfaces new insights.';
  }
  if (contentMode === 'chart') {
    return 'Turn the current diagram into a Vega-Lite chart that surfaces the underlying data story.';
  }
  if (contentMode === 'anything') {
    return 'Re-create the current diagram as an interactive freeform HTML page that brings the subject to life.';
  }
  if (contentMode === 'forms') {
    return 'Turn the current subject into the tediously bureaucratic intake form the corporate-IT process would spawn for it.';
  }
  if (peerMode === 'metaphor3d') {
    return 'Convert the current 3D metaphor into an equivalent Mermaid architecture diagram.';
  }
  if (peerMode === 'chart') {
    return 'Convert the current chart into an equivalent Mermaid architecture diagram.';
  }
  if (peerMode === 'anything') {
    return 'Convert the current freeform page into an equivalent Mermaid architecture diagram.';
  }
  if (peerMode === 'forms') {
    return 'Convert the current intake form into an equivalent Mermaid architecture diagram of the process it describes.';
  }
  return 'Convert the current infographic into an equivalent Mermaid architecture diagram.';
}

/** True when the slot has agent or user edits beyond the default seed canvas. */
export function isSlotCustomized(slot) {
  if (!slot || typeof slot.diagramSource !== 'string') return false;
  if ((slot.revisionId ?? 0) > 0) return true;
  const contentType =
    slot.contentType === 'infographic' ||
    slot.contentType === 'metaphor3d' ||
    slot.contentType === 'chart' ||
    slot.contentType === 'anything' ||
    slot.contentType === 'forms'
      ? slot.contentType
      : 'mermaid';
  const trimmed = slot.diagramSource.trim();
  if (!trimmed) return false;
  const initial = createInitialDiagramState(contentType);
  return trimmed !== initial.diagramSource.trim();
}

/**
 * True when the sibling slot has newer diagram work for the same carried topic (e.g. after
 * Refine/Innovate in the other mode). Drives auto-intent on mode switch so the user need not
 * press Go to translate peer edits.
 */
export function isPeerSlotAhead({ contentMode, session, candidate }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate });
  if (!peerMode) return false;
  const peer = session[peerMode];
  if (!isSlotCustomized(peer)) return false;
  const cand = candidate != null ? String(candidate).trim() : '';
  const peerTopic = slotLastTopic(peer);
  if (peerTopic && cand && peerTopic !== cand) return false;
  const targetUpdated = target?.updatedAt ?? '';
  const peerUpdated = peer?.updatedAt ?? '';
  if (!cand) {
    return isSlotCustomized(target) ? peerUpdated > targetUpdated : true;
  }
  return peerUpdated > targetUpdated;
}

/** True when the slot already has customized content for the session topic. */
export function isSlotInSyncForTopic(slot, candidate) {
  return candidate != null && slotLastTopic(slot) === candidate && isSlotCustomized(slot);
}

/**
 * True when the sibling slot has newer work for the same topic and the target mode still
 * needs translation. Skips return-trip ping-pong when sync markers match current revisions.
 *
 * @param {Record<string, { peerMode: string, peerRevisionId: number, targetRevisionId: number } | null> | null | undefined} syncMarkers
 */
export function peerRequiresModeSwitchTranslation({
  contentMode,
  session,
  candidate,
  syncMarkers
}) {
  if (!isPeerSlotAhead({ contentMode, session, candidate })) return false;

  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate });
  if (!target || !peerMode) return false;
  const peer = session[peerMode];
  if (!peer) return false;

  const markerOnTarget = syncMarkers?.[contentMode];
  if (
    markerOnTarget?.peerMode === peerMode &&
    markerOnTarget.peerRevisionId === (peer.revisionId ?? 0) &&
    markerOnTarget.targetRevisionId === (target.revisionId ?? 0)
  ) {
    return false;
  }

  const markerOnPeer = syncMarkers?.[peerMode];
  if (
    markerOnPeer?.peerMode === contentMode &&
    markerOnPeer.peerRevisionId === (target.revisionId ?? 0) &&
    markerOnPeer.targetRevisionId === (peer.revisionId ?? 0)
  ) {
    return false;
  }

  return true;
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
  if (!session || !CONTENT_MODES.includes(contentMode)) return undefined;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({
    contentMode,
    session,
    candidate: isSlotCustomized(target) ? candidate : null
  });
  if (!peerMode) return undefined;
  const peer = session[peerMode];
  if (!peer || typeof peer.diagramSource !== 'string') return undefined;
  const trimmed = peer.diagramSource.trim();
  if (!trimmed) return undefined;
  if (!isSlotCustomized(peer)) return undefined;
  if (!isSlotCustomized(target)) {
    return { contentType: peerMode, diagramSource: peer.diagramSource };
  }
  const cand = candidate != null ? String(candidate).trim() : '';
  if (cand) {
    const peerPrompt = typeof peer.lastUserPrompt === 'string' ? peer.lastUserPrompt.trim() : '';
    if (peerPrompt && peerPrompt !== cand) return undefined;
  }
  return { contentType: peerMode, diagramSource: peer.diagramSource };
}

/**
 * Topic string for mode-switch auto-intent: slot prompts, session carry-over, textarea, or
 * a conversion fallback when the peer slot has diagram work but no recorded topic.
 */
export function resolveModeSwitchCandidate({
  contentMode,
  session,
  sessionTopic = null,
  promptAtSwitch = ''
}) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return null;
  const data = session[contentMode];
  const slots = [
    { mode: contentMode, slot: data },
    ...siblingContentModes(contentMode).map((mode) => ({ mode, slot: session[mode] }))
  ];
  const withTopics = slots
    .map(({ mode, slot }) => ({
      mode,
      topic: slotLastTopic(slot),
      updatedAt: slot?.updatedAt ?? ''
    }))
    .filter((entry) => entry.topic);
  let candidate;
  if (withTopics.length >= 2) {
    candidate = withTopics.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).topic;
  } else if (withTopics.length === 1) {
    candidate = withTopics[0].topic;
  } else {
    candidate = sessionTopic ?? null;
  }
  const trimmedAtSwitch = (promptAtSwitch ?? '').trim();
  if (!candidate && trimmedAtSwitch) {
    candidate = trimmedAtSwitch;
  }
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate });
  const peerSlot = peerMode ? session[peerMode] : null;
  if (!candidate && peerSlot && isSlotCustomized(peerSlot) && !isSlotCustomized(data)) {
    candidate = slotLastTopic(peerSlot) ?? defaultModeSwitchPrompt(contentMode, peerMode);
  }
  return candidate;
}

/** True when switching into this mode should translate content from the sibling slot. */
export function needsModeSwitchPeerSync({ contentMode, session, candidate, syncMarkers }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate });
  if (!peerMode) return false;
  const peer = session[peerMode];
  if (!isSlotCustomized(peer)) return false;
  if (!isSlotCustomized(target)) return true;
  if (peerRequiresModeSwitchTranslation({ contentMode, session, candidate, syncMarkers })) {
    return true;
  }
  return Boolean(candidate) && !isSlotInSyncForTopic(target, candidate);
}

/**
 * Whether to auto-fire an intent after a mode switch.
 *
 * Fires when the target slot is NOT already in sync with the carried topic, or when the
 * sibling slot has newer diagram work for the same topic (translate without pressing Go).
 * Skips when the target is in sync and the peer is not ahead.
 */
export function shouldAutoSubmitModeSwitchIntent({
  candidate,
  textareaDirty,
  newSlotInSync,
  peerRequiresTranslation = false,
  needsPeerSync = false
}) {
  if (textareaDirty) return false;
  if (needsPeerSync && candidate) return true;
  if (!candidate) return false;
  if (peerRequiresTranslation) return true;
  return !newSlotInSync;
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

export async function submitDiagramStyle({
  prompt,
  stylePrompt,
  revisionId,
  diagramSource,
  contentType = 'mermaid',
  settings,
  modelProfile,
  sessionId
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
        ...(modelProfile != null ? { modelProfile } : {})
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
  // Mirror the server's budget, including per-mode headroom (Go Mad runs get a longer
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
