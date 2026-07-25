/**
 * The office floor plan — pure geometry + layout data for isometric mode
 * (docs/office-isometric-mode.md, ADR-0011).
 *
 * This module is the floor's single source of truth: where the room is, who
 * sits where, and which props stand on which tile. It is deliberately pure
 * data + pure math (no JSX, no React, no DOM) so the layout can be asserted in
 * tests and later reused for walk-path waypoints (slice 2) without dragging a
 * renderer along.
 *
 * Coordinates are **tiles**, not pixels. The grid runs `x` down-right and `y`
 * down-left; `projectIso` turns a tile into a stage pixel using the classic 2:1
 * projection, and `depthOf` gives the painter's-algorithm order (nearer things
 * — larger x + y — paint later).
 *
 *     screen x = (x - y) * TILE_W / 2       screen y = (x + y) * TILE_H / 2
 *
 * Seat rows are the floor's answer to `personaFaceTraits`: a new cast member
 * costs one row here, and a test fails until they get one.
 */

/** Tile footprint in stage pixels. 2:1 is the standard isometric ratio. */
export const TILE_W = 112;
export const TILE_H = 56;

/** Tiles across (x) and deep (y). The floor plate spans −0.5 … GRID−0.5. */
export const GRID_W = 12;
export const GRID_H = 9;

/** Tile (0,0) lands here on the stage, leaving headroom for the back walls. */
export const ORIGIN_X = 520;
export const ORIGIN_Y = 120;

/**
 * The logical stage. Everything is laid out at this fixed size and then scaled
 * to fit the viewport by the renderer, so layout math never depends on the
 * device — the reason a phone and a 4K monitor show the same room.
 */
export const STAGE_W = 1210;
export const STAGE_H = 800;

/** Height of the two back walls, in stage pixels. */
export const WALL_H = 132;

/**
 * The SVG canvas every prop and seat is drawn on, with (0, 0) at the centre of
 * its floor tile — so a prop is positioned by `projectIso` plus this offset and
 * nothing else. Tall props (server rack, glass) draw upward into `minY`.
 *
 * Lives here rather than beside the art because component modules may only
 * export components (Fast Refresh).
 */
export const PROP_VIEW = { w: 260, h: 260, minX: -130, minY: -200 };
export const PROP_VIEW_BOX = `${PROP_VIEW.minX} ${PROP_VIEW.minY} ${PROP_VIEW.w} ${PROP_VIEW.h}`;

/**
 * Project a tile coordinate to a point on the stage. Accepts fractional tiles
 * so props can sit between tiles (the meeting table straddles four).
 *
 * @param {number} x
 * @param {number} y
 * @returns {{ left: number, top: number }}
 */
export function projectIso(x, y) {
  return {
    left: ORIGIN_X + (x - y) * (TILE_W / 2),
    top: ORIGIN_Y + (x + y) * (TILE_H / 2)
  };
}

/**
 * Painter's-algorithm depth for a tile: things closer to the viewer (larger
 * x + y) paint on top. Scaled by 10 so a seat's own parts (chair / person /
 * desk) can interleave within one tile without colliding with the next.
 *
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function depthOf(x, y) {
  return Math.round((x + y) * 10);
}

/** The floor plate's outer corners, in tiles (north, east, south, west). */
export const FLOOR_BOUNDS = {
  minX: -0.5,
  minY: -0.5,
  maxX: GRID_W - 0.5,
  maxY: GRID_H - 0.5
};

/**
 * Zone plates: tinted floor regions with a label. `rect` is
 * `[x0, y0, x1, y1]` in tiles and projects to a parallelogram. `copyKey` looks
 * the label up in `officeChromeCopy().floor.zones` so zones localize like the
 * rest of the office.
 *
 * @type {Array<{ id: string, rect: [number, number, number, number], tone: 'neutral' | 'glass' | 'kitchen' | 'pod' }>}
 */
export const FLOOR_ZONES = [
  { id: 'reception', rect: [-0.5, -0.5, 2.3, 1.7], tone: 'neutral' },
  { id: 'leadership', rect: [5.3, -0.5, 9.7, 1.0], tone: 'glass' },
  { id: 'kitchen', rect: [-0.5, 5.6, 2.7, 8.5], tone: 'kitchen' },
  { id: 'meeting', rect: [9.4, 5.7, 11.5, 8.5], tone: 'glass' },
  { id: 'pod', rect: [3.6, 3.6, 9.4, 8.5], tone: 'pod' },
  { id: 'hrCorner', rect: [9.4, 3.2, 11.5, 5.4], tone: 'neutral' }
];

/**
 * The four projected corners of a zone rect, for an SVG polygon.
 *
 * @param {[number, number, number, number]} rect
 * @returns {Array<{ left: number, top: number }>}
 */
