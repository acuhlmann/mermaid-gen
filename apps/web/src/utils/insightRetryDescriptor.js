const RETRYABLE_OPERATIONS = new Set(['intent', 'transform']);
const RETRYABLE_VARIANTS = new Set(['intent', 'refine', 'innovate', 'goMad', 'exec']);

/**
 * Snapshot of a stream run so a failed insight can be re-submitted after sync.
 * @param {object} args
 * @returns {object | null}
 */
export function buildInsightRetryDescriptor({
  operation,
  payload,
  variant,
  topic,
  modelProfile,
  modeSwitchSync,
  modeSwitchPeerRevisionId,
  modeSwitchPeerMode,
  focusNode
}) {
  if (!RETRYABLE_OPERATIONS.has(operation) || !RETRYABLE_VARIANTS.has(variant)) {
    return null;
  }
  const descriptor = {
    operation,
    variant,
    modelProfile: modelProfile === 'quality' ? 'quality' : 'fast',
    topic: topic ?? null,
    focusNode: focusNode ?? payload?.focusNode ?? null,
    modeSwitchSync: Boolean(modeSwitchSync),
    modeSwitchPeerRevisionId:
      modeSwitchPeerRevisionId != null ? modeSwitchPeerRevisionId : null,
    modeSwitchPeerMode: modeSwitchPeerMode ?? null
  };
  if (operation === 'intent') {
    if (typeof payload?.prompt !== 'string' || !payload.prompt.trim()) return null;
    descriptor.prompt = payload.prompt;
    descriptor.settings = payload.settings ?? {};
    if (payload.peerContext) descriptor.peerContext = payload.peerContext;
  } else {
    if (!payload?.mode) return null;
    descriptor.mode = payload.mode;
    if (payload.goMadDepth != null) descriptor.goMadDepth = payload.goMadDepth;
  }
  return descriptor;
}

/** @param {object | null | undefined} entry */
export function canRetryInsightEntry(entry) {
  return entry?.status === 'failed' && entry?.retryDescriptor != null;
}

/** @param {object | null | undefined} entry */
export function showRetryWithQualityForEntry(entry) {
  const profile = entry?.retryDescriptor?.modelProfile;
  return canRetryInsightEntry(entry) && profile === 'fast';
}
