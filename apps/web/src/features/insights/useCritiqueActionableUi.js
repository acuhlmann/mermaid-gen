import { useMemo } from 'react';
import { splitCritiqueActionableSections } from '@archislop/shared';

/**
 * Critique actionable checklist state for the Thinking pane.
 *
 * @param {{
 *   activeRequest: string | null;
 *   handleFixFromCritique: (scope: string, options?: object) => void;
 *   insightsEntries: Array<object>;
 *   latestCritique: { text?: string, insightEntryId?: string } | null;
 *   loading: boolean;
 * }} deps
 */
export function useCritiqueActionableUi({
  activeRequest,
  handleFixFromCritique,
  insightsEntries,
  latestCritique,
  loading
}) {
  const critiqueActionableSplit = useMemo(
    () => (latestCritique?.text ? splitCritiqueActionableSections(latestCritique.text) : null),
    [latestCritique]
  );

  const critiqueActionableUi = useMemo(() => {
    if (
      !latestCritique?.text ||
      !critiqueActionableSplit?.hasSection ||
      critiqueActionableSplit.items.length === 0
    ) {
      return null;
    }
    const items = critiqueActionableSplit.items;
    const critiqueEntry = latestCritique.insightEntryId
      ? insightsEntries.find((e) => e.id === latestCritique.insightEntryId)
      : null;
    const streamMessages =
      Array.isArray(critiqueEntry?.a2uiMessages) && critiqueEntry.a2uiMessages.length > 0
        ? critiqueEntry.a2uiMessages
        : null;
    return {
      critiqueText: latestCritique.text,
      insightEntryId: latestCritique.insightEntryId ?? null,
      headingText: critiqueActionableSplit.headingText,
      items,
      prefix: critiqueActionableSplit.prefix,
      suffix: critiqueActionableSplit.suffix,
      a2uiMessages: streamMessages,
      busy: loading && activeRequest === 'fix',
      onFixSelected: (mask) => {
        if (Array.isArray(mask)) {
          handleFixFromCritique('selected', { checkValues: mask });
        } else {
          handleFixFromCritique('selected');
        }
      },
      onFixAll: () => handleFixFromCritique('all')
    };
  }, [
    activeRequest,
    critiqueActionableSplit,
    handleFixFromCritique,
    insightsEntries,
    latestCritique,
    loading
  ]);

  return { critiqueActionableSplit, critiqueActionableUi };
}
