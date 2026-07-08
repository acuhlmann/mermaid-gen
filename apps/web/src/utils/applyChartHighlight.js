/**
 * Apply added/modified highlight markers to Vega-Lite chart SVG marks.
 * Uses `data-diff-state` so the same CSS as infographic previews can style them.
 *
 * @param {ParentNode | null | undefined} rootEl
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} highlight
 */
export function applyChartHighlight(rootEl, highlight) {
  if (!rootEl?.querySelectorAll) return;
  rootEl.querySelectorAll('[data-diff-state]').forEach((el) => {
    el.removeAttribute('data-diff-state');
  });
  if (!highlight) return;

  const added = new Set(highlight.addedIds ?? []);
  const modified = new Set(highlight.modifiedIds ?? []);
  if (added.size === 0 && modified.size === 0) return;

  const marks = [...rootEl.querySelectorAll('[aria-roledescription="mark"]')];
  marks.forEach((mark, index) => {
    const id = String(index);
    if (added.has(id)) {
      mark.setAttribute('data-diff-state', 'added');
    } else if (modified.has(id)) {
      mark.setAttribute('data-diff-state', 'modified');
    }
  });
}
