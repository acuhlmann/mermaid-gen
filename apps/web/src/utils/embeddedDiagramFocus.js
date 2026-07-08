import { collectLogicalIdCandidates } from './mermaidSourceLocate.js';

const ORIGINAL_VIEWBOX_ATTR = 'data-embed-original-viewbox';
const FOCUS_PADDING_RATIO = 0.14;
const MIN_BBOX_DIM = 48;

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

function unionSvgBBox(elements) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    let box;
    try {
      box = el.getBBox?.();
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

function readViewBoxString(svgEl) {
  const vb = svgEl.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) {
    return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  }
  const attr = svgEl.getAttribute('viewBox');
  return typeof attr === 'string' ? attr.trim() : '';
}

function storeOriginalViewBox(svgEl) {
  if (!svgEl || svgEl.getAttribute(ORIGINAL_VIEWBOX_ATTR)) return;
  const vb = readViewBoxString(svgEl);
  if (vb) svgEl.setAttribute(ORIGINAL_VIEWBOX_ATTR, vb);
}

function highlightHasChanges(highlight) {
  if (!highlight) return false;
  return (
    (highlight.addedIds?.length ?? 0) > 0 ||
    (highlight.modifiedIds?.length ?? 0) > 0 ||
    (highlight.removedIds?.length ?? 0) > 0
  );
}

/**
 * @param {ParentNode | null | undefined} host
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} highlight
 * @param {'mermaid' | 'infographic'} kind
 * @returns {SVGElement[]}
 */
export function collectHighlightedSvgElements(host, highlight, kind) {
  if (!host?.querySelectorAll || !highlightHasChanges(highlight)) return [];

  if (kind === 'infographic') {
    const byState = [...host.querySelectorAll('[data-diff-state]')];
    if (byState.length > 0) return byState;

    const idSet = new Set([
      ...(highlight.addedIds ?? []),
      ...(highlight.modifiedIds ?? [])
    ]);
    if (idSet.size === 0) return [];
    const matched = [];
    host.querySelectorAll('[data-indexes]').forEach((el) => {
      const indexes = el.getAttribute('data-indexes') ?? '';
      if (idSet.has(indexes)) matched.push(el);
    });
    return matched;
  }

  const styled = [
    ...host.querySelectorAll(
      'g.node.is-diagram-change-added, g.cluster.is-diagram-change-added, g.node.is-diagram-change-modified, g.cluster.is-diagram-change-modified, g.timeline-node.is-diagram-change-added, g.timeline-node.is-diagram-change-modified, [data-et="participant"].is-diagram-change-added, [data-et="participant"].is-diagram-change-modified'
    )
  ];
  if (styled.length > 0) return styled;

  const idSet = new Set([
    ...(highlight.addedIds ?? []),
    ...(highlight.modifiedIds ?? [])
  ]);
  if (idSet.size === 0) return [];
  const matched = [];
  host.querySelectorAll('g.node, g.timeline-node, g.cluster, [data-et="participant"]').forEach((group) => {
    if (groupMatchesIds(group, idSet)) matched.push(group);
  });
  return matched;
}

/**
 * @param {DOMRectReadOnly | { x: number, y: number, width: number, height: number }} bbox
 * @param {number} [paddingRatio]
 */
export function computeFocusedViewBox(bbox, paddingRatio = FOCUS_PADDING_RATIO) {
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) return null;

  let { x, y, width, height } = bbox;
  if (width < MIN_BBOX_DIM) {
    const extra = (MIN_BBOX_DIM - width) / 2;
    x -= extra;
    width = MIN_BBOX_DIM;
  }
  if (height < MIN_BBOX_DIM) {
    const extra = (MIN_BBOX_DIM - height) / 2;
    y -= extra;
    height = MIN_BBOX_DIM;
  }

  const padX = Math.max(width * paddingRatio, 12);
  const padY = Math.max(height * paddingRatio, 12);
  return `${x - padX} ${y - padY} ${width + padX * 2} ${height + padY * 2}`;
}

function applySvgFitAttributes(svgEl) {
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.setAttribute('width', '100%');
  svgEl.setAttribute('height', '100%');
}

/**
 * Fit the embedded preview SVG to the full diagram. Change highlights are applied
 * separately; the preview stays centered on the whole graph for context.
 *
 * @param {HTMLElement | null | undefined} hostEl inner host containing the root `<svg>`
 * @param {{ addedIds?: string[], modifiedIds?: string[] } | null | undefined} [_highlight]
 * @param {'mermaid' | 'infographic'} [_kind]
 */
export function applyEmbeddedDiagramFocus(hostEl, _highlight, _kind) {
  const svgEl = hostEl?.querySelector?.('svg');
  if (!svgEl) return;

  storeOriginalViewBox(svgEl);
  const original = svgEl.getAttribute(ORIGINAL_VIEWBOX_ATTR) || readViewBoxString(svgEl);
  if (!original) return;

  svgEl.setAttribute('viewBox', original);
  applySvgFitAttributes(svgEl);
}

/**
 * @param {HTMLElement | null | undefined} hostEl
 */
export function resetEmbeddedDiagramFocus(hostEl) {
  const svgEl = hostEl?.querySelector?.('svg');
  if (!svgEl) return;

  const original = svgEl.getAttribute(ORIGINAL_VIEWBOX_ATTR);
  if (original) {
    svgEl.setAttribute('viewBox', original);
    applySvgFitAttributes(svgEl);
  }
  svgEl.removeAttribute(ORIGINAL_VIEWBOX_ATTR);
}