export function zonePolygon([x0, y0, x1, y1]) {
  return [projectIso(x0, y0), projectIso(x1, y0), projectIso(x1, y1), projectIso(x0, y1)];
}

/**
 * The centre of a zone rect — where its label sits.
 *
 * @param {[number, number, number, number]} rect
 * @returns {{ left: number, top: number }}
 */
export function zoneCentre([x0, y0, x1, y1]) {
  return projectIso((x0 + x1) / 2, (y0 + y1) / 2);
}

/**
 * Who sits where. `id` doubles as the React key and the `PersonaFace` id, so
 * the player's seat uses the same `'you'` convention as the meeting overlay
 * (unknown id → `fallbackEmoji`).
 *
 * `desk: false` means they are on their feet — Gary lives at the fridge, not at
 * a workstation.
 *
 * @type {Array<{ id: string, x: number, y: number, desk: boolean, zone: string }>}
 */
export const FLOOR_SEATS = [
  // You, near the front of the room, facing your own monitor.
  { id: 'you', x: 7, y: 7, desk: true, zone: 'pod' },

  // Your team — the five advisor personas at adjacent desks.
  { id: 'refine', x: 6, y: 4, desk: true, zone: 'pod' },
  { id: 'innovate', x: 4, y: 6, desk: true, zone: 'pod' },
  { id: 'critique', x: 8, y: 5, desk: true, zone: 'pod' },
  { id: 'explain', x: 5, y: 8, desk: true, zone: 'pod' },
  { id: 'goMad', x: 9, y: 6, desk: true, zone: 'pod' },

  // The floor.
  { id: 'helpdesk', x: 2, y: 2, desk: true, zone: 'reception' },
  { id: 'scrumMaster', x: 5, y: 2, desk: true, zone: 'floor' },
  { id: 'intern', x: 2, y: 5, desk: true, zone: 'floor' },
  { id: 'greybeard', x: 9, y: 2, desk: true, zone: 'floor' },
  { id: 'hr', x: 10, y: 4, desk: true, zone: 'hrCorner' },
  { id: 'facilities', x: 1, y: 6, desk: false, zone: 'kitchen' },

  // Leadership, in a glass row along the back wall. Four people, one window.
  { id: 'cto', x: 6, y: 0, desk: true, zone: 'leadership' },
  { id: 'exec', x: 7, y: 0, desk: true, zone: 'leadership' },
  { id: 'cfo', x: 8, y: 0, desk: true, zone: 'leadership' },
  { id: 'ciso', x: 9, y: 0, desk: true, zone: 'leadership' }
];

/** The player's seat id — the tile "sit down" returns you to. */
export const YOU_SEAT_ID = 'you';

/**
 * Environment props. `span` / `axis` apply to `glassPanel` only (a partition
 * running `span` tiles along the given axis).
 *
 * @type {Array<{ kind: string, x: number, y: number, span?: number, axis?: 'x' | 'y' }>}
 */
export const FLOOR_PROPS = [
  { kind: 'receptionDesk', x: 1, y: 1 },
  { kind: 'printer', x: 3.4, y: 0.6 },
  { kind: 'whiteboard', x: 6.8, y: 2.2 },
  { kind: 'serverRack', x: 10.4, y: 1.2 },
  { kind: 'fridge', x: 0.2, y: 6.6 },
  { kind: 'coffeeMachine', x: 1, y: 7.4 },
  // Tucked into the kitchen corner: at 2.4/8.2 it stood exactly where somebody
  // on a coffee break has to stand, and hid them from the chest up.
  { kind: 'waterCooler', x: 0.4, y: 8.2 },
  { kind: 'meetingTable', x: 10.4, y: 6.9 },
  { kind: 'plant', x: 0, y: 3.6 },
  { kind: 'plant', x: 11.2, y: 3 },
  { kind: 'plant', x: 3, y: 8.2 },
  // Glass: the leadership row, then the two walls of the meeting room.
  { kind: 'glassPanel', x: 7.5, y: 1.05, span: 4.6, axis: 'x' },
  { kind: 'glassPanel', x: 9.45, y: 7.1, span: 2.8, axis: 'y' },
  { kind: 'glassPanel', x: 10.45, y: 5.65, span: 2.1, axis: 'x' }
];

/**
 * @param {string} id
 * @returns {{ id: string, x: number, y: number, desk: boolean, zone: string } | null}
 */
export function seatFor(id) {
  return FLOOR_SEATS.find((seat) => seat.id === id) ?? null;
}

/**
 * Where a colleague stands when they walk over to bother you: beside your desk,
 * one step nearer the viewer, so they are drawn after it and never half-buried.
 */
export const VISITOR_TILE = { x: 8, y: 7 };

/** Where you stand on your first day, before anybody has given you a desk. */
export const RECEPTION_TILE = { x: 2, y: 1 };

