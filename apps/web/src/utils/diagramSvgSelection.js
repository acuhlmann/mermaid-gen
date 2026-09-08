/**
 * Flowchart edge paths from Mermaid carry logical ids like `L_<from>_<to>_<index>` on `data-id`
 * (see mermaid insertEdge: path.attr("data-id", edge.id)).
 *
 * @typedef {{ from: string, to: string, index?: number, raw: string }} ParsedFlowchartEdgeId
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
 * @param {SVGPathElement | null | undefined} [pathEl] required for stateDiagram-v2 edges (`edgeN` ids carry no endpoints)
 * @returns {ParsedFlowchartEdgeId | null}
 */
export function parseFlowchartEdgeDataId(dataId, pathEl = null) {
  if (!dataId || typeof dataId !== 'string') return null;
  const trimmed = dataId.trim();

  let m = trimmed.match(/^L_([^_]+)_([^_]+)_(\d+)$/);
  if (m) return { from: m[1], to: m[2], index: Number(m[3]), raw: trimmed };

  // erDiagram v3 unified renderer — before the class `id_` pattern, which also matches hyphens.
  // The trailing number is mermaid's global 1-based edge counter, not a per-pair index like
  // flowchart's `L_<from>_<to>_<n>` — omit it so delete/rename disambiguate by label or first
  // match (#613).
  m = trimmed.match(/^id_entity-([^-]+)-\d+_entity-([^-]+)-\d+_(\d+)$/);
  if (m) return { from: m[1], to: m[2], raw: trimmed };

  // classDiagram v3 unified renderer (prefix `id_`, not flowchart `L_`) — same global counter (#613).
  m = trimmed.match(/^id_([^_]+)_([^_]+)_(\d+)$/);
  if (m) return { from: m[1], to: m[2], raw: trimmed };

  // requirementDiagram and other hyphenated dagre edges (not flowchart/class/er shapes).
  if (!trimmed.startsWith('flowchart-') && !trimmed.startsWith('id_')) {
    m = trimmed.match(/^([^-]+)-([^-]+)-(\d+)$/);
    if (m) return { from: m[1], to: m[2], raw: trimmed };
  }

  // stateDiagram-v2 — `edgeN` carries index only; endpoints come from layout
  m = trimmed.match(/^edge(\d+)$/);
  if (m) {
    const index = Number(m[1]);
    if (!pathEl) return null;
    const endpoints = stateEdgeEndpointsFromPath(pathEl);
    if (!endpoints) return null;
    return { from: endpoints.from, to: endpoints.to, index, raw: trimmed };
  }

  return null;
}

/** @param {SVGPathElement} pathEl */
function decodeEdgeDataPoints(pathEl) {
  const raw = pathEl.getAttribute('data-points');
  if (!raw) return null;
  try {
    return JSON.parse(atob(raw));
  } catch {
    return null;
  }
}

/**
 * The `translate(x, y)` a rendered node group carries, or the origin.
 *
 * This is where a state node actually *is*: mermaid's `positionNode` writes the
 * dagre coordinate onto the `g.node` as a transform and every shape inside is
 * then drawn around that group's own origin — `rect x="-28" y="-15"`, and the
 * terminal markers as a bare `<circle r="7">` with no `cx`/`cy` at all. Read
 * only the shape, and every node in the diagram reports centre (0, 0).
 *
 * @param {Element} node
 */
function groupTranslate(node) {
  const transform = node.getAttribute('transform') ?? '';
  const m = transform.match(/translate\(\s*(-?[\d.]+)\s*[ ,]\s*(-?[\d.]+)\s*\)/);
  if (!m) return { x: 0, y: 0 };
  return { x: Number(m[1]), y: Number(m[2]) };
}

/**
 * The shape's centre *within* its group. Zero for everything mermaid draws
 * centred on the origin, which is every state node — it is non-zero only for
 * markup that positions the shape absolutely instead.
 *
 * @param {Element} node
 */
