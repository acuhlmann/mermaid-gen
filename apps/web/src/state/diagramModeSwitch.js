import { createInitialDiagramState } from '@archislop/shared';

export const CONTENT_MODES = ['mermaid', 'infographic', 'metaphor3d', 'chart', 'forms', 'anything'];

export function slotLastTopic(slot) {
  const p = slot?.lastUserPrompt;
  return typeof p === 'string' && p.trim() ? p.trim() : null;
}

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

/** `slot.revisionId`, defaulted — the `?? 0` read this module makes a dozen times. */
function revisionOf(slot) {
  return slot?.revisionId ?? 0;
}

/** `slot.updatedAt`, defaulted to '' so a missing stamp sorts before every real one. */
function updatedAtOf(slot) {
  return slot?.updatedAt ?? '';
}

/** The carried topic as a comparable string; '' means "no topic carried". */
function normalizeCandidate(candidate) {
  return candidate != null ? String(candidate).trim() : '';
}

/**
 * True unless the slot records a topic that contradicts the carried one. A slot that never
 * recorded a topic never conflicts — only a different topic does. `cand` must already be
 * normalized.
 */
function topicAgrees(slot, cand) {
  const slotTopic = slotLastTopic(slot);
  return !(cand && slotTopic && slotTopic !== cand);
}

/** Spread-safe view of a slot: `{}` for anything that is not an object. */
function asPlainObject(value) {
  return value && typeof value === 'object' ? value : {};
}

/**
 * The (target, peer) pair a mode switch would translate between, or null when there is
 * nothing to translate — unknown mode, no session, no peer carrying compatible content, or a
 * peer still holding the default seed.
 *
 * Four exported predicates below opened with this exact preamble, which is why each of them
 * carried five branches before reaching its own question.
 */
function resolvePeerPair({ contentMode, session, candidate, sourceMode }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return null;
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode });
  if (!peerMode) return null;
  const peer = session[peerMode];
  if (!isSlotCustomized(peer)) return null;
  return { target: session[contentMode], peerMode, peer };
}

/** True when a sync marker records this exact peer/target revision pair in this direction. */
function syncMarkerMatches(marker, peerMode, peerRevisionId, targetRevisionId) {
  return (
    marker?.peerMode === peerMode &&
    marker.peerRevisionId === peerRevisionId &&
    marker.targetRevisionId === targetRevisionId
  );
}

/**
 * Overlay the slot snapshot captured when the user left `sourceMode` onto fetched session
 * state when the client is ahead of GET /session-state (debounced editor sync, hydrate
 * racing a just-finished stream write). Without this, mode-switch peer detection sees an
 * empty/default peer and skips auto-translation into the new mode.
 */
export function mergeLeavingSlotSnapshot(session, sourceMode, snapshot) {
  if (!session || !sourceMode || !snapshot || !CONTENT_MODES.includes(sourceMode)) {
    return session;
  }
  if (!isSlotCustomized(snapshot)) return session;
  const serverSlot = session[sourceMode];
  // The server copy wins only when it is real content and at least as new as ours.
  if (isSlotCustomized(serverSlot) && revisionOf(snapshot) <= revisionOf(serverSlot)) {
    return session;
  }
  return {
    ...session,
    [sourceMode]: { ...asPlainObject(serverSlot), ...snapshot }
  };
}

/**
 * True when `sourceMode` is a customized sibling whose topic matches the carried candidate.
 */
export function isValidModeSwitchSource({ contentMode, session, candidate, sourceMode }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;
  if (!sourceMode || sourceMode === contentMode || !CONTENT_MODES.includes(sourceMode)) {
    return false;
  }
  const slot = session[sourceMode];
  if (!isSlotCustomized(slot)) return false;
  return topicAgrees(slot, normalizeCandidate(candidate));
}

/**
 * Among sibling slots, pick the peer whose content should drive a mode-switch conversion.
 * Prefers the mode the user switched from when it has compatible content; otherwise the most
 * recently updated customized slot that matches the carried topic.
 */
export function pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode = null }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return null;
  if (isValidModeSwitchSource({ contentMode, session, candidate, sourceMode })) {
    return sourceMode;
  }
  const cand = normalizeCandidate(candidate);
  let bestMode = null;
  let bestUpdatedAt = '';
  for (const mode of siblingContentModes(contentMode)) {
    const slot = session[mode];
    if (!isSlotCustomized(slot) || !topicAgrees(slot, cand)) continue;
    const updatedAt = updatedAtOf(slot);
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
 * Gilfoyle/Erlich in the other mode). Drives auto-intent on mode switch so the user need not
 * press Go to translate peer edits.
 */
