import { readViewportInnerSize } from './diagramViewportFit.js';
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
 * Pan/zoom viewport so highlighted diagram nodes fill the visible canvas.
 *
 * @param {HTMLElement | null | undefined} viewportEl `.diagram-viewport` host
 * @param {string[]} highlightIds logical node ids from the advisor
 * @returns {{ x: number, y: number, scale: number } | null}
 */
export function computeViewportFocusForHighlightIds(viewportEl, highlightIds) {
  if (!viewportEl?.querySelector || !Array.isArray(highlightIds) || highlightIds.length === 0) {
    return null;
  }
  const idSet = new Set(highlightIds.filter(Boolean));
  if (idSet.size === 0) return null;

  const root = viewportEl.querySelector('.diagram-zoom-layer') ?? viewportEl;
  const matched = [];
  root.querySelectorAll('g.node, g.timeline-node, g.cluster, [data-et="participant"]').forEach((group) => {
    if (groupMatchesIds(group, idSet)) matched.push(group);
  });
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
