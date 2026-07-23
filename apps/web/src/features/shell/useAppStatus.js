import { useMemo } from 'react';

/**
 * Derive the overlay status line and whether the in-flight stream can be stopped.
 *
 * @param {{
 *   activeRequest: string | null;
 *   autoFixAttempted: boolean;
 *   contentMode: string;
 *   controls: { loading: object; insights?: { stopRequest?: string } };
 *   error: string;
 *   loading: boolean;
 *   streamingPreview: boolean;
 *   validationError: { error: string } | null;
 *   voiceError: string;
 * }} deps
 */
export function useAppStatus({
  activeRequest,
  autoFixAttempted,
  contentMode,
  controls,
  error,
  loading,
  streamingPreview,
  validationError,
  voiceError
}) {
  const status = useMemo(() => {
    const loadingCopy = controls.loading;
    if (loading && activeRequest === 'intent') return loadingCopy.applyingChange;
    if (loading && activeRequest?.startsWith?.('transform')) return loadingCopy.transforming;
    if (loading && activeRequest?.startsWith?.('analyze')) return loadingCopy.analyzing;
    if (loading && activeRequest === 'fix') return loadingCopy.applyingFixes;
    if (loading && activeRequest === 'style') return loadingCopy.applyingStyle;
    if (loading && activeRequest === 'clear') return loadingCopy.resetting;
    if (loading && activeRequest === 'autofix')
      return contentMode === 'anything' ? loadingCopy.fixingPage : loadingCopy.fixingMermaid;
    if (loading && activeRequest === 'hydrate') return loadingCopy.hydrating;
    if (streamingPreview) return loadingCopy.refreshing;
    if (error) return error;
    if (voiceError) return voiceError;
    if (validationError && autoFixAttempted)
      return contentMode === 'anything'
        ? `Page needs manual edit: ${validationError.error}`
        : `Mermaid syntax needs manual edit: ${validationError.error}`;
    return '';
  }, [
    activeRequest,
    autoFixAttempted,
    contentMode,
    error,
    loading,
    streamingPreview,
    validationError,
    voiceError,
    controls.loading
  ]);

  const streamingAgentStoppable = useMemo(() => {
    if (!loading || !activeRequest) return false;
    return (
      activeRequest === 'intent' ||
      activeRequest === 'fix' ||
      activeRequest.startsWith('transform:') ||
      activeRequest.startsWith('analyze:')
    );
  }, [activeRequest, loading]);

  return { status, streamingAgentStoppable };
}
