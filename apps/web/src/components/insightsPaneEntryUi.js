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
  contentRussMode: 'Tres Commas mode',
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
  if (variant === 'jared') return c.contentAnalysis;
  if (variant === 'explain') return c.contentExplanation;
  if (variant === 'gilfoyle' || variant === 'dinesh') return c.contentRefinement;
  if (variant === 'erlich') return c.contentInnovation;
  if (variant === 'russ') return c.contentRussMode;
  return c.contentUpdates;
}

export function hidePhaseIds(variant, streamDebugEnabled) {
  if (streamDebugEnabled) return false;
  return (
    variant === 'jared' ||
    variant === 'explain' ||
    variant === 'gilfoyle' ||
    variant === 'dinesh' ||
    variant === 'erlich' ||
    variant === 'russ' ||
    variant === 'barker'
  );
}

export function accentContentLaneClass(variant) {
  if (variant === 'explain') return 'is-explain-content-lane';
  if (variant === 'gilfoyle') return 'is-gilfoyle-content-lane';
  if (variant === 'dinesh') return 'is-dinesh-content-lane';
  if (variant === 'erlich') return 'is-erlich-content-lane';
  if (variant === 'russ') return 'is-russ-content-lane';
  return '';
}

export function accentSectionTitleClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain';
  if (variant === 'gilfoyle') return 'insights-section-title-gilfoyle';
  if (variant === 'dinesh') return 'insights-section-title-dinesh';
  if (variant === 'erlich') return 'insights-section-title-erlich';
  if (variant === 'russ') return 'insights-section-title-russ';
  return '';
}

export function accentSectionTitleIconWrapClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain-icon';
  if (variant === 'gilfoyle') return 'insights-section-title-gilfoyle-icon';
  if (variant === 'dinesh') return 'insights-section-title-dinesh-icon';
  if (variant === 'erlich') return 'insights-section-title-erlich-icon';
  if (variant === 'russ') return 'insights-section-title-russ-icon';
  return '';
}