function localShapeOffset(node) {
  const circle = node.querySelector('circle');
  if (circle) {
    return {
      x: Number(circle.getAttribute('cx') || 0),
      y: Number(circle.getAttribute('cy') || 0)
    };
  }
  const rect = node.querySelector('rect') ?? (node.tagName === 'rect' ? node : null);
  if (rect) {
    const x = Number(rect.getAttribute('x') || 0);
    const y = Number(rect.getAttribute('y') || 0);
    const w = Number(rect.getAttribute('width') || 0);
    const h = Number(rect.getAttribute('height') || 0);
    return { x: x + w / 2, y: y + h / 2 };
  }
  // A terminal marker is four <path> blobs and nothing else, so there is no
  // shape to measure — and `getBBox` is both unavailable outside a laid-out
  // browser document and, in one, local to the group we have already read.
  return { x: 0, y: 0 };
}

/** @param {Element} node */
function nodeCenter(node) {
  const base = groupTranslate(node);
  const offset = localShapeOffset(node);
  return { x: base.x + offset.x, y: base.y + offset.y };
}

/** @param {{ x: number, y: number }} a @param {{ x: number, y: number }} b */
function pointDistSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Both terminals are the same source token. Mermaid renders the entry and the
 * exit of a diagram as two differently-named groups (`state-root_start-N` and
 * `state-root_end-N`), but the user wrote `[*]` for both and that is what
 * `mermaidStateEdit.js` matches against — which side of the arrow it sits on
 * fixes its meaning.
 *
 * @param {Element} group
 */
function stateNodeIdFromGroup(group) {
  const id = group.getAttribute('id') ?? '';
  const stripped = id.replace(/^diagram-\d+-/i, '');
  if (/^state-root_(start|end)-\d+$/.test(stripped)) return '[*]';
  const m = stripped.match(/^state-(.+?)-\d+$/);
  return m ? m[1] : null;
}

/** @param {SVGPathElement} pathEl */
function stateEdgeEndpointsFromPath(pathEl) {
  const points = decodeEdgeDataPoints(pathEl);
  if (!points?.length) return null;
  const svgRoot = pathEl.closest('svg');
  if (!svgRoot) return null;
  const nodes = [...svgRoot.querySelectorAll('g.node')].filter((g) => stateNodeIdFromGroup(g));
  if (nodes.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];

  /** @param {{ x: number, y: number }} pt */
  function nearestNode(pt) {
    let best = null;
    let bestD = Infinity;
    for (const node of nodes) {
      const d = pointDistSq(pt, nodeCenter(node));
      if (d < bestD) {
        bestD = d;
        best = node;
      }
    }
    return best;
  }

  const fromNode = nearestNode(first);
  const toNode = nearestNode(last);
  if (!fromNode || !toNode) return null;
  const from = stateNodeIdFromGroup(fromNode);
  const to = stateNodeIdFromGroup(toNode);
  if (!from || !to) return null;
  return { from, to };
}

/**
 * Sequence message arrows carry Mermaid ids like `i0`, `i1` on `data-id`
 * (see sequenceDiagram drawMessage: `data-id`, "i" + msgModel.id).
 *
 * @param {string | null | undefined} dataId
 * @returns {{ messageId: number, raw: string } | null}
 */
export function parseSequenceMessageDataId(dataId) {
  if (!dataId || typeof dataId !== 'string') return null;
  const trimmed = dataId.trim();
  const m = trimmed.match(/^i(\d+)$/);
  if (!m) return null;
  return { messageId: Number.parseInt(m[1], 10), raw: trimmed };
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
    let host =
      actorShape.closest?.('[data-et="participant"]') ??
      actorShape.closest?.('[data-id]') ??
      actorShape.closest?.('g.actor-top, g.actor-bottom');
    if (!host && actorShape.matches?.('g.actor-top, g.actor-bottom')) {
      host = actorShape;
    }
    const dataId =
      host?.getAttribute?.('data-id') ||
      host?.getAttribute?.('name') ||
      actorShape.getAttribute?.('name');
    if (dataId) return { groupEl: host ?? actorShape, dataId };
  }

  return null;
}

