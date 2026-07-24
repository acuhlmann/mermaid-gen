import { useCallback, useEffect, useRef, useState } from 'react';
import {
  syncClientDiagramState,
  submitDiagramIntent,
  submitDiagramRenderRepair
} from '../../state/diagramStore.js';
import { isMermaidInfrastructureError } from '../../utils/mermaidRenderErrors.js';
import { buildAutoFixPrompt } from '../../utils/autoFixPrompt.js';

/**
 * Client-side validation debounce and automatic diagram repair ladder.
 *
 * @param {{
 *   activeSessionId: string;
 *   animateAcceptedSource: Function;
 *   contentMode: string;
 *   loading: boolean;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (message: string) => void;
 *   setLoading: (value: boolean) => void;
 *   streamingPreview: boolean;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 * }} deps
 */
export function useDiagramAutoFix({
  activeSessionId,
  animateAcceptedSource,
  contentMode,
  loading,
  loadingRef,
  modelProfile,
  setActiveRequest,
  setError,
  setLoading,
  streamingPreview,
  streamingPreviewRef
}) {
  const [validationError, setValidationError] = useState(null);
  const [autoFixAttempted, setAutoFixAttempted] = useState(false);

  const autoFixTimerRef = useRef(null);
  const clientValidationRef = useRef({ source: null, error: null });
  const lastAutoFixSourceRef = useRef(null);
  const autoFixAttemptedRef = useRef(false);
  const autoFixAlwaysOnRef = useRef(true);

  const runAutoFix = useCallback(
    async (brokenSource, errorMessage) => {
      lastAutoFixSourceRef.current = brokenSource;
      autoFixAttemptedRef.current = true;
      setAutoFixAttempted(true);
      setLoading(true);
      setActiveRequest('autofix');
      setError('');
      try {
        const syncedState = await syncClientDiagramState({
          contentType: contentMode,
          diagramSource: brokenSource,
          sessionId: activeSessionId
        });

        if (contentMode === 'mermaid' || contentMode === 'anything') {
          const fast = await submitDiagramRenderRepair({
            revisionId: syncedState.revisionId,
            source: syncedState.diagramSource,
            renderError: errorMessage,
            contentType: contentMode,
            sessionId: activeSessionId
          });
          if (fast?.repaired && fast.state) {
            animateAcceptedSource(fast.state);
            return;
          }
        }

        const result = await submitDiagramIntent({
          contentType: contentMode,
          prompt: buildAutoFixPrompt({ contentType: contentMode, errorMessage, brokenSource }),
          revisionId: syncedState.revisionId,
          diagramSource: syncedState.diagramSource,
          settings: {},
          modelProfile,
          sessionId: activeSessionId
        });

        animateAcceptedSource(result.state);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      activeSessionId,
      animateAcceptedSource,
      contentMode,
      modelProfile,
      setActiveRequest,
      setError,
      setLoading
    ]
  );

  const scheduleAutoFix = useCallback(
    ({ source, error: nextError }) => {
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
        autoFixTimerRef.current = null;
      }

      if (!autoFixAlwaysOnRef.current) return;
      if (!nextError) return;
      if (isMermaidInfrastructureError(nextError)) return;
      if (autoFixAttemptedRef.current) return;
      if (lastAutoFixSourceRef.current === source) return;
      if (loadingRef.current || streamingPreviewRef.current) return;

      autoFixTimerRef.current = setTimeout(() => {
        autoFixTimerRef.current = null;
        if (
          loadingRef.current ||
          streamingPreviewRef.current ||
          !autoFixAlwaysOnRef.current ||
          autoFixAttemptedRef.current ||
          lastAutoFixSourceRef.current === source
        ) {
          return;
        }
        runAutoFix(source, nextError);
      }, 1500);
    },
    [loadingRef, runAutoFix, streamingPreviewRef]
  );

  const handleValidationChange = useCallback(({ source, error: nextError }) => {
    clientValidationRef.current = nextError
      ? { source, error: nextError }
      : { source: null, error: null };
    setValidationError(nextError ? { source, error: nextError } : null);

    if (!nextError) {
      autoFixAttemptedRef.current = false;
      setAutoFixAttempted(false);
      if (lastAutoFixSourceRef.current && lastAutoFixSourceRef.current !== source) {
        lastAutoFixSourceRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!validationError) {
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
        autoFixTimerRef.current = null;
      }
      return;
    }

    if (streamingPreview) {
      if (autoFixTimerRef.current) {
        clearTimeout(autoFixTimerRef.current);
        autoFixTimerRef.current = null;
      }
      return;
    }

    scheduleAutoFix(validationError);
  }, [loading, scheduleAutoFix, streamingPreview, validationError]);

  const resetAutoFixState = useCallback(() => {
    if (autoFixTimerRef.current) {
      clearTimeout(autoFixTimerRef.current);
      autoFixTimerRef.current = null;
    }
    setValidationError(null);
    setAutoFixAttempted(false);
    autoFixAttemptedRef.current = false;
    lastAutoFixSourceRef.current = null;
    clientValidationRef.current = { source: null, error: null };
  }, []);

  return {
    validationError,
    autoFixAttempted,
    clientValidationRef,
    autoFixTimerRef,
    handleValidationChange,
    resetAutoFixState
  };
}
