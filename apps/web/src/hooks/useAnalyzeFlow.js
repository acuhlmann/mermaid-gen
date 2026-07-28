import { useCallback } from 'react';
import { isConcreteContentMode } from '../utils/renderModeAction.js';
import { selectionActionTitle, topicFromDescriptor } from '../utils/appInsightHelpers.js';
import { resolveAdvisorFocusNode } from '../utils/advisorActionContext.js';

/**
 * Transform (Gilfoyle / Erlich / Russ / Barker) and Analyze (Critique / Explain) flows.
 *
 * @param {{
 *   contentMode: string;
 *   controls: object;
 *   russStreak: number;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   runStreamingAgent: (args: object) => Promise<void>;
 *   selectedNode: object | null;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (value: string) => void;
 *   setRussStreak: (value: number | ((prev: number) => number)) => void;
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
  russStreak,
  hasInteractedRef,
  loadingRef,
  modelProfile,
  runStreamingAgent,
  selectedNode,
  setActiveRequest,
  setError,
  setRussStreak,
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

      if (mode !== 'russ') setRussStreak(0);

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
          gilfoyle: controls.actions.gilfoyle,
          dinesh: controls.actions.dinesh,
          erlich: controls.actions.erlich,
          russ: controls.actions.russ,
          barker: controls.actions.coDesign
        };
        const russDepth = mode === 'russ' ? russStreak + 1 : undefined;
        const transformTitleVerb =
          mode === 'russ' && russDepth > 1
            ? `${controls.actions.russ} (×${russDepth})`
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
            ...(mode === 'russ' ? { russDepth } : {}),
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
      controls.actions.russ,
      controls.actions.erlich,
      controls.actions.gilfoyle,
      controls.actions.dinesh,
      russStreak,
      hasInteractedRef,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      selectedNode,
      setActiveRequest,
      setError,
      setRussStreak,
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
          jared: controls.actions.jared,
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
            if (kind !== 'jared') return;
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
      controls.actions.jared,
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
