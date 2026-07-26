import { useCallback } from 'react';
import { isConcreteContentMode } from '../utils/renderModeAction.js';
import { selectionActionTitle, topicFromDescriptor } from '../utils/appInsightHelpers.js';
import { resolveAdvisorFocusNode } from '../utils/advisorActionContext.js';

/**
 * Transform (Refine / Erlich / Go Mad / Barker) and Analyze (Critique / Explain) flows.
 *
 * @param {{
 *   contentMode: string;
 *   controls: object;
 *   goMadStreak: number;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   runStreamingAgent: (args: object) => Promise<void>;
 *   selectedNode: object | null;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (value: string) => void;
 *   setGoMadStreak: (value: number | ((prev: number) => number)) => void;
 *   setLatestCritique: (value: object | null) => void;
 *   setLoading: (value: boolean) => void;
 *   stateRef: import('react').MutableRefObject<object>;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   syncDiagramOrThrow: () => Promise<object>;
 * }} deps
 */
export function useAnalyzeFlow({
  contentMode,
  controls,
  goMadStreak,
  hasInteractedRef,
  loadingRef,
  modelProfile,
  runStreamingAgent,
  selectedNode,
  setActiveRequest,
  setError,
  setGoMadStreak,
  setLatestCritique,
  setLoading,
  stateRef,
  streamingPreviewRef,
  syncDiagramOrThrow
}) {
  const runTransform = useCallback(
    async (mode, options = {}) => {
      const useDiagramFocus = Boolean(options.useDiagramFocus);
      hasInteractedRef.current = true;
      if (loadingRef.current || streamingPreviewRef.current) return;
      if (contentMode === 'auto') return;
      if (!isConcreteContentMode(contentMode)) return;
      if (!stateRef.current.diagramSource.trim()) return;

      if (mode !== 'goMad') setGoMadStreak(0);

      const focusOverride = options.focusTarget ?? null;
      const baseFocus = focusOverride || selectedNode;
      const focusNode = useDiagramFocus
        ? undefined
        : resolveAdvisorFocusNode({
            advisorFocusDescriptor: options.advisorFocusDescriptor,
            focusTarget: focusOverride,
            selectedNode: baseFocus
          });
      const titleSelection = useDiagramFocus
        ? null
        : options.advisorFocusDescriptor?.id
          ? options.advisorFocusDescriptor
          : baseFocus;
      const advisorPrompt =
        typeof options.advisorPrompt === 'string' ? options.advisorPrompt.trim().slice(0, 400) : '';
      setLoading(true);
      setActiveRequest(`transform:${mode}`);
      setError('');

      try {
        const syncedState = await syncDiagramOrThrow();
        const labels = {
          refine: controls.actions.refine,
          erlich: controls.actions.erlich,
          goMad: controls.actions.goMad,
          barker: controls.actions.coDesign
        };
        const goMadDepth = mode === 'goMad' ? goMadStreak + 1 : undefined;
        const transformTitleVerb =
          mode === 'goMad' && goMadDepth > 1
            ? `${controls.actions.goMad} (×${goMadDepth})`
            : labels[mode];
        await runStreamingAgent({
          operation: 'transform',
          payload: {
            operation: 'transform',
            mode,
            revisionId: syncedState.revisionId,
            diagramSource: syncedState.diagramSource,
            contentType: contentMode,
            focusNode,
            modelProfile,
            ...(mode === 'goMad' ? { goMadDepth } : {}),
            ...(advisorPrompt ? { advisorPrompt } : {})
          },
          title: selectionActionTitle(titleSelection, transformTitleVerb),
          variant: options.variantOverride ?? mode,
          diagramUndoBaseline: { ...syncedState },
          topic: topicFromDescriptor(titleSelection)
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      contentMode,
      controls.actions.coDesign,
      controls.actions.goMad,
      controls.actions.erlich,
      controls.actions.refine,
      goMadStreak,
      hasInteractedRef,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      selectedNode,
      setActiveRequest,
      setError,
      setGoMadStreak,
      setLoading,
      stateRef,
      streamingPreviewRef,
      syncDiagramOrThrow
    ]
  );

  const runAnalyze = useCallback(
    async (kind, options = {}) => {
      const useDiagramFocus = Boolean(options.useDiagramFocus);
      hasInteractedRef.current = true;
      if (loadingRef.current || streamingPreviewRef.current) return;
      if (contentMode === 'auto') return;
      if (!isConcreteContentMode(contentMode)) return;
      if (!stateRef.current.diagramSource.trim()) return;

      const focusOverride = options.focusTarget ?? null;
      const baseFocus = focusOverride || selectedNode;
      const focusNode = useDiagramFocus
        ? undefined
        : resolveAdvisorFocusNode({
            advisorFocusDescriptor: options.advisorFocusDescriptor,
            focusTarget: focusOverride,
            selectedNode: baseFocus
          });
      const titleSelection = useDiagramFocus
        ? null
        : options.advisorFocusDescriptor?.id
          ? options.advisorFocusDescriptor
          : baseFocus;
      const advisorPrompt =
        typeof options.advisorPrompt === 'string' ? options.advisorPrompt.trim().slice(0, 400) : '';
      setLoading(true);
      setActiveRequest(`analyze:${kind}`);
      setError('');

      try {
        const syncedState = await syncDiagramOrThrow();
        const labels = {
          critique: controls.actions.critique,
          explain: controls.actions.explain
        };
        await runStreamingAgent({
          operation: 'analyze',
          payload: {
            operation: 'analyze',
            kind,
            revisionId: syncedState.revisionId,
            diagramSource: syncedState.diagramSource,
            contentType: contentMode,
            focusNode,
            modelProfile,
            ...(advisorPrompt ? { advisorPrompt } : {})
          },
          title: selectionActionTitle(titleSelection, labels[kind]),
          variant: kind,
          topic: topicFromDescriptor(titleSelection),
          onFinal: ({ finalText, sectionId: critiqueEntryId }) => {
            if (kind !== 'critique') return;
            const cleaned = finalText.trim();
            if (!cleaned) return;
            setLatestCritique({
              text: cleaned,
              insightEntryId: critiqueEntryId,
              focusNode,
              topic: topicFromDescriptor(titleSelection),
              createdAt: Date.now()
            });
          }
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      contentMode,
      controls.actions.critique,
      controls.actions.explain,
      hasInteractedRef,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      selectedNode,
      setActiveRequest,
      setError,
      setLatestCritique,
      setLoading,
      stateRef,
      streamingPreviewRef,
      syncDiagramOrThrow
    ]
  );

  return { runTransform, runAnalyze };
}
