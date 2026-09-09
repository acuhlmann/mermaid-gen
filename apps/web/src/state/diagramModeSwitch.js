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
  const serverRev = serverSlot?.revisionId ?? 0;
  const localRev = snapshot.revisionId ?? 0;
  if (!isSlotCustomized(serverSlot) || localRev > serverRev) {
    return {
      ...session,
      [sourceMode]: {
        ...(serverSlot && typeof serverSlot === 'object' ? serverSlot : {}),
        ...snapshot
      }
    };
  }
  return session;
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
  const cand = candidate != null ? String(candidate).trim() : '';
  const peerTopic = slotLastTopic(slot);
  return !(cand && peerTopic && peerTopic !== cand);
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
 * Gilfoyle/Erlich in the other mode). Drives auto-intent on mode switch so the user need not
 * press Go to translate peer edits.
 */
export function isPeerSlotAhead({ contentMode, session, candidate, sourceMode = null }) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode });
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
  syncMarkers,
  sourceMode = null,
  sourceRevisionAtLastView = null
}) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;

  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode });
  if (!peerMode) return false;
  const peer = session[peerMode];
  if (!isSlotCustomized(peer)) return false;
  if (!isSlotCustomized(target)) return true;

  // Target already has content at least as new as the source and the mode we switched
  // from has not changed since we last viewed it — keep the cached slot.
  if (
    sourceMode &&
    sourceRevisionAtLastView != null &&
    (peer.revisionId ?? 0) === sourceRevisionAtLastView &&
    (target.revisionId ?? 0) >= (peer.revisionId ?? 0)
  ) {
    return false;
  }

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

  if (!isPeerSlotAhead({ contentMode, session, candidate, sourceMode })) return false;

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
export function buildIntentPeerContext(contentMode, session, candidate = null, sourceMode = null) {
  if (!session || !CONTENT_MODES.includes(contentMode)) return undefined;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({
    contentMode,
    session,
    candidate: isSlotCustomized(target) ? candidate : null,
    sourceMode
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
  promptAtSwitch = '',
  sourceMode = null
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
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode });
  const peerSlot = peerMode ? session[peerMode] : null;
  if (!candidate && peerSlot && isSlotCustomized(peerSlot) && !isSlotCustomized(data)) {
    candidate = slotLastTopic(peerSlot) ?? defaultModeSwitchPrompt(contentMode, peerMode);
  }
  return candidate;
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
  if (!session || !CONTENT_MODES.includes(contentMode)) return false;
  const target = session[contentMode];
  const peerMode = pickPrimaryPeerMode({ contentMode, session, candidate, sourceMode });
  if (!peerMode) return false;
  const peer = session[peerMode];
  if (!isSlotCustomized(peer)) return false;
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
