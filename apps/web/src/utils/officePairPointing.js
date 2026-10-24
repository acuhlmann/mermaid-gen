/**
 * Where the person in the chair is pointing.
 *
 * A pairing beat can carry a `focusId` — a node id the server has already
 * checked against the ids the client could actually see — and this turns that
 * id into somewhere on screen to draw a hand. Pure lookups over the rendered
 * SVG: no React, no store, so the resolution rules can be tested without
 * mounting a canvas.
 *
 * The class name lives here and nowhere else. The canvas applies it (see
 * `DiagramCanvas`'s `pointFocus`) and the styles live beside the rest of the
 * huddle chrome, so a rename is one edit.
 */

import { resolveDiagramNodeWrap } from './diagramGraphEditNodeResolve.js';

/** The ring a pointed-at node wears. Applied through `applyDiagramHighlightToSvg`. */
export const OFFICE_POINTED_CLASS = 'is-office-pointed';

/**
 * The canvas host to search. Same reach as the advisor's label walk
 * (`useAdvisorShell`): the office layer is a sibling of the canvas in the shell
 * tree, so there is no ref to hand down and no reason to invent one.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {ParentNode | null}
 */
export function pointSearchRoot(root) {
  if (root?.querySelector) return root;
  if (typeof document === 'undefined') return null;
  return document.querySelector('.diagram-zoom-layer') ?? document;
}

/**
 * Resolve a focus id to the rendered group that would wear the ring.
 *
 * @param {ParentNode | null | undefined} root
 * @param {string | null | undefined} focusId
 * @returns {Element | null}
 */
export function resolvePointTarget(root, focusId) {
  const id = typeof focusId === 'string' ? focusId.trim() : '';
  if (!id) return null;
  const host = pointSearchRoot(root);
  if (!host) return null;
  /*
   * Both lookups, in the order the canvas edit path already uses them: the id
   * Mermaid wrote into the DOM (suffixed per render) first, then the logical id
   * from the source. Which one the model was shown depends on how the label
   * walk read the node, so neither alone is enough.
   */
  return (
    resolveDiagramNodeWrap(host, { id }) ?? resolveDiagramNodeWrap(host, { dataId: id }) ?? null
  );
}

/**
 * Where to draw the hand: the pointed-at node's rect on screen.
 *
 * Null when there is nothing to point at — an unrendered node, a stale id from
 * a diagram that has since changed. The caller drops the pointer rather than
 * parking it at the origin, because a hand over empty canvas says "look here"
 * about nothing.
 *
 * @param {ParentNode | null | undefined} root
 * @param {string | null | undefined} focusId
 * @returns {{ left: number, top: number, width: number, height: number } | null}
 */
