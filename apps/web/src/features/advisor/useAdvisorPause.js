import { useMemo } from 'react';

/**
 * Derive when the proactive advisor loop and office distractions should pause.
 */
export function useAdvisorPause({
  clearConfirmOpen,
  contentMode,
  editorOpen,
  insightsEntries,
  insightsOpen,
  isFullscreen,
  liveDraftContentType,
  liveDraftSource,
  loading,
  narrowLayout,
  officeCanvasGrace,
  officeDirectoryOpen,
  slopPromptExpanded,
  streamingPreview,
  voiceListening
}) {
  const advisorPause = useMemo(
    () =>
      loading ||
      streamingPreview ||
      (Boolean(liveDraftSource) && liveDraftContentType === contentMode) ||
      insightsEntries.some((e) => (e.status ?? 'running') === 'running') ||
      voiceListening ||
      slopPromptExpanded ||
      clearConfirmOpen ||
      editorOpen ||
      (narrowLayout && insightsOpen) ||
      isFullscreen ||
      officeDirectoryOpen,
    [
      clearConfirmOpen,
      contentMode,
      editorOpen,
      insightsEntries,
      insightsOpen,
      isFullscreen,
      liveDraftContentType,
      liveDraftSource,
      loading,
      narrowLayout,
      officeDirectoryOpen,
      slopPromptExpanded,
      streamingPreview,
      voiceListening
    ]
  );

  const officeDistractionsPaused = advisorPause || officeCanvasGrace;

  return { advisorPause, officeDistractionsPaused };
}