export function isPeerSlotAhead({ contentMode, session, candidate, sourceMode = null }) {
  const pair = resolvePeerPair({ contentMode, session, candidate, sourceMode });
  if (!pair) return false;
  const { target, peer } = pair;
  const cand = normalizeCandidate(candidate);
  if (!topicAgrees(peer, cand)) return false;
  // With no topic carried, any peer content is ahead of an untouched target slot.
  if (!cand && !isSlotCustomized(target)) return true;
  return updatedAtOf(peer) > updatedAtOf(target);
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
  syncMarkers,
  sourceMode = null,
  sourceRevisionAtLastView = null
}) {
  const pair = resolvePeerPair({ contentMode, session, candidate, sourceMode });
  if (!pair) return false;
  const { target, peerMode, peer } = pair;
  if (!isSlotCustomized(target)) return true;

  const peerRevision = revisionOf(peer);
  const targetRevision = revisionOf(target);

  // Target already has content at least as new as the source and the mode we switched
  // from has not changed since we last viewed it — keep the cached slot.
  if (
    sourceMode &&
    sourceRevisionAtLastView != null &&
    peerRevision === sourceRevisionAtLastView &&
    targetRevision >= peerRevision
  ) {
    return false;
  }

  // A marker in either direction recording this exact revision pair means the translation
  // already ran; running it again is the return-trip ping-pong.
  const markers = syncMarkers ?? {};
  if (syncMarkerMatches(markers[contentMode], peerMode, peerRevision, targetRevision)) {
    return false;
  }
  if (syncMarkerMatches(markers[peerMode], contentMode, targetRevision, peerRevision)) {
    return false;
  }

  return isPeerSlotAhead({ contentMode, session, candidate, sourceMode });
}

/**
 * Optional sibling-slot payload for diagram↔infographic intent alignment (mode switch).
 * Omits peer when the other slot is still the default seed with no revisions, or when the
 * peer's recorded `lastUserPrompt` does not match the carried topic (do not translate stale
 * content from another topic).
 *
 * @param {string | null | undefined} candidate - topic string from mode-switch carry-over
 */
export function buildIntentPeerContext(contentMode, session, candidate = null, sourceMode = null) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return undefined;
  const targetCustomized = isSlotCustomized(session[contentMode]);
  const pair = resolvePeerPair({
    contentMode,
    session,
    candidate: targetCustomized ? candidate : null,
    sourceMode
  });
  if (!pair) return undefined;
  const { peerMode, peer } = pair;
  // `isSlotCustomized` accepts a revised slot whose source is empty; an empty source is
  // nothing to translate from, so it is rejected separately rather than folded into that.
  if (typeof peer.diagramSource !== 'string' || !peer.diagramSource.trim()) return undefined;
  // A topic conflict only disqualifies the peer once the target has content of its own —
  // an untouched target takes the peer whatever it was last prompted with.
  if (targetCustomized && !topicAgrees(peer, normalizeCandidate(candidate))) return undefined;
  return { contentType: peerMode, diagramSource: peer.diagramSource };
}

/**
 * Topic string for mode-switch auto-intent: slot prompts, session carry-over, textarea, or
 * a conversion fallback when the peer slot has diagram work but no recorded topic.
 */
/**
 * The most recently updated topic recorded by the target slot or any sibling, or null.
 *
 * Ties go to the LAST slot in [target, ...siblings] order, matching the `(a, b) =>
 * a.updatedAt > b.updatedAt ? a : b` reduce this replaced — the strict `>` there hands a tie
 * to `b`. Ties are not exotic: two slots written in the same second, or two that carry no
 * `updatedAt` at all, both compare equal.
 */
function latestRecordedTopic(contentMode, session) {
  let best = null;
  for (const mode of [contentMode, ...siblingContentModes(contentMode)]) {
    const slot = session[mode];
    const topic = slotLastTopic(slot);
    if (!topic) continue;
    const updatedAt = updatedAtOf(slot);
    if (!best || updatedAt >= best.updatedAt) best = { topic, updatedAt };
  }
  return best ? best.topic : null;
}

/**
 * Last resort when nothing recorded a topic: if the target slot is still the default seed and
 * a peer carries real content, adopt the peer's topic — or a canned conversion prompt when
 * the peer has content but never recorded one.
 */
function peerFallbackTopic({ contentMode, session, candidate, sourceMode }) {
  if (isSlotCustomized(session[contentMode])) return null;
  const pair = resolvePeerPair({ contentMode, session, candidate, sourceMode });
  if (!pair) return null;
  return slotLastTopic(pair.peer) ?? defaultModeSwitchPrompt(contentMode, pair.peerMode);
}

export function resolveModeSwitchCandidate({
  contentMode,
  session,
  sessionTopic = null,
  promptAtSwitch = '',
  sourceMode = null
}) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return null;
  const candidate = latestRecordedTopic(contentMode, session) ?? sessionTopic ?? null;
  if (candidate) return candidate;
  const trimmedAtSwitch = (promptAtSwitch ?? '').trim();
  if (trimmedAtSwitch) return trimmedAtSwitch;
  // `candidate` is falsy here but not always null (an empty `sessionTopic` reaches this
  // point), and the original returned that value unchanged when no peer applied.
  return peerFallbackTopic({ contentMode, session, candidate, sourceMode }) ?? candidate;
}

/** True when switching into this mode should translate content from the sibling slot. */
export function needsModeSwitchPeerSync({
  contentMode,
  session,
  candidate,
  syncMarkers,
  sourceMode = null,
  sourceRevisionAtLastView = null
}) {
  const pair = resolvePeerPair({ contentMode, session, candidate, sourceMode });
  if (!pair) return false;
  const { target } = pair;
  if (!isSlotCustomized(target)) return true;
  if (
    peerRequiresModeSwitchTranslation({
      contentMode,
      session,
      candidate,
      syncMarkers,
      sourceMode,
      sourceRevisionAtLastView
    })
  ) {
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
  // Empty-slot takeover should run even when the prompt bar still holds a stale topic —
  // peer conversion is driven by sibling slot content, not the visible textarea draft.
  if (textareaDirty && !needsPeerSync && !peerRequiresTranslation) return false;
  if (needsPeerSync && candidate) return true;
  if (!candidate) return false;
  if (peerRequiresTranslation) return true;
  return !newSlotInSync;
}