export function pointTargetRect(root, focusId) {
  const target = resolvePointTarget(root, focusId);
  if (!target?.getBoundingClientRect) return null;
  let rect;
  try {
    rect = target.getBoundingClientRect();
  } catch {
    return null;
  }
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

/** Rendered width of the hand glyph, used to decide whether a side has room. */
export const POINT_HAND_SIZE_PX = 34;

/** Air between the hand's fingertip and the node's edge. */
const POINT_HAND_GAP_PX = 6;

/**
 * Every rendered node on the canvas, as on-screen rects: the boxes a hand must
 * not land on. Zero-size entries (unrendered, or jsdom) are skipped.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {Array<{ left: number, top: number, width: number, height: number }>}
 */
export function pointObstacleRects(root) {
  const host = pointSearchRoot(root);
  if (!host?.querySelectorAll) return [];
  const rects = [];
  for (const el of host.querySelectorAll('g.node, g.edgeLabel')) {
    let r;
    try {
      r = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (r && r.width > 0 && r.height > 0) {
      rects.push({ left: r.left, top: r.top, width: r.width, height: r.height });
    }
  }
  return rects;
}

/**
 * The arrows between nodes, as thin on-screen rects: places a hand should avoid
 * when it can, but not at the cost of landing on a box. A straight edge has a
 * zero-height bounding box, so each one is padded by a few pixels to stay
 * hittable. Curved edges come back as their whole bounding box, which is why
 * these are a preference (`softObstacles`) rather than a hard rule.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {Array<{ left: number, top: number, width: number, height: number }>}
 */
export function pointEdgeRects(root) {
  const host = pointSearchRoot(root);
  if (!host?.querySelectorAll) return [];
  const pad = 3;
  const rects = [];
  for (const el of host.querySelectorAll('g.edgePaths path, path.flowchart-link')) {
    let r;
    try {
      r = el.getBoundingClientRect();
    } catch {
      continue;
    }
    if (!r || (r.width <= 0 && r.height <= 0)) continue;
    rects.push({
      left: r.left - pad,
      top: r.top - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2
    });
  }
  return rects;
}

/** True when two on-screen rects share any area. */
export function rectsOverlap(a, b) {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/**
 * The hand's box and fingertip for one side of `rect`. The fingertip sits
 * `POINT_HAND_GAP_PX` off the node's edge, centred on that edge.
 */
function handCandidate(rect, side) {
  const size = POINT_HAND_SIZE_PX;
  const gap = POINT_HAND_GAP_PX;
  const midX = rect.left + rect.width / 2;
  const midY = rect.top + rect.height / 2;
  switch (side) {
    case 'right': {
      const x = rect.left + rect.width + gap;
      return {
        side,
        x,
        y: midY,
        box: { left: x, top: midY - size / 2, width: size, height: size }
      };
    }
    case 'top': {
      const y = rect.top - gap;
      return {
        side,
        x: midX,
        y,
        box: { left: midX - size / 2, top: y - size, width: size, height: size }
      };
    }
    case 'bottom': {
      const y = rect.top + rect.height + gap;
      return {
        side,
        x: midX,
        y,
        box: { left: midX - size / 2, top: y, width: size, height: size }
      };
    }
    default: {
      const x = rect.left - gap;
      return {
        side: 'left',
        x,
        y: midY,
        box: { left: x - size, top: midY - size / 2, width: size, height: size }
      };
    }
  }
}

/**
 * Where to draw the hand: beside the node, never on it — and never on a
 * neighbouring box either.
 *
 * The hand used to sit inside the node's top-right corner, where it covered the
 * label the line was talking about. It now sits just outside one edge, fingertip
 * a few pixels off the ring. Sides are tried in order and the first one whose
 * hand lands on no other node (and stays on screen) wins:
 *
 * 1. With a second point on screen, the far side from the other box, so the two
 *    hands bracket the pair instead of crossing the arrow between them.
 *    Otherwise the left — a 👉 reads left-to-right.
 * 2. The opposite horizontal side, then above, then below.
 *
 * A side that also misses every arrow (`softObstacles`) is preferred over one
 * that only misses the boxes. Dense diagrams can leave no clear side at all;
 * then the first side that is on screen is used, since a hand slightly over a
 * neighbour still beats no hand.
 *
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {{
 *   otherRect?: { left: number, top: number, width: number, height: number } | null,
 *   obstacles?: Array<{ left: number, top: number, width: number, height: number }>,
 *   softObstacles?: Array<{ left: number, top: number, width: number, height: number }>,
 *   viewportWidth?: number,
 *   viewportHeight?: number
 * }} [options]
 * @returns {{ x: number, y: number, side: 'left' | 'right' | 'top' | 'bottom' }}
 *   `x`/`y` is the fingertip; the hand extends away from the node from there.
 */
export function pointHandPlacement(
  rect,
  { otherRect = null, obstacles = [], softObstacles = [], viewportWidth, viewportHeight } = {}
) {
  const width = viewportSize(viewportWidth, 'innerWidth');
  const height = viewportSize(viewportHeight, 'innerHeight');
  let first = 'left';
  if (otherRect) {
    const center = rect.left + rect.width / 2;
    const otherCenter = otherRect.left + otherRect.width / 2;
    first = otherCenter < center ? 'right' : 'left';
  }
  const order = [first, first === 'left' ? 'right' : 'left', 'top', 'bottom'];
  const candidates = order.map((side) => handCandidate(rect, side));
  const onScreen = candidates.filter(
    ({ box }) =>
      box.left >= 0 &&
      box.top >= 0 &&
      box.left + box.width <= width &&
      box.top + box.height <= height
  );
  const misses = (list) => (candidate) => !list.some((o) => rectsOverlap(candidate.box, o));
  const clearOfBoxes = onScreen.filter(misses(obstacles));
  const pick =
    clearOfBoxes.find(misses(softObstacles)) ?? clearOfBoxes[0] ?? onScreen[0] ?? candidates[0];
  return { side: pick.side, x: pick.x, y: pick.y };
}

function viewportSize(given, key) {
  if (Number.isFinite(given) && given > 0) return given;
  if (typeof window !== 'undefined' && window[key] > 0) return window[key];
  return Number.POSITIVE_INFINITY;
}

/**
 * A beat's points, in order, as the canvas and the hands consume them: the
 * first id, then the second when the line is about two boxes.
 *
 * @param {{ focusId?: unknown, alsoFocusId?: unknown } | null | undefined} beat
 * @returns {string[]}
 */
export function beatFocusIds(beat) {
  const ids = [beat?.focusId, beat?.alsoFocusId].filter(
    (id) => typeof id === 'string' && id.trim() !== ''
  );
  return ids.filter((id, index) => ids.indexOf(id) === index);
}

/** Topic chips stay chip-sized; the full line rides in the tooltip. */
const TOPIC_LABEL_MAX = 28;
const TOPIC_FALLBACK_WORDS = 4;
/** How much of the picked point a reply carries, so "Why that?" says which "that". */
const TOPIC_CONTEXT_MAX = 160;

function nodeLabel(root, id) {
  const text = resolvePointTarget(root, id)?.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

function clampLabel(text) {
  return text.length > TOPIC_LABEL_MAX ? `${text.slice(0, TOPIC_LABEL_MAX - 1).trimEnd()}…` : text;
}

/**
 * A short name for one of the pair's points, for its topic chip: the box (or
 * the two boxes) it pointed at when it pointed, else its first few words.
 *
 * @param {{ text?: string, focusId?: string, alsoFocusId?: string } | null | undefined} beat
 * @param {ParentNode | null | undefined} [root]
 * @returns {string}
 */
export function pairTopicLabel(beat, root) {
  const boxes = beatFocusIds(beat)
    .map((id) => nodeLabel(root, id))
    .filter(Boolean);
  if (boxes.length > 0) return clampLabel(boxes.join(' ↔ '));
  const words = String(beat?.text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const head = words.slice(0, TOPIC_FALLBACK_WORDS).join(' ');
  return clampLabel(words.length > TOPIC_FALLBACK_WORDS ? `${head}…` : head);
}

/**
 * Your reply, with the point it answers attached when they made more than
 * one. Without it, "Why that?" after four points reached the model as a
 * question about whichever one it guessed.
 *
 * @param {string} text what you said
 * @param {{ text?: string } | null | undefined} topic the point in play
 * @param {number} topicCount how many points they made this turn
 * @returns {string}
 */
export function pairReplyAbout(text, topic, topicCount) {
  const point = typeof topic?.text === 'string' ? topic.text.trim() : '';
  if (topicCount < 2 || !point) return text;
  return `${text} (about your point: "${point.slice(0, TOPIC_CONTEXT_MAX)}")`;
}
