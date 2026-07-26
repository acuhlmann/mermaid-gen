/**
 * Free roam — turning a point on the floor into somewhere you may stand
 * (docs/office-isometric-mode.md § 5 slice 7).
 *
 * `officeFloorPlan.js` says what the room *is*; this says where you may go in
 * it. The split is deliberate: the plan module is the layout's source of truth
 * and already the largest file on the floor, and everything here is about one
 * actor (you) rather than about the room.
 *
 * Pure math, no React and no DOM, so the snap ladder can be asserted directly
 * — and per § 7's standing habit the walkable floor is **derived** from the
 * furniture rather than authored as a mask, which is what stops a layout change
 * from silently opening a route into the leadership fishbowl.
 */

import {
  FLOOR_PROPS,
  YOU_SEAT_ID,
  floorSeatIds,
  isStandableTile,
  pathCrossesGlass,
  seatFor,
  unprojectIso,
  walkPathBetween
} from './officeFloorPlan.js';
import { FLOOR_PROP_USES, isUsableProp } from './officeFloorProps.js';

/**
 * How far from the tile you actually clicked we will look for somewhere legal
 * to put you. One tile is enough for what snapping is *for* — clicking a desk
 * or a plant and stepping beside it — and stopping there is what keeps the
 * rooms you cannot enter reading as rooms you cannot enter: clicking inside the
 * leadership glass finds only tiles whose route crosses it, so nothing happens,
 * where a wider search would have walked you to some tile off to the side and
 * made the fishbowl look broken rather than sealed (§ 6 rule 17).
 *
 * Clicking just *outside* the glass still works, so you can walk up to it.
 */
const SNAP_RADIUS = 1;

/**
 * Integer tiles within `radius` of a point, nearest first. Ties break on x then
 * y so the same click always resolves to the same tile.
 *
 * @param {{ x: number, y: number }} point
 * @param {number} radius
 * @returns {Array<{ x: number, y: number }>}
 */
function candidatesAround(point, radius) {
  const originX = Math.round(point.x);
  const originY = Math.round(point.y);
  const tiles = [];
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      tiles.push({ x: originX + dx, y: originY + dy });
    }
  }
  const spread = (tile) => (tile.x - point.x) ** 2 + (tile.y - point.y) ** 2;
  return tiles.sort((a, b) => spread(a) - spread(b) || a.x - b.x || a.y - b.y);
}

/**
 * The tile you end up on when you click at `point`, or `null` when there is
 * nowhere legal nearby.
 *
 * `from` matters because reachability is not the same question as standing
 * room: the meeting-room wall runs parallel to tiles you may happily stand on,
 * while the leadership wall is exactly what stands between you and the CFO
 * (§ 6 rule 17). Passing your current tile keeps the fishbowl sealed without
 * anybody maintaining a list of where you may not go.
 *
 * @param {{ x: number, y: number }} point fractional tile, e.g. from a click
 * @param {{ from?: { x: number, y: number } | null, radius?: number }} [options]
 * @returns {{ x: number, y: number } | null}
 */
export function standableTileAt(point, { from = null, radius = SNAP_RADIUS } = {}) {
  for (const tile of candidatesAround(point, radius)) {
    if (!isStandableTile(tile)) continue;
    if (from && pathCrossesGlass(walkPathBetween(from, tile, YOU_SEAT_ID))) continue;
    return tile;
  }
  return null;
}

/**
 * The same thing from a stage pixel — what the floor's click surface has.
 *
 * @param {number} left stage x (unscaled; the stage is authored at STAGE_W×STAGE_H)
 * @param {number} top stage y
 * @param {{ from?: { x: number, y: number } | null, radius?: number }} [options]
 * @returns {{ x: number, y: number } | null}
 */
export function standableTileAtPoint(left, top, options) {
  return standableTileAt(unprojectIso(left, top), options);
}

/**
 * Where you stand to talk to somebody, in preference order (slice 8).
 *
 * Deliberately **not** `PEEK_OFFSETS`. That ladder exists to clear the monitor
 * you walked over to read (§ 6 rule 16), which is why it excludes
 * `{ dx: 0, dy: 1 }` — the obvious "beside them" tile that parks you on their
 * screen. Standing on somebody's screen while *talking* to them is not a
 * problem; it is what talking to somebody at their desk looks like. So the
 * nearest tiles come first here, and the monitor is not consulted at all.
 *
 * Every offset still moves nearer the viewer, so you paint in front of their
 * desk rather than behind it.
 */
const APPROACH_OFFSETS = [
  { dx: 0, dy: 1 },
  { dx: 1, dy: 0 },
  { dx: 1, dy: 1 },
  { dx: 0, dy: 2 },
  { dx: 2, dy: 0 },
  { dx: 2, dy: 1 },
  { dx: 1, dy: 2 }
];

/**
 * Where you stand to talk to somebody, or `null` if you cannot get to them.
 *
 * Reachability is from **your own desk**, the same static question
 * `peekTileFor` asks, which is what lets the person card offer the verb before
 * you have moved — and what keeps leadership unreachable without anybody
 * maintaining a list. Unlike a peek this works for colleagues with no desk at
 * all (Gary lives at the fridge), because a conversation needs somewhere to
 * stand, not something to look at.
 *
 * @param {string} seatId
 * @returns {{ x: number, y: number } | null}
 */
