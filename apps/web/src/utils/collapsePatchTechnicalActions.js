const APPLY_MERMAID_PATCH = 'apply_mermaid_patch';

/**
 * If the last two technical actions are consecutive successful apply_mermaid_patch calls,
 * merges them into one row with an incremented count (shorter insights UX).
 *
 * @param {Array<{ name?: string, status?: string, count?: number, id?: string, label?: string }>} actions
 * @param {(name: string, repeatCount: number) => string} formatLabel
 * @returns {typeof actions}
 */
export function collapseConsecutiveApplyPatchActions(actions, formatLabel) {
  if (!Array.isArray(actions) || actions.length < 2) return actions;
  const i = actions.length - 1;
  const cur = actions[i];
  const prev = actions[i - 1];
  if (
    cur?.name === APPLY_MERMAID_PATCH &&
    cur?.status === 'done' &&
    prev?.name === APPLY_MERMAID_PATCH &&
    prev?.status === 'done'
  ) {
    const count = (prev.count ?? 1) + 1;
    return [
      ...actions.slice(0, i - 1),
      {
        ...prev,
        count,
        label: formatLabel(APPLY_MERMAID_PATCH, count)
      }
    ];
  }
  return actions;
}
