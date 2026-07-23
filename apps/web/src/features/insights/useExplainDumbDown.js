import { useCallback, useState } from 'react';
import {
  isLabelExplainGiveUpLevel,
  LABEL_EXPLAIN_GIBBERISH_LEVEL,
  MAX_LABEL_EXPLAIN_DUMB_LEVEL
} from '@archislop/shared';
import { fetchExplainDumbDown } from '../../utils/fetchExplainDumbDown.js';
import { explainEntryMarkdown } from '../../utils/explainEntryMarkdown.js';
import { reportAdvisorLlmUsage } from '../../utils/reportAdvisorLlmUsage.js';

/**
 * Progressive "dumb down" controls for explain insight entries.
 *
 * @param {{
 *   activeSessionId: string;
 *   contentMode: string;
 *   controls: object;
 *   costTrackingEnabled: boolean;
 *   agentCostEstimatesRef: import('react').MutableRefObject<object>;
 *   insightsEntriesRef: import('react').MutableRefObject<Array<object>>;
 *   setError: (message: string) => void;
 *   setGamification: import('react').Dispatch<import('react').SetStateAction<object>>;
 *   setInsightsEntries: import('react').Dispatch<import('react').SetStateAction<Array<object>>>;
 * }} deps
 */
export function useExplainDumbDown({
  activeSessionId,
  contentMode,
  controls,
  costTrackingEnabled,
  agentCostEstimatesRef,
  insightsEntriesRef,
  setError,
  setGamification,
  setInsightsEntries
}) {
  const [explainDumbLevelByEntryId, setExplainDumbLevelByEntryId] = useState({});
  const [explainDumbLoadingEntryId, setExplainDumbLoadingEntryId] = useState(null);
  const [explainDumbSurrenderedEntryIds, setExplainDumbSurrenderedEntryIds] = useState({});

  const reportAdvisorUsage = useCallback(
    ({ usage, model, inputTokens, outputTokens }) => {
      const resolvedUsage =
        usage && typeof usage === 'object'
          ? usage
          : {
              ...(Number.isFinite(inputTokens) ? { inputTokens } : {}),
              ...(Number.isFinite(outputTokens) ? { outputTokens } : {})
            };
      reportAdvisorLlmUsage({
        costTrackingEnabled,
        rates: agentCostEstimatesRef.current?.rates,
        usage: resolvedUsage,
        model,
        setGamification
      });
    },
    [agentCostEstimatesRef, costTrackingEnabled, setGamification]
  );

  const handleExplainDumbDown = useCallback(
    async (entryId) => {
      const entry = insightsEntriesRef.current.find((e) => e.id === entryId);
      if (!entry || entry.variant !== 'explain' || (entry.status ?? 'running') !== 'done') return;
      if (explainDumbLoadingEntryId) return;

      const currentLevel = explainDumbLevelByEntryId[entryId] ?? 0;
      if (explainDumbSurrenderedEntryIds[entryId]) return;

      if (isLabelExplainGiveUpLevel(currentLevel)) {
        setExplainDumbSurrenderedEntryIds((prev) => ({ ...prev, [entryId]: true }));
        return;
      }

      const nextLevel =
        currentLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL
          ? LABEL_EXPLAIN_GIBBERISH_LEVEL
          : currentLevel <= 0
            ? 1
            : currentLevel + 1;
      const isGibberish = nextLevel === LABEL_EXPLAIN_GIBBERISH_LEVEL;
      const previousExplain = explainEntryMarkdown(entry);
      if (!previousExplain) return;

      setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: nextLevel }));
      setExplainDumbLoadingEntryId(entryId);

      try {
        const { markdown, explainSections, usage, model } = await fetchExplainDumbDown({
          previousExplain,
          contentType: entry.contentType ?? contentMode,
          sessionId: activeSessionId,
          style: isGibberish ? 'gibberish' : 'simple',
          simpleLevel: isGibberish ? undefined : nextLevel
        });
        reportAdvisorUsage({ usage, model });
        if (!markdown) {
          setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: currentLevel }));
          return;
        }
        setInsightsEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  content: markdown,
                  ...(explainSections?.sections?.length
                    ? { explainSections }
                    : { explainSections: undefined })
                }
              : e
          )
        );
      } catch (err) {
        setExplainDumbLevelByEntryId((prev) => ({ ...prev, [entryId]: currentLevel }));
        if (err?.name !== 'AbortError') {
          setError(err?.message || controls.loading.simplifyFailed);
        }
      } finally {
        setExplainDumbLoadingEntryId(null);
      }
    },
    [
      activeSessionId,
      contentMode,
      controls.loading.simplifyFailed,
      explainDumbLevelByEntryId,
      explainDumbLoadingEntryId,
      explainDumbSurrenderedEntryIds,
      insightsEntriesRef,
      reportAdvisorUsage,
      setError,
      setInsightsEntries
    ]
  );

  return {
    explainDumbLevelByEntryId,
    explainDumbLoadingEntryId,
    explainDumbSurrenderedEntryIds,
    handleExplainDumbDown,
    reportAdvisorUsage
  };
}
