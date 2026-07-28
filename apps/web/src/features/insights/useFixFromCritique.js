import { useCallback } from 'react';
import { splitCritiqueActionableSections } from '@archislop/shared';
import { selectionActionTitle, topicFromDescriptor } from '../../utils/appInsightHelpers.js';

/**
 * Build and run a fix-from-critique intent via the streaming agent.
 *
 * @param {{
 *   contentMode: string;
 *   critiqueActionableSelected: boolean[];
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   latestCritique: object | null;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   modelProfile: string;
 *   runStreamingAgent: Function;
 *   setActiveRequest: (value: string | null) => void;
 *   setError: (message: string) => void;
 *   setRussStreak: import('react').Dispatch<import('react').SetStateAction<number>>;
 *   setLatestCritique: (value: object | null) => void;
 *   setLoading: (value: boolean) => void;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   syncDiagramOrThrow: () => Promise<object>;
 * }} deps
 */
export function useFixFromCritique({
  contentMode,
  critiqueActionableSelected,
  hasInteractedRef,
  latestCritique,
  loadingRef,
  modelProfile,
  runStreamingAgent,
  setActiveRequest,
  setError,
  setRussStreak,
  setLatestCritique,
  setLoading,
  streamingPreviewRef,
  syncDiagramOrThrow
}) {
  const handleFixFromCritique = useCallback(
    async (scope = 'all', options = {}) => {
      hasInteractedRef.current = true;
      if (!latestCritique?.text || loadingRef.current || streamingPreviewRef.current) return;

      const split = splitCritiqueActionableSections(latestCritique.text);
      const actionableItems = split.items;
      const checkValues = options.checkValues;
      const selectedMask =
        checkValues != null
          ? actionableItems.map((_, i) => Boolean(checkValues[i]))
          : actionableItems.map((_, i) => Boolean(critiqueActionableSelected[i]));

      if (scope === 'selected') {
        if (actionableItems.length === 0) return;
        const chosen = actionableItems.filter((_, i) => selectedMask[i]);
        if (chosen.length === 0) return;
      }

      const itemsToApply =
        scope === 'selected' ? actionableItems.filter((_, i) => selectedMask[i]) : actionableItems;

      const useActionableBullets = itemsToApply.length > 0;
      let critiqueBlock;
      if (useActionableBullets) {
        critiqueBlock = itemsToApply.map((t) => `- ${t}`).join('\n');
      } else {
        critiqueBlock = latestCritique.text;
      }

      const FIX_PROMPT_MAX_CRITIQUE_CHARS = 2000;
      if (critiqueBlock.length > FIX_PROMPT_MAX_CRITIQUE_CHARS) {
        critiqueBlock = `${critiqueBlock.slice(0, FIX_PROMPT_MAX_CRITIQUE_CHARS).trimEnd()}\n…`;
      }

      const contentLabelByMode = {
        mermaid: 'Mermaid diagram',
        infographic: 'infographic',
        metaphor3d: '3D metaphor view',
        chart: 'Vega-Lite chart'
      };
      const contentLabel = contentLabelByMode[contentMode] ?? 'diagram';
      const outputHintByMode = {
        mermaid:
          'Output one full valid Mermaid diagram in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.\n- Keep Mermaid syntax valid and deliver the entire diagram source in one go.',
        infographic:
          'Output one full valid AntV Infographic DSL in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.',
        metaphor3d:
          'Output one full valid metaphor JSON DSL in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.',
        chart:
          'Output one full valid chart JSON wrapper (Vega-Lite spec inside) in a single apply step, then briefly summarize — do not iterate multiple cosmetic patches.'
      };
      const outputHint =
        outputHintByMode[contentMode] ??
        'Output one full valid diagram update in a single apply step, then briefly summarize.';

      const intro = useActionableBullets
        ? `Improve the current ${contentLabel} by applying ONLY the following improvements. Do not implement other critique suggestions.`
        : `Improve the current ${contentLabel} based on this critique. Apply concrete fixes as a single complete update.`;
      const critiqueLabel = useActionableBullets ? 'Improvements to apply:' : 'Critique:';
      const requirementsBlock = useActionableBullets
        ? `- Implement only the improvements listed above.
- Preserve the original intent and main story.
- Prioritize readability and clarity within that scope.
- ${outputHint}`
        : `- Preserve the original intent and main story.
- Address the critique fully, including structure, labels, and any visual/style points raised.
- Prioritize readability and clarity improvements first.
- ${outputHint}`;

      const fixPrompt = `${intro}

${critiqueLabel}
${critiqueBlock}

Requirements:
${requirementsBlock}`;

      setLoading(true);
      setActiveRequest('fix');
      setError('');
      setRussStreak(0);

      try {
        const syncedState = await syncDiagramOrThrow();
        await runStreamingAgent({
          operation: 'intent',
          payload: {
            operation: 'intent',
            prompt: fixPrompt,
            revisionId: syncedState.revisionId,
            diagramSource: syncedState.diagramSource,
            contentType: contentMode,
            settings: {},
            focusNode: latestCritique.focusNode,
            modelProfile
          },
          title: selectionActionTitle(latestCritique.focusNode, 'Fix from critique'),
          variant: 'intent',
          diagramUndoBaseline: { ...syncedState },
          topic: latestCritique.topic ?? topicFromDescriptor(latestCritique.focusNode)
        });
        setLatestCritique(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setActiveRequest(null);
      }
    },
    [
      contentMode,
      critiqueActionableSelected,
      hasInteractedRef,
      latestCritique,
      loadingRef,
      modelProfile,
      runStreamingAgent,
      setActiveRequest,
      setError,
      setRussStreak,
      setLatestCritique,
      setLoading,
      streamingPreviewRef,
      syncDiagramOrThrow
    ]
  );

  return { handleFixFromCritique };
}
