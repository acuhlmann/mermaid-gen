/**
 * Where the people around your screen are looking, and where the one in the
 * chair sits.
 *
 * A huddle used to be faces that lit up when it was their turn and otherwise
 * stared straight ahead. Real people turn to whoever is talking, glance at the
 * box you just picked up, and shuffle over when they are in your way. These
 * are the pure halves of that — no React, no store — so the rules can be
 * tested without a layout engine. `useHuddleStaging` measures the screen and
 * hands the rects in.
 */

import { pointSearchRoot, rectsOverlap } from './officePairPointing.js';

/** How far a face leans toward what it is looking at. A lean, not a walk. */
export const HUDDLE_GAZE_MAX_PX = 6;

/** How long a nod or a glance stays on screen before it is just a memory. */
export const PAIR_GESTURE_MS = 1800;

/**
 * The seat's footprint, for docking. A face plus its name tag, with room for
 * the lean; generous on purpose, since the cost of guessing small is a face
 * over the very box you are editing.
 */
export const HUDDLE_SEAT_SIZE_PX = 96;

/** The docked seat stays this far from the layer's top and bottom edges. */
const DOCK_MIN_POS = 0.18;
const DOCK_MAX_POS = 0.82;
/**
 * How wide the speech bubble beside a docked face reaches into the canvas.
 * Matches `.office-huddle-bubble`'s width plus its gap from the face.
 */
export const HUDDLE_BUBBLE_REACH_PX = 190;
/** How far up or down to try when the level spot is taken. */
const DOCK_STEP = 0.22;
/** Where the pair sits when there is nothing to sit beside: the chair they pulled over. */
export const PAIR_DOCK_DEFAULT = Object.freeze({ side: 'right', pos: 0.48 });

/**
 * @typedef {{ left: number, top: number, width: number, height: number }} Rect
 */

/** @param {Rect} rect */
export function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * The lean from a face toward a point, capped at `max` pixels.
 *
 * @param {Rect} fromRect the seat
 * @param {{ x: number, y: number }} to
 * @param {number} [max]
 * @returns {{ x: number, y: number }}
 */
export function gazeOffset(fromRect, to, max = HUDDLE_GAZE_MAX_PX) {
  const from = rectCenter(fromRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1) return { x: 0, y: 0 };
  return { x: Math.round((dx / length) * max), y: Math.round((dy / length) * max) };
}

/**
 * Who each face is looking at.
 *
 * - A mob looks at whoever has the floor (the speaker, or the face you pinned),
 *   and the one talking looks at the box they mean.
 * - A pair looks at the box the moment is about: a box they just nodded or
 *   glanced at, else the one they are pointing at.
 *
 * @param {{
 *   attendees: string[],
 *   pairing?: boolean,
 *   floorId?: string | null,
 *   focusIds?: string[],
 *   gestureFocusId?: string | null
 * }} scene
 * @returns {Record<string, { seat: string } | { node: string }>}
 */
export function huddleLookTargets({
  attendees,
  pairing = false,
  floorId = null,
  focusIds = [],
  gestureFocusId = null
}) {
  const targets = {};
  const pointed = Array.isArray(focusIds) ? (focusIds.find(Boolean) ?? null) : null;
  if (pairing) {
    const node = gestureFocusId || pointed;
    if (node && attendees[0]) targets[attendees[0]] = { node };
    return targets;
  }
  if (!floorId) return targets;
  for (const id of attendees) {
    if (id !== floorId) targets[id] = { seat: floorId };
    else if (pointed) targets[id] = { node: pointed };
  }
  return targets;
}

/**
 * The node you are working on, by the class the canvas puts on it: the one you
 * selected, or the one you are dragging a connection out of.
 *
 * @param {ParentNode | null | undefined} [root]
 * @returns {string | null} an id `resolvePointTarget` can find again
 */
export function attentionNodeId(root) {
  const host = pointSearchRoot(root);
  if (!host?.querySelector) return null;
  const el = host.querySelector('.is-connect-source') ?? host.querySelector('.is-diagram-selected');
  if (!el) return null;
  const id = el.id || el.getAttribute?.('data-id') || '';
  return id || null;
}

function clampPos(pos) {
  return Math.min(DOCK_MAX_POS, Math.max(DOCK_MIN_POS, pos));
}

/**
 * The seat's footprint at one spot, widened inward by `reach` — the speech
 * bubble that sits beside the face, which must not land on a box either.
 *
 * @param {Rect} layer @param {'left' | 'right'} side @param {number} pos
 * @param {number} size @param {number} reach
 */
function seatRectAt(layer, side, pos, size, reach) {
  const top = layer.top + layer.height * pos - size / 2;
  const width = size + reach;
  const left = side === 'left' ? layer.left : layer.left + layer.width - width;
  return { left, top, width, height: size };
}

/**
 * Where the person in the chair sits: on the side nearest the box the moment
 * is about, level with it — and never on top of something you need.
 *
 * Tries the near side at the box's height, then one and two steps above and
 * below, then the same on the far side. The first spot whose footprint (face
 * plus `reach`, the bubble beside it) covers none of `avoidRects` — the box
 * itself, every other box, your selection, the label you are typing — wins.
 * With no box to sit beside they take the default chair, still moving off
 * anything in the way.
 *
 * @param {{
 *   layerRect: Rect,
 *   focusRect?: Rect | null,
 *   avoidRects?: Rect[],
 *   seatSize?: number,
 *   reach?: number
 * }} input
 * @returns {{ side: 'left' | 'right', pos: number }} `pos` is a 0–1 fraction of the layer height
 */
export function pairDockPlacement({
  layerRect,
  focusRect = null,
  avoidRects = [],
  seatSize = HUDDLE_SEAT_SIZE_PX,
  reach = 0
}) {
  if (!layerRect || layerRect.width <= 0 || layerRect.height <= 0) return PAIR_DOCK_DEFAULT;
  let near = PAIR_DOCK_DEFAULT.side;
  let level = PAIR_DOCK_DEFAULT.pos;
  if (focusRect) {
    const center = rectCenter(focusRect);
    near = center.x < layerRect.left + layerRect.width / 2 ? 'left' : 'right';
    level = clampPos((center.y - layerRect.top) / layerRect.height);
  }
  const far = near === 'left' ? 'right' : 'left';
  const blockers = [...(focusRect ? [focusRect] : []), ...avoidRects].filter(Boolean);
  const heights = [0, -1, 1, -2, 2].map((steps) => clampPos(level + steps * DOCK_STEP));
  for (const side of [near, far]) {
    for (const pos of heights) {
      const seat = seatRectAt(layerRect, side, pos, seatSize, reach);
      if (!blockers.some((rect) => rectsOverlap(seat, rect))) {
        return { side, pos: Math.round(pos * 100) / 100 };
      }
    }
  }
  return { side: near, pos: Math.round(level * 100) / 100 };
}

/**
 * True when a seat would cover something you are working on. Such a face
 * steps back (fades and lets clicks through) rather than moving: in a mob
 * there is nowhere free to move to, and stepping back is what people do.
 *
 * @param {Rect} seatRect
 * @param {Rect[]} avoidRects
 */
export function seatIsInTheWay(seatRect, avoidRects) {
  return avoidRects.some((rect) => rect && rectsOverlap(seatRect, rect));
}
