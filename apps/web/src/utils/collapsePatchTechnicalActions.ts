const APPLY_MERMAID_PATCH = 'apply_mermaid_patch';

/** One row in the insights technical-actions ledger (partial shape — callers may add fields). */
export type TechnicalActionRow = {
  name?: string;
  status?: string;
  count?: number;
  id?: string;
  label?: string;
  durationMs?: number;
  outcomeDetail?: unknown;
  patchStats?: unknown;
};

/**
 * If the last two technical actions are consecutive successful apply_mermaid_patch calls,
 * merges them into one row with an incremented count (shorter insights UX).
 */
export function collapseConsecutiveApplyPatchActions<T extends TechnicalActionRow>(
  actions: T[],
  formatLabel: (name: string, repeatCount: number) => string
): T[] {
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
    const durationMs = (prev.durationMs ?? 0) + (cur.durationMs ?? 0);
    return [
      ...actions.slice(0, i - 1),
      {
        ...prev,
        count,
        durationMs: durationMs > 0 ? durationMs : prev.durationMs,
        outcomeDetail: cur.outcomeDetail ?? prev.outcomeDetail,
        patchStats: cur.patchStats ?? prev.patchStats,
        label: formatLabel(APPLY_MERMAID_PATCH, count)
      }
    ];
  }
  return actions;
}
