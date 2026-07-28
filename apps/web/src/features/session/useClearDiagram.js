import { useCallback } from 'react';
import {
  createSessionId,
  normalizeSessionId,
  syncClientDiagramState
} from '../../state/diagramStore.js';
import { createInitialDiagramState } from '@archislop/shared';
import { sessionPathFor } from '../../utils/appSessionLocation.js';
import { isConcreteContentMode } from '../../utils/renderModeAction.js';

/**
 * Wipe the session canvas and mint a fresh server room.
 */
export function useClearDiagram({
  cacheRef,
  clearDiagramHighlightTimers,
  clearVoiceError,
  contentMode,
  freshlyMintedSessionIdsRef,
  loadingRef,
  promptRef,
  resetAutoFixState,
  resetModeSwitchTracking,
  sessionTopicRef,
  setActiveRequest,
  setActiveSessionId,
  setClearConfirmOpen,
  setCritiqueActionableSelected,
  setError,
  setRussStreak,
  setHoverDescriptor,
  setInsightsEntries,
  setLatestCritique,
  setLiveDraftContentType,
  setLiveDraftSource,
  setLoading,
  setPrompt,
  setSelectedNode,
  setSessionHasPeerContent,
  setState,
  setStreamingPreview,
  setToolbarAnchor,
  stateRef,
  stopVoiceInput,
  streamTimerRef,
  streamingPreviewRef,
  syncTimerRef
}) {
  const handleClearDiagram = useCallback(() => {
    if (loadingRef.current || streamingPreviewRef.current) return;
    setClearConfirmOpen(true);
  }, [loadingRef, setClearConfirmOpen, streamingPreviewRef]);

  const performClearDiagram = useCallback(async () => {
    setClearConfirmOpen(false);
    if (loadingRef.current || streamingPreviewRef.current) return;
    setRussStreak(0);
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    if (streamTimerRef.current != null) {
      cancelAnimationFrame(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    stopVoiceInput({ immediate: true });
    setStreamingPreview(false);
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    setPrompt('');
    promptRef.current = '';
    setSelectedNode(null);
    setHoverDescriptor(null);
    setToolbarAnchor(null);
    setLatestCritique(null);
    setInsightsEntries([]);
    setCritiqueActionableSelected([]);
    sessionTopicRef.current = null;
    resetModeSwitchTracking();
    clearDiagramHighlightTimers();
    setError('');
    clearVoiceError();
    resetAutoFixState();
    setLoading(true);
    setActiveRequest('clear');
    try {
      const nid = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
      freshlyMintedSessionIdsRef.current.add(nid);
      await Promise.all([
        syncClientDiagramState({ contentType: 'mermaid', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'infographic', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'metaphor3d', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'chart', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'forms', diagramSource: '', sessionId: nid }),
        syncClientDiagramState({ contentType: 'anything', diagramSource: '', sessionId: nid })
      ]);
      freshlyMintedSessionIdsRef.current.delete(nid);
      const fresh = createInitialDiagramState(
        isConcreteContentMode(contentMode) ? contentMode : 'mermaid'
      );
      stateRef.current = fresh;
      setState(fresh);
      setSessionHasPeerContent(false);
      cacheRef.current = null;
      window.history.replaceState({}, '', sessionPathFor(nid));
      setActiveSessionId(nid);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setActiveRequest(null);
    }
  }, [
    cacheRef,
    clearDiagramHighlightTimers,
    clearVoiceError,
    contentMode,
    freshlyMintedSessionIdsRef,
    loadingRef,
    promptRef,
    resetAutoFixState,
    resetModeSwitchTracking,
    sessionTopicRef,
    setActiveRequest,
    setActiveSessionId,
    setClearConfirmOpen,
    setCritiqueActionableSelected,
    setError,
    setRussStreak,
    setHoverDescriptor,
    setInsightsEntries,
    setLatestCritique,
    setLiveDraftContentType,
    setLiveDraftSource,
    setLoading,
    setPrompt,
    setSelectedNode,
    setSessionHasPeerContent,
    setState,
    setStreamingPreview,
    setToolbarAnchor,
    stateRef,
    stopVoiceInput,
    streamTimerRef,
    streamingPreviewRef,
    syncTimerRef
  ]);

  return { handleClearDiagram, performClearDiagram };
}
