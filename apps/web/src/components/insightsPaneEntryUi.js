/** Wire: Thinking pane entry labels and accent lane class helpers. */

export function statusLabel(entry) {
  if (entry.status === 'failed') return 'Issue';
  if (entry.status === 'cancelled') return 'Stopped';
  if (entry.status === 'done') return 'Done';
  return 'Working';
}

export function contentUpdatesTitle(variant) {
  if (variant === 'critique') return 'Analysis';
  if (variant === 'explain') return 'Explanation';
  if (variant === 'refine') return 'Refinement';
  if (variant === 'innovate') return 'Innovation';
  if (variant === 'goMad') return 'Mad mode';
  return 'Content updates';
}

export function hidePhaseIds(variant, streamDebugEnabled) {
  if (streamDebugEnabled) return false;
  return (
    variant === 'critique' ||
    variant === 'explain' ||
    variant === 'refine' ||
    variant === 'innovate' ||
    variant === 'goMad' ||
    variant === 'exec'
  );
}

export function accentContentLaneClass(variant) {
  if (variant === 'explain') return 'is-explain-content-lane';
  if (variant === 'refine') return 'is-refine-content-lane';
  if (variant === 'innovate') return 'is-innovate-content-lane';
  if (variant === 'goMad') return 'is-gomad-content-lane';
  return '';
}

export function accentSectionTitleClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain';
  if (variant === 'refine') return 'insights-section-title-refine';
  if (variant === 'innovate') return 'insights-section-title-innovate';
  if (variant === 'goMad') return 'insights-section-title-gomad';
  return '';
}

export function accentSectionTitleIconWrapClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain-icon';
  if (variant === 'refine') return 'insights-section-title-refine-icon';
  if (variant === 'innovate') return 'insights-section-title-innovate-icon';
  if (variant === 'goMad') return 'insights-section-title-gomad-icon';
  return '';
}
