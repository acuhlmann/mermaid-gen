import { collectLogicalIdCandidates } from './mermaidSourceLocate.js';

function diagramDomAnchor(group) {
  if (!group) return null;
  if (group.id) return group;
  const direct = group.querySelector?.(':scope > [id]');
  if (direct?.id) return direct;
  const nested = group.querySelector?.('[id]');
  if (nested?.id) return nested;
  return group;
}

function idMatchesHighlightSet(id, set) {
  if (!id || !set?.size) return false;
  if (set.has(id)) return true;
  const lower = id.toLowerCase();
  for (const x of set) {
    if (x.toLowerCase() === lower) return true;
  }
  return false;
}

function changeHighlightCategory(group, anchor, kind, added, modified) {
  const domId = anchor?.id;
  const dataId = group.getAttribute?.('data-id') ?? anchor?.getAttribute?.('data-id');
  if (!domId && !dataId) return null;
  const candidates = collectLogicalIdCandidates({
    elementId: domId || dataId || '',
    dataId,
    kind
  });
  for (const cand of candidates) {
    if (idMatchesHighlightSet(cand, added)) return 'added';
  }
  for (const cand of candidates) {
    if (idMatchesHighlightSet(cand, modified)) return 'modified';
  }
  return null;
}

/**
 * Apply added/modified highlight CSS classes to Mermaid `g.node` / `g.cluster` elements
 * inside the given root, based on logical-id sets from a structural diff.
 * Idempotent — clears any previously applied classes first.
 *
 * @param {ParentNode | null | undefined} rootEl SVG host (the element containing the rendered SVG).
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} highlight
 * @param {{ addedClass?: string, modifiedClass?: string }} [options]
 */
export function applyDiagramHighlightToSvg(
  rootEl,
  highlight,
  { addedClass = 'is-diagram-change-added', modifiedClass = 'is-diagram-change-modified' } = {}
) {
  if (!rootEl?.querySelectorAll) return;
  rootEl.querySelectorAll('g.node, g.cluster, [data-et="participant"]').forEach((group) => {
    group.classList.remove(addedClass, modifiedClass);
  });
  if (!highlight) return;
  const added = new Set(highlight.addedIds ?? []);
  const modified = new Set(highlight.modifiedIds ?? []);
  if (added.size === 0 && modified.size === 0) return;
  rootEl.querySelectorAll('g.node, g.cluster, [data-et="participant"]').forEach((group) => {
    const anchor = diagramDomAnchor(group);
    const dataId = group.getAttribute?.('data-id') ?? anchor?.getAttribute?.('data-id');
    if (!anchor?.id && !dataId) return;
    const kind = group.classList.contains('cluster')
      ? 'cluster'
      : group.getAttribute?.('data-et') === 'participant'
        ? 'node'
        : 'node';
    const cat = changeHighlightCategory(group, anchor, kind, added, modified);
    if (cat === 'added') {
      group.classList.add(addedClass);
    } else if (cat === 'modified') {
      group.classList.add(modifiedClass);
    }
  });
}
