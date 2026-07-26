/** Wire: Thinking pane entry labels and accent lane class helpers. */

const DEFAULT_INSIGHTS_COPY = {
  statusIssue: 'Issue',
  statusStopped: 'Stopped',
  statusDone: 'Done',
  statusWorking: 'Working',
  contentAnalysis: 'Analysis',
  contentExplanation: 'Explanation',
  contentRefinement: 'Refinement',
  contentInnovation: 'Innovation',
  contentMadMode: 'Mad mode',
  contentUpdates: 'Content updates'
};

function insightsCopy(copy) {
  return copy ? { ...DEFAULT_INSIGHTS_COPY, ...copy } : DEFAULT_INSIGHTS_COPY;
}

export function statusLabel(entry, copy) {
  const c = insightsCopy(copy);
  if (entry.status === 'failed') return c.statusIssue;
  if (entry.status === 'cancelled') return c.statusStopped;
  if (entry.status === 'done') return c.statusDone;
  return c.statusWorking;
}

export function contentUpdatesTitle(variant, copy) {
  const c = insightsCopy(copy);
  if (variant === 'critique') return c.contentAnalysis;
  if (variant === 'explain') return c.contentExplanation;
  if (variant === 'refine') return c.contentRefinement;
  if (variant === 'erlich') return c.contentInnovation;
  if (variant === 'goMad') return c.contentMadMode;
  return c.contentUpdates;
}

export function hidePhaseIds(variant, streamDebugEnabled) {
  if (streamDebugEnabled) return false;
  return (
    variant === 'critique' ||
    variant === 'explain' ||
    variant === 'refine' ||
    variant === 'erlich' ||
    variant === 'goMad' ||
    variant === 'barker'
  );
}

export function accentContentLaneClass(variant) {
  if (variant === 'explain') return 'is-explain-content-lane';
  if (variant === 'refine') return 'is-refine-content-lane';
  if (variant === 'erlich') return 'is-erlich-content-lane';
  if (variant === 'goMad') return 'is-gomad-content-lane';
  return '';
}

export function accentSectionTitleClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain';
  if (variant === 'refine') return 'insights-section-title-refine';
  if (variant === 'erlich') return 'insights-section-title-erlich';
  if (variant === 'goMad') return 'insights-section-title-gomad';
  return '';
}

export function accentSectionTitleIconWrapClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain-icon';
  if (variant === 'refine') return 'insights-section-title-refine-icon';
  if (variant === 'erlich') return 'insights-section-title-erlich-icon';
  if (variant === 'goMad') return 'insights-section-title-gomad-icon';
  return '';
}
