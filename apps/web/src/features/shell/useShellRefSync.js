import { useEffect } from 'react';

/**
 * Mirror shell state into refs and run unmount cleanup for timers and voice.
 */
export function useShellRefSync({
  autoFixTimerRef,
  celebrationTimerRef,
  cleanupVoiceInput,
  diagramAutoHighlightTimerRef,
  loading,
  loadingRef,
  pendingAutoDiagramHighlightRef,
  pendingAutoDiagramHighlightTimeoutRef,
  state,
  stateRef,
  streamingPreview,
  streamingPreviewRef,
  syncTimerRef,
  streamTimerRef
}) {
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading, loadingRef]);

  useEffect(() => {
    streamingPreviewRef.current = streamingPreview;
  }, [streamingPreview, streamingPreviewRef]);

  useEffect(() => {
    stateRef.current = state;
  }, [state, stateRef]);

  useEffect(
    () => () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      if (streamTimerRef.current != null) {
        cancelAnimationFrame(streamTimerRef.current);
      }
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
      }
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
      cleanupVoiceInput();
      if (diagramAutoHighlightTimerRef.current != null) {
        window.clearTimeout(diagramAutoHighlightTimerRef.current);
        diagramAutoHighlightTimerRef.current = null;
      }
      if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
        window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
        pendingAutoDiagramHighlightTimeoutRef.current = null;
      }
      pendingAutoDiagramHighlightRef.current = null;
    },
    [
      autoFixTimerRef,
      celebrationTimerRef,
      cleanupVoiceInput,
      diagramAutoHighlightTimerRef,
      pendingAutoDiagramHighlightRef,
      pendingAutoDiagramHighlightTimeoutRef,
      streamTimerRef,
      syncTimerRef
    ]
  );
}
