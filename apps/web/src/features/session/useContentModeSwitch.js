import { useCallback, useEffect, useRef, useState } from 'react';
import { createEmptyCrossModeSyncMarkers } from '../../state/diagramStore.js';
import { CONTENT_MODE_STORAGE_KEY, readStoredContentMode } from '../../utils/appSessionLocation.js';
import {
  buildRenderSelectionPrompt,
  isConcreteContentMode,
  isContentMode
} from '../../utils/renderModeAction.js';
import { playModeSwoosh } from '../../utils/agentChimes.js';

/**
 * Refs shared with session hydrate for cross-slot mode-switch coordination.
 *
 * @typedef {object} ContentModeSwitchRefs
 * @property {import('react').MutableRefObject<string>} previousContentModeRef
 * @property {import('react').MutableRefObject<Record<string, number>>} sourceRevisionAtViewRef
 * @property {import('react').MutableRefObject<Record<string, object>>} leavingSlotSnapshotRef
 * @property {import('react').MutableRefObject<object>} crossModeSyncRef
 * @property {import('react').MutableRefObject<boolean>} suppressNextModeSwitchRerunRef
 * @property {import('react').MutableRefObject<boolean>} skipHydrateOnceRef
 * @property {import('react').MutableRefObject<object | null>} pendingRenderModeRequestRef
 */

/**
 * Content-mode picker state, cross-slot sync refs, and user-initiated mode switches.
 *
 * @param {{
 *   stateRef: import('react').MutableRefObject<object>;
 *   syncTimerRef: import('react').MutableRefObject<ReturnType<typeof setTimeout> | null>;
 *   streamTimerRef: import('react').MutableRefObject<number | null>;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   streamAgentAbortRef: import('react').MutableRefObject<AbortController | null>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   syncDiagramOrThrowRef: import('react').MutableRefObject<() => Promise<object>>;
 *   closeRadialMenuRef: import('react').MutableRefObject<(() => void) | null>;
 *   tryAgentSoundRef: import('react').MutableRefObject<((playFn: Function) => void) | null>;
 *   contentModeOptions: object[];
 *   setStreamingPreview: (value: boolean) => void;
 *   setLiveDraftSource: (value: string) => void;
 *   setLiveDraftContentType: (value: string | null) => void;
 *   setSelectedNode: (value: unknown) => void;
 *   setHoverDescriptor: (value: unknown) => void;
 *   setToolbarAnchor: (value: unknown) => void;
 *   setLatestCritique: (value: object | null) => void;
 *   setError: (value: string) => void;
 * }} deps
 */
