import { measureViewportForDiagram, readViewportInnerSize } from './diagramViewportFit.js';
import { collectLogicalIdCandidates } from './mermaidSourceLocate.js';

const VIEWPORT_PADDING_PX = 40;
const MIN_FOCUS_SCALE = 0.35;
const MAX_FOCUS_SCALE = 2.2;

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

function groupMatchesIds(group, idSet) {
  const anchor = diagramDomAnchor(group);
  const domId = anchor?.id;
  const dataId = group.getAttribute?.('data-id') ?? anchor?.getAttribute?.('data-id');
  if (!domId && !dataId) return false;
  const kind = group.classList.contains('cluster') ? 'cluster' : 'node';
  const candidates = collectLogicalIdCandidates({
    elementId: domId || dataId || '',
    dataId,
    kind
  });
  for (const cand of candidates) {
    if (idMatchesHighlightSet(cand, idSet)) return true;
  }
  return false;
}

function unionSvgBBox(groups) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const group of groups) {
    let box;
    try {
      box = group.getBBox?.();
    } catch {
      box = null;
    }
    if (!box || box.width <= 0 || box.height <= 0) continue;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The rendered groups a set of logical ids resolves to. Shared by both focus
 * entry points so "can I see it" and "move it into view" agree about what "it"
 * is — a disagreement there would be a camera that pans to nothing.
 *
 * @param {HTMLElement | null | undefined} viewportEl `.diagram-viewport` host
 * @param {string[]} highlightIds
 * @returns {Element[]}
 */
function matchedGroupsForIds(viewportEl, highlightIds) {
  if (!viewportEl?.querySelector || !Array.isArray(highlightIds)) return [];
  const idSet = new Set(highlightIds.filter(Boolean));
  if (idSet.size === 0) return [];
  const root = viewportEl.querySelector('.diagram-zoom-layer') ?? viewportEl;
  const matched = [];
  root
    .querySelectorAll('g.node, g.timeline-node, g.cluster, [data-et="participant"]')
    .forEach((group) => {
      if (groupMatchesIds(group, idSet)) matched.push(group);
    });
  return matched;
}

/**
 * Pan/zoom viewport so highlighted diagram nodes fill the visible canvas.
 *
 * @param {HTMLElement | null | undefined} viewportEl `.diagram-viewport` host
 * @param {string[]} highlightIds logical node ids from the advisor
 * @returns {{ x: number, y: number, scale: number } | null}
 */
export function computeViewportFocusForHighlightIds(viewportEl, highlightIds) {
  const matched = matchedGroupsForIds(viewportEl, highlightIds);
  if (matched.length === 0) return null;

  const bbox = unionSvgBBox(matched);
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) return null;

  const inner = readViewportInnerSize(viewportEl);
  if (inner.width <= 0 || inner.height <= 0) return null;

  const pad = VIEWPORT_PADDING_PX;
  const availW = Math.max(1, inner.width - pad * 2);
  const availH = Math.max(1, inner.height - pad * 2);
  const scale = Math.min(
    MAX_FOCUS_SCALE,
    Math.max(MIN_FOCUS_SCALE, Math.min(availW / bbox.width, availH / bbox.height))
  );
  const contentW = bbox.width * scale;
  const contentH = bbox.height * scale;
  const x = pad + Math.max(0, (availW - contentW) / 2) - bbox.x * scale;
  const y = pad + Math.max(0, (availH - contentH) / 2) - bbox.y * scale;

  return { x, y, scale };
}

/**
 * The same focus, but only when it is needed: returns null when every matched
 * node is already inside the viewport.
 *
 * Written for somebody pointing at a node while they talk. Yanking the camera
 * on every point would make pairing feel like being grabbed by the diagram, so
 * the rule is the one a person at your shoulder actually follows — they point
 * if you can both see it, and they scroll it into view if you cannot.
 *
 * A node with no readable rect counts as off-screen: an unmeasurable target
 * cannot be shown to be on screen, and the fallback is the focus maths saying
 * "nothing matched" rather than a hand floating over the wrong place.
 *
 * @param {HTMLElement | null | undefined} viewportEl
 * @param {string[]} highlightIds
 * @returns {{ x: number, y: number, scale: number } | null}
 */
export function computeViewportFocusIfOffscreen(viewportEl, highlightIds) {
  const matched = matchedGroupsForIds(viewportEl, highlightIds);
  if (matched.length === 0) return null;

  let hostRect;
  try {
    hostRect = viewportEl.getBoundingClientRect();
  } catch {
    return null;
  }
  if (!hostRect || hostRect.width <= 0 || hostRect.height <= 0) return null;

  const allVisible = matched.every((group) => {
    let rect;
    try {
      rect = group.getBoundingClientRect();
    } catch {
      return false;
    }
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    return (
      rect.left >= hostRect.left &&
      rect.right <= hostRect.right &&
      rect.top >= hostRect.top &&
      rect.bottom <= hostRect.bottom
    );
  });
  if (allVisible) return null;

  return computeViewportFocusForHighlightIds(viewportEl, highlightIds);
}

/**
 * Pan/zoom viewport so the full diagram is centered when change highlights are active.
 * Highlights are drawn on individual parts; the viewport should show the whole graph.
 *
 * @param {HTMLElement | null | undefined} viewportEl
 * @param {{ addedIds?: string[], modifiedIds?: string[], removedIds?: string[] } | null | undefined} highlight
 * @param {string} [_contentType]
 * @returns {{ x: number, y: number, scale: number } | null}
 */
export function computeViewportFocusForChangeHighlight(viewportEl, highlight, _contentType) {
  if (!viewportEl?.querySelector || !highlight) return null;
  const hasChanges =
    (highlight.addedIds?.length ?? 0) > 0 ||
    (highlight.modifiedIds?.length ?? 0) > 0 ||
    (highlight.removedIds?.length ?? 0) > 0;
  if (!hasChanges) return null;
  if (!viewportEl.querySelector('svg')) return null;
  return measureViewportForDiagram(viewportEl, { preferFit: true });
}