/**
 * Sequence message arrows render as `line`/`path` with `data-et="message"` and labels as
 * `text.messageText` (not flowchart `g.edgeLabel`).
 *
 * @param {EventTarget | null | undefined} target
 * @returns {{ lineEl: Element, dataId: string, from: string, to: string, label?: string } | null}
 */
export function resolveSequenceMessageInteractionRoot(target) {
  if (!target || typeof target !== 'object') return null;
  const el = /** @type {Element} */ (target);

  const direct = el.closest?.('[data-et="message"]');
  if (direct) {
    const dataId = direct.getAttribute('data-id');
    const from = direct.getAttribute('data-from');
    const to = direct.getAttribute('data-to');
    if (dataId && from && to) {
      return {
        lineEl: direct,
        dataId,
        from,
        to,
        label: sequenceMessageLabelText(direct)
      };
    }
  }

  const msgText = el.closest?.('text.messageText');
  if (msgText) {
    const host = msgText.parentElement;
    const line = host?.querySelector?.('[data-et="message"]');
    if (line) {
      const dataId = line.getAttribute('data-id');
      const from = line.getAttribute('data-from');
      const to = line.getAttribute('data-to');
      if (dataId && from && to) {
        const label = msgText.textContent?.replace(/\s+/g, ' ')?.trim() ?? '';
        return {
          lineEl: line,
          dataId,
          from,
          to,
          ...(label ? { label } : {})
        };
      }
    }
  }

  return null;
}

/**
 * @param {Element} lineEl
 * @returns {string}
 */
export function sequenceMessageLabelText(lineEl) {
  const host = lineEl.parentElement;
  const text = host?.querySelector?.('text.messageText');
  const raw = text?.textContent?.replace(/\s+/g, ' ')?.trim() ?? '';
  return raw.slice(0, 240);
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

/**
 * The display name of a selected node group — moved here from DiagramCanvas.jsx (ADR-0005), where
 * it was a module-local helper of a file the ratchet holds at 1889 lines.
 *
 * `<title>` is the **last** fallback, not the first. Mermaid stamps `<title>` on flowchart nodes too
 * (it is the browser tooltip, and often differs from the drawn label), so promoting it would change
 * what every existing family reports for `label`/`partName` and what the rename prompt prefills.
 * Only families with no `text` and no `foreignObject` inside the group reach it — which, before #523,
 * described nothing, because every selectable group mermaid emits carries drawn text. It exists for
 * the pie wedge: `mermaidPieHitTargets.js` wraps the path and names it with a `<title>`, and a
 * `<title>` was chosen precisely because it cannot be mistaken for a label drawn on the canvas.
 *
 * @param {Element | null | undefined} nodeEl
 * @returns {string}
 */
export function nodeTitleFromElement(nodeEl) {
  if (!nodeEl) return '';
  const parts = [];
  const seen = new Set();
  function pushText(t) {
    if (!t) return;
    const trimmed = t.replace(/\s+/g, ' ').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    parts.push(trimmed);
  }
  nodeEl.querySelectorAll('text').forEach((textEl) => pushText(textEl.textContent));
  // Mermaid 11 renders flowchart node labels as HTML inside <foreignObject>; <text> is empty there.
  if (parts.length === 0) {
    nodeEl.querySelectorAll('foreignObject .nodeLabel, foreignObject .label').forEach((el) => {
      pushText(el.textContent);
    });
  }
  if (parts.length === 0) {
    nodeEl.querySelectorAll('foreignObject').forEach((fo) => pushText(fo.textContent));
  }
  if (parts.length === 0) {
    pushText(nodeEl.querySelector(':scope > title')?.textContent);
  }
  return parts.join(' · ').slice(0, 240);
}