export function useContentModeSwitch({
  stateRef,
  syncTimerRef,
  streamTimerRef,
  streamingPreviewRef,
  streamAgentAbortRef,
  loadingRef,
  hasInteractedRef,
  syncDiagramOrThrowRef,
  closeRadialMenuRef,
  tryAgentSoundRef,
  contentModeOptions,
  setStreamingPreview,
  setLiveDraftSource,
  setLiveDraftContentType,
  setSelectedNode,
  setHoverDescriptor,
  setToolbarAnchor,
  setLatestCritique,
  setError
}) {
  const [contentMode, setContentMode] = useState(() => readStoredContentMode());
  const previousContentModeRef = useRef(contentMode);
  const sourceRevisionAtViewRef = useRef({});
  const leavingSlotSnapshotRef = useRef({});
  const crossModeSyncRef = useRef(createEmptyCrossModeSyncMarkers());
  const suppressNextModeSwitchRerunRef = useRef(false);
  const skipHydrateOnceRef = useRef(false);
  const pendingRenderModeRequestRef = useRef(null);
  const [rendererRefreshKey, setRendererRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CONTENT_MODE_STORAGE_KEY, contentMode);
    } catch {
      // ignore quota / privacy mode
    }
  }, [contentMode]);

  const bumpRendererRefreshKey = useCallback(() => {
    setRendererRefreshKey((n) => n + 1);
  }, []);

  const resetModeSwitchTracking = useCallback(() => {
    crossModeSyncRef.current = createEmptyCrossModeSyncMarkers();
    sourceRevisionAtViewRef.current = {};
  }, []);

  const armSuppressHydrateRerun = useCallback(() => {
    suppressNextModeSwitchRerunRef.current = true;
  }, []);

  const disarmSuppressHydrateRerun = useCallback(() => {
    suppressNextModeSwitchRerunRef.current = false;
  }, []);

  /** Restore / highlight jumps: switch mode without capture side-effects or hydrate auto-rerun. */
  const switchContentModeForRestore = useCallback(
    (nextMode) => {
      if (!isConcreteContentMode(nextMode)) return;
      armSuppressHydrateRerun();
      setContentMode(nextMode);
      bumpRendererRefreshKey();
    },
    [armSuppressHydrateRerun, bumpRendererRefreshKey]
  );

  const handleSelectContentMode = useCallback(
    (nextMode) => {
      if (nextMode === contentMode) return;
      if (!isContentMode(nextMode)) return;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      const wasTypewriterPreview = streamingPreviewRef.current;
      setStreamingPreview(false);
      streamingPreviewRef.current = false;
      if (isConcreteContentMode(contentMode) && !wasTypewriterPreview) {
        leavingSlotSnapshotRef.current[contentMode] = { ...stateRef.current };
        sourceRevisionAtViewRef.current[contentMode] = stateRef.current.revisionId ?? 0;
      } else if (isConcreteContentMode(contentMode)) {
        sourceRevisionAtViewRef.current[contentMode] = stateRef.current.revisionId ?? 0;
      }
      streamAgentAbortRef.current?.abort();
      setLiveDraftSource('');
      setLiveDraftContentType(null);
      setSelectedNode(null);
      setHoverDescriptor(null);
      setToolbarAnchor(null);
      setLatestCritique(null);
      tryAgentSoundRef.current?.(playModeSwoosh);
      setContentMode(nextMode);
      bumpRendererRefreshKey();
    },
    [
      bumpRendererRefreshKey,
      contentMode,
      setHoverDescriptor,
      setLatestCritique,
      setLiveDraftContentType,
      setLiveDraftSource,
      setSelectedNode,
      setStreamingPreview,
      setToolbarAnchor,
      stateRef,
      streamAgentAbortRef,
      streamTimerRef,
      streamingPreviewRef,
      syncTimerRef,
      tryAgentSoundRef
    ]
  );

  /** Auto-mode mid-stream: switch the picker without aborting the agent run. */
  const applyResolvedContentMode = useCallback(
    (nextMode) => {
      if (!isConcreteContentMode(nextMode) || nextMode === contentMode) return;
      skipHydrateOnceRef.current = true;
      suppressNextModeSwitchRerunRef.current = true;
      setLiveDraftContentType(nextMode);
      setContentMode(nextMode);
      bumpRendererRefreshKey();
    },
    [bumpRendererRefreshKey, contentMode, setLiveDraftContentType]
  );

  const renderSelectionInMode = useCallback(
    async (targetMode, descriptor) => {
      if (!isConcreteContentMode(targetMode) || targetMode === contentMode) return;
      if (contentMode === 'auto') return;
      if (loadingRef.current || streamingPreviewRef.current) return;
      if (!stateRef.current.diagramSource.trim()) return;

      const sourceMode = contentMode;
      const promptText = buildRenderSelectionPrompt({
        descriptor,
        sourceMode,
        targetMode,
        options: contentModeOptions
      });
      hasInteractedRef.current = true;
      closeRadialMenuRef.current?.();

      try {
        const sourceState = await syncDiagramOrThrowRef.current();
        pendingRenderModeRequestRef.current = {
          targetMode,
          sourceMode,
          promptText,
          descriptor,
          peerContext: { contentType: sourceMode, diagramSource: sourceState.diagramSource }
        };
        handleSelectContentMode(targetMode);
      } catch (err) {
        pendingRenderModeRequestRef.current = null;
        setError(err.message);
      }
    },
    [
      closeRadialMenuRef,
      contentMode,
      contentModeOptions,
      handleSelectContentMode,
      hasInteractedRef,
      loadingRef,
      setError,
      stateRef,
      streamingPreviewRef,
      syncDiagramOrThrowRef
    ]
  );

  /** @type {ContentModeSwitchRefs} */
  const hydrateRefs = {
    previousContentModeRef,
    sourceRevisionAtViewRef,
    leavingSlotSnapshotRef,
    crossModeSyncRef,
    suppressNextModeSwitchRerunRef,
    skipHydrateOnceRef,
    pendingRenderModeRequestRef
  };

  return {
    contentMode,
    setContentMode,
    rendererRefreshKey,
    hydrateRefs,
    crossModeSyncRef,
    handleSelectContentMode,
    applyResolvedContentMode,
    renderSelectionInMode,
    resetModeSwitchTracking,
    armSuppressHydrateRerun,
    disarmSuppressHydrateRerun,
    switchContentModeForRestore,
    bumpRendererRefreshKey
  };
}
