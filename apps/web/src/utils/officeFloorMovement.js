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
  YOU_SEAT_ID,
  isStandableTile,
  pathCrossesGlass,
  unprojectIso,
  walkPathBetween
} from './officeFloorPlan.js';

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
