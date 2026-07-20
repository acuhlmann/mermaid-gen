import { useCallback } from 'react';
import {
  applyMermaidStyleDirective,
  applyStyleEditsToStyleConfig,
  canApplyStyleEditsDeterministically,
  styleEditsToPrompt
} from '@archislop/shared';
import { playSubmitThunk } from '../utils/agentChimes.js';
import { submitDiagramStyle, syncClientDiagramState } from '../state/diagramStore.js';

/**
 * Apply style-edit patches from an insight entry (deterministic Mermaid path, style API, or intent fallback).
 *
 * @param {{
 *   activeSessionId: string;
 *   animateAcceptedSource: (state: object) => void;
 *   contentMode: string;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (value: string) => void;
 *   setInsightsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
 *   setLoading: (value: boolean) => void;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   submitIntentWithPrompt: (prompt: string, options?: object) => Promise<void>;
 *   syncDiagramOrThrow: () => Promise<object>;
 *   tryAgentSound: (playFn: (ctx: unknown) => void) => void;
 * }} deps
 */
export function useStyleEdits({
  activeSessionId,
  animateAcceptedSource,
  contentMode,
  loadingRef,
  modelProfile,
  setActiveRequest,
  setError,
  setInsightsOpen,
  setLoading,
  streamingPreviewRef,
  submitIntentWithPrompt,
  syncDiagramOrThrow,
  tryAgentSound
}) {
  const handleApplyStyleEdits = useCallback(
    async (entry) => {
      const edits = entry?.styleEdits;
      if (!Array.isArray(edits) || edits.length === 0) return;
      if (loadingRef.current || streamingPreviewRef.current) return;

      setInsightsOpen(true);
      tryAgentSound(playSubmitThunk);
      setLoading(true);
      setActiveRequest('style');
      setError('');

      try {
        const syncedState = await syncDiagramOrThrow();
        const stylePrompt = styleEditsToPrompt(edits);

        if (
          contentMode === 'mermaid' &&
          canApplyStyleEditsDeterministically(edits, syncedState.styleConfig)
        ) {
          const nextStyleConfig = applyStyleEditsToStyleConfig(edits, syncedState.styleConfig);
          const styled = applyMermaidStyleDirective({
            mermaidSource: syncedState.diagramSource,
            styleConfig: nextStyleConfig
          });
          const nextState = await syncClientDiagramState({
            contentType: 'mermaid',
            diagramSource: styled.mermaidSource,
            styleConfig: styled.styleConfig,
            sessionId: activeSessionId
          });
          animateAcceptedSource(nextState);
          return;
        }

        if (contentMode === 'mermaid' || contentMode === 'chart') {
          const result = await submitDiagramStyle({
            stylePrompt,
            prompt: stylePrompt,
            revisionId: syncedState.revisionId,
            diagramSource: syncedState.diagramSource,
            contentType: contentMode,
            settings: {},
            modelProfile,
            sessionId: activeSessionId
          });
          animateAcceptedSource(result.state);
          return;
        }

        await submitIntentWithPrompt(stylePrompt, {
          variantOverride: 'refine',
          skipLoadingGuard: true
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      activeSessionId,
      animateAcceptedSource,
      contentMode,
      loadingRef,
      modelProfile,
      setActiveRequest,
      setError,
      setInsightsOpen,
      setLoading,
      streamingPreviewRef,
      submitIntentWithPrompt,
      syncDiagramOrThrow,
      tryAgentSound
    ]
  );

  return { handleApplyStyleEdits };
}