/**
 * Where set pieces happen (slice 4). Coffee happens by the machine; a battle
 * happens across the aisle between two cubicles, where the floor can watch.
 *
 * Two placement rules, both learned the hard way:
 *
 * 1. **Equal depth** (`x + y` the same for both marks) puts the pair side by
 *    side on screen instead of one eclipsing the other.
 * 2. **Pick a column no seat occupies.** Tiles sharing `x - y` land in the same
 *    screen column, so a mark two tiles of depth from a desk in that column
 *    stacks the standing figure on the seated one's head. No seat sits at
 *    `x - y` of ±1 (the battle marks) or −4/−6 (the coffee marks).
 */
export const COFFEE_TILES = [
  { x: 2, y: 8 },
  { x: 3, y: 7 }
];
export const BATTLE_TILES = [
  { x: 4, y: 5 },
  { x: 5, y: 4 }
];

/** Tiles closer than this to a path count as walking through the furniture. */
const OBSTACLE_RADIUS = 0.55;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Everything a walker should not stroll through: other people's seats and the
 * glass partitions (sampled into points along their span).
 *
 * @param {string} walkerId
 */
function obstaclesFor(walkerId) {
  const blocked = FLOOR_SEATS.filter((seat) => seat.id !== walkerId).map(({ x, y }) => ({ x, y }));
  for (const prop of FLOOR_PROPS) {
    if (prop.kind !== 'glassPanel') continue;
    const span = prop.span ?? 2;
    for (let t = -span / 2; t <= span / 2; t += 0.5) {
      blocked.push(prop.axis === 'y' ? { x: prop.x, y: prop.y + t } : { x: prop.x + t, y: prop.y });
    }
  }
  return blocked;
}

/**
 * How much furniture a path clips, sampled along each leg. Used only to choose
 * between two candidate routes — this is a tie-breaker, not a pathfinder.
 *
 * @param {Array<{x: number, y: number}>} path
 * @param {string} walkerId
 */
export function pathCost(path, walkerId) {
  const blocked = obstaclesFor(walkerId);
  let cost = 0;
  for (let leg = 1; leg < path.length; leg += 1) {
    const from = path[leg - 1];
    const to = path[leg];
    const steps = Math.max(1, Math.ceil(distance(from, to) * 4));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if (blocked.some((b) => distance(point, b) < OBSTACLE_RADIUS)) cost += 1;
    }
  }
  return cost;
}

/**
 * Waypoints for a colleague walking from their desk to yours.
 *
 * Deliberately not a pathfinder: an L-shaped route reads as "down the aisle,
 * then turn", which looks more like an office walk than a diagonal drift across
 * the room. We build both L's (along x first, along y first) and keep whichever
 * clips less furniture. Residual clipping is fine — depth ordering makes a
 * walker passing a desk read as passing *behind* it.
 *
 * @param {string} seatId
 * @param {{x: number, y: number}} [target]
 * @returns {Array<{x: number, y: number}>} at least two points, or [] if unseated
 */
export function walkPathFrom(seatId, target = VISITOR_TILE) {
  const seat = seatFor(seatId);
  if (!seat) return [];
  return walkPathBetween({ x: seat.x, y: seat.y }, target, seatId);
}

/**
 * The same L-route choice between two arbitrary tiles — used when the walker
 * has no desk to start from (you, arriving at reception on your first day).
 *
 * @param {{x: number, y: number}} from
 * @param {{x: number, y: number}} to
 * @param {string} [walkerId] excluded from the obstacle set
 * @returns {Array<{x: number, y: number}>}
 */
export function walkPathBetween(from, to, walkerId = '') {
  const start = { x: from.x, y: from.y };
  const target = { x: to.x, y: to.y };
  const xFirst = [start, { x: target.x, y: start.y }, target];
  const yFirst = [start, { x: start.x, y: target.y }, target];
  const dedupe = (path) =>
    path.filter((p, i) => i === 0 || p.x !== path[i - 1].x || p.y !== path[i - 1].y);
  return pathCost(xFirst, walkerId) <= pathCost(yFirst, walkerId) ? dedupe(xFirst) : dedupe(yFirst);
}

/**
 * Every id with a seat on the floor, player included.
 *
 * @returns {string[]}
 */
export function floorSeatIds() {
  return FLOOR_SEATS.map((seat) => seat.id);
}

/**
 * True when a tile is inside the floor plate. Used by the layout tests to keep
 * a mis-typed coordinate from parking someone in the car park.
 *
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isOnFloor(x, y) {
  return (
    x >= FLOOR_BOUNDS.minX &&
    x <= FLOOR_BOUNDS.maxX &&
    y >= FLOOR_BOUNDS.minY &&
    y <= FLOOR_BOUNDS.maxY
  );
}
