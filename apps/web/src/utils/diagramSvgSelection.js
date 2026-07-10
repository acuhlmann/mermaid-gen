/**
 * Flowchart edge paths from Mermaid carry logical ids like `L_<from>_<to>_<index>` on `data-id`
 * (see mermaid insertEdge: path.attr("data-id", edge.id)).
 *
 * @typedef {{ from: string, to: string, index: number, raw: string }} ParsedFlowchartEdgeId
 */

/** jsdom does not define `SVGPathElement` — use tag + namespace. */
function isSvgPath(el) {
  return Boolean(
    el &&
    typeof el === 'object' &&
    /** @type {Element} */ (el).namespaceURI === 'http://www.w3.org/2000/svg' &&
    /** @type {Element} */ (el).tagName === 'path'
  );
}

/**
 * @param {string | null | undefined} dataId
 * @returns {ParsedFlowchartEdgeId | null}
 */
export function parseFlowchartEdgeDataId(dataId) {
  if (!dataId || typeof dataId !== 'string') return null;
  const trimmed = dataId.trim();
  const m = trimmed.match(/^L_([^_]+)_([^_]+)_(\d+)$/);
  if (!m) return null;
  return { from: m[1], to: m[2], index: Number(m[3]), raw: trimmed };
}

/**
 * @param {EventTarget | null | undefined} target
 * @returns {SVGPathElement | null}
 */
export function resolveFlowchartEdgePathEl(target) {
  if (!target || typeof target !== 'object') return null;
  const el = /** @type {Element} */ (target);
  const path =
    el.closest?.('path[data-et="edge"]') ??
    el.closest?.('path.flowchart-link') ??
    el.closest?.('path[data-edge="true"]');
  return isSvgPath(path) ? /** @type {SVGPathElement} */ (path) : null;
}

/**
 * Edge hit may land on the path or on an edge label (`g.edgeLabel`).
 * @param {EventTarget | null | undefined} target
 * @returns {{ pathEl: SVGPathElement, dataId: string } | null}
 */
export function resolveFlowchartEdgeInteractionRoot(target) {
  const direct = resolveFlowchartEdgePathEl(target);
  if (direct) {
    const dataId = direct.getAttribute('data-id');
    if (dataId) return { pathEl: direct, dataId };
    return null;
  }
  if (!target || typeof target !== 'object') return null;
  const el = /** @type {Element} */ (target);
  const labelInner = el.closest?.('g.edgeLabel g.label[data-id]');
  const dataId = labelInner?.getAttribute?.('data-id');
  if (!dataId) return null;
  const svgRoot = labelInner.closest('svg');
  if (!svgRoot) return null;
  try {
    const path = svgRoot.querySelector(`path[data-id="${CSS.escape(dataId)}"]`);
    return isSvgPath(path) ? { pathEl: /** @type {SVGPathElement} */ (path), dataId } : null;
  } catch {
    return null;
  }
}

/**
 * @param {SVGPathElement} pathEl
 * @param {string} edgeDataId
 * @returns {string}
 */
/**
 * Sequence diagrams render participants as inner `g` groups with `data-et="participant"`
 * and `data-id` set to the actor name (not `g.node`).
 *
 * @param {EventTarget | null | undefined} target
 * @returns {{ groupEl: Element, dataId: string } | null}
 */
/**
 * Timeline diagrams render interactive units as `g.timeline-node` with an inner `path[id]`,
 * not flowchart `g.node` (see mermaid timeline drawNode).
 *
 * @param {EventTarget | null | undefined} target
 * @returns {{ groupEl: Element } | null}
 */
export function resolveTimelineNodeInteractionRoot(target) {
  if (!target || typeof target !== 'object') return null;
  const el = /** @type {Element} */ (target);
  const group = el.closest?.('g.timeline-node');
  if (!group) return null;
  return { groupEl: group };
}

export function resolveSequenceActorInteractionRoot(target) {
  if (!target || typeof target !== 'object') return null;
  const el = /** @type {Element} */ (target);

  const participant = el.closest?.('[data-et="participant"]');
  if (participant) {
    const dataId = participant.getAttribute('data-id');
    if (dataId) return { groupEl: participant, dataId };
  }

  const lifeline = el.closest?.('[data-et="life-line"]');
  if (lifeline) {
    const dataId = lifeline.getAttribute('data-id') || lifeline.getAttribute('name');
    if (dataId) {
      const svgRoot = lifeline.closest('svg');
      const groups = svgRoot?.querySelectorAll?.('[data-et="participant"]');
      if (groups) {
        for (const group of groups) {
          if (group.getAttribute('data-id') === dataId) {
            return { groupEl: group, dataId };
          }
        }
      }
      return { groupEl: lifeline, dataId };
    }
  }

  const actorShape = el.closest?.('.actor-top, .actor-bottom, rect.actor, text.actor');
  if (actorShape) {
    const host =
      actorShape.closest?.('[data-et="participant"]') ?? actorShape.closest?.('[data-id]');
    const dataId = host?.getAttribute?.('data-id');
    if (dataId) return { groupEl: host, dataId };
  }

  return null;
}

export function flowchartEdgeLabelText(pathEl, edgeDataId) {
  if (!edgeDataId) return '';
  const svgRoot = pathEl.closest('svg');
  if (!svgRoot) return '';
  try {
    const inner = svgRoot.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(edgeDataId)}"]`);
    if (!inner) return '';
    const t = inner.textContent?.replace(/\s+/g, ' ')?.trim() ?? '';
    return t.slice(0, 240);
  } catch {
    return '';
  }
}