export function approachTileFor(seatId) {
  const seat = seatFor(seatId);
  if (!seat || seat.id === YOU_SEAT_ID) return null;
  const you = seatFor(YOU_SEAT_ID);
  if (!you) return null;

  for (const { dx, dy } of APPROACH_OFFSETS) {
    const mark = { x: seat.x + dx, y: seat.y + dy };
    if (!isStandableTile(mark)) continue;
    // You have to be able to *get* there…
    if (pathCrossesGlass(walkPathBetween({ x: you.x, y: you.y }, mark, YOU_SEAT_ID))) continue;
    // …and be able to talk to them once you have. Without this the ladder's
    // outer offsets reach *past* the leadership wall and hand you a mark two
    // tiles in front of the glass, which is not a conversation — it is you
    // mouthing at the CEO through a window.
    if (pathCrossesGlass([mark, { x: seat.x, y: seat.y }])) continue;
    return mark;
  }
  return null;
}

/**
 * Everybody you could walk over and talk to. Order follows the seat roster.
 *
 * @returns {string[]}
 */
export function approachableSeatIds() {
  return floorSeatIds().filter((id) => approachTileFor(id) !== null);
}

/**
 * How far from a prop we will look for somewhere to stand (slice 9). Wider than
 * `SNAP_RADIUS` because the target is the prop itself rather than a tile you
 * aimed at: `isStandableTile` refuses everything within 0.7 of a prop and
 * everything within 1.5 that would paint in front of you, so the tile you use a
 * coffee machine from is never one of its neighbours — it is the next ring out.
 */
const PROP_REACH = 2;

/**
 * Distance between two points in tile space.
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
function gap(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Where you stand to use a prop, or `null` if there is nowhere — the same shape
 * of answer `peekTileFor` and `approachTileFor` give, and for the same reason:
 * the room decides what you may do, nobody maintains a list.
 *
 * Mostly thin. A prop mark asks for nothing a *standing* mark does not already
 * ask for, so rather than a third offset ladder this is `standableTileAt` aimed
 * at the prop: nearest legal tile, reachable from your desk without walking
 * through glass. Where a peek adds "and you can see their screen" (§ 6 rule 16)
 * and an approach adds "and you can see them", using a thing you are stood next
 * to adds nothing.
 *
 * It adds one thing: **the mark has to be nearer this prop than any other
 * usable one.** Without that the coffee machine and the water cooler — 2 tiles
 * apart in a kitchen corner where `isStandableTile` refuses almost everything —
 * both resolved to the same tile, so "use the cooler" walked you to the coffee
 * machine and told you it was a cooler. Nearest-prop-wins is the room settling
 * the tie the way it settles every other one, and what it settles it with here
 * is that the cooler has no mark at all (§ 6 rule 21).
 *
 * Scenery gets `null` rather than a tile beside it. The question this answers is
 * "where do I stand to *use* this", and there is nowhere to stand to use a
 * plant — asking the geometry politely would otherwise walk you to one.
 *
 * @param {string} kind a `FLOOR_PROPS` kind
 * @returns {{ x: number, y: number } | null}
 */
export function propTileFor(kind) {
  if (!isUsableProp(kind)) return null;
  const prop = FLOOR_PROPS.find((entry) => entry.kind === kind);
  if (!prop) return null;
  const you = seatFor(YOU_SEAT_ID);
  if (!you) return null;

  const rivals = FLOOR_PROPS.filter((entry) => entry !== prop && isUsableProp(entry.kind));
  const from = { x: you.x, y: you.y };

  for (const tile of candidatesAround(prop, PROP_REACH)) {
    if (!isStandableTile(tile)) continue;
    if (pathCrossesGlass(walkPathBetween(from, tile, YOU_SEAT_ID))) continue;
    // Whoever is nearest owns the tile. Ties go to neither, which cannot
    // happen on this floor and would be a coin flip if it did.
    if (rivals.some((rival) => gap(rival, tile) < gap(prop, tile))) continue;
    return tile;
  }
  return null;
}

/** @type {string[] | null} */
let usableCache = null;

/**
 * Every prop you could actually walk up to and use. Order follows
 * `FLOOR_PROP_USES`.
 *
 * Computed once: the answer depends only on module constants, and `FloorProps`
 * asks on every render of the stage. Each call is ~100 standability probes,
 * every one of which allocates the reserved-marks list.
 *
 * @returns {string[]}
 */
export function usablePropKinds() {
  usableCache ??= FLOOR_PROP_USES.filter((use) => propTileFor(use.kind) !== null).map(
    (use) => use.kind
  );
  return usableCache;
}

/**
 * Are two tiles the same square? Used to keep pointer-move from re-rendering
 * the hover marker on every pixel.
 *
 * @param {{ x: number, y: number } | null} a
 * @param {{ x: number, y: number } | null} b
 * @returns {boolean}
 */
export function sameTile(a, b) {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y;
}
