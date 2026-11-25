/**
 * The Machine Room — floor B1 — as pure geometry: where the racks stand, which
 * tiles you can stand on, and how to walk between two of them.
 *
 * The night crew (`NIGHT_SHIFT_CREW`: the scheduled routines and feature
 * automations that change this repo while its owner sleeps) are not people on
 * this floor. They are the machines. One rack per crew member, in night-ladder
 * order, so the room reads left to right in the order the night runs — and its
 * lights come from the same derivation the kanban upstairs draws its notes from
 * (`nightShiftCards`), so the two can never disagree about who shipped.
 *
 * Same tile space and projection as the open plan (`projectIso`, the 12×9
 * plate, the two back walls), for two reasons: the stage scales identically so
 * nothing jumps when the doors open, and the elevator is in the same place
 * because it is the same shaft. Nothing from the open plan's *layout* is used —
 * no seats, peeks or commutes — because nobody else walks down here.
 *
 * Pure on purpose — no React, no DOM.
 */

import { NIGHT_SHIFT_CREW } from '../../utils/nightShiftLedger.js';
import { ELEVATOR_TILE, GRID_H, GRID_W } from '../../utils/officeFloorPlan.js';

/** @typedef {{ x: number, y: number }} Tile */

/**
 * Rack slots, two rows. The back row stands against the north-east wall with
 * its fronts on the aisle; the front row faces the same way, one aisle nearer.
 * There are more slots than crew on purpose: a new automation gets a rack by
 * being added to `NIGHT_SHIFT_CREW`, not by editing this file.
 */
const RACK_SLOTS = Object.freeze([
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 5, y: 1 },
  { x: 6, y: 1 },
  { x: 7, y: 1 },
  { x: 3, y: 5 },
  { x: 4, y: 5 },
  { x: 5, y: 5 },
  { x: 6, y: 5 },
  { x: 7, y: 5 },
  { x: 8, y: 5 }
]);

/**
 * One rack per crew member, in `NIGHT_SHIFT_CREW` (night-ladder) order. A crew
 * beyond the slots goes unracked rather than stacked on another rack.
 *
 * @type {ReadonlyArray<{ id: string, x: number, y: number }>}
 */
export const MACHINE_ROOM_RACKS = Object.freeze(
  NIGHT_SHIFT_CREW.slice(0, RACK_SLOTS.length).map((crew, index) => ({
    id: crew.id,
    ...RACK_SLOTS[index]
  }))
);

/**
 * The rest of the room. `blocks` are the tiles each one makes unstandable.
 *
 * @type {ReadonlyArray<{ kind: 'mainframe' | 'crac' | 'cot', x: number, y: number, blocks: ReadonlyArray<[number, number]> }>}
 */
export const MACHINE_ROOM_PROPS = Object.freeze([
  // The legacy box in the corner. Nobody knows what it does; everybody knows
  // not to unplug it.
  {
    kind: 'mainframe',
    x: 10.4,
    y: 0.8,
    blocks: [
      [10, 0],
      [11, 0],
      [10, 1],
      [11, 1]
    ]
  },
  // Computer-room air conditioning: the loudest thing in the building.
  {
    kind: 'crac',
    x: 10.6,
    y: 6.4,
    blocks: [
      [10, 6],
      [11, 6],
      [10, 7],
      [11, 7]
    ]
  },
  // The on-call cot, from before the routines took the night shift.
  {
    kind: 'cot',
    x: 1.4,
    y: 7.2,
    blocks: [
      [1, 7],
      [2, 7]
    ]
  }
]);

/** The basement's call point is the open plan's: same shaft, same tile. */
export const MACHINE_ROOM_ELEVATOR_TILE = ELEVATOR_TILE;

/**
 * Tiles nobody stands on: every rack, every prop's footprint, and the hot
 * aisle behind the back row (a 45 °C strip of cabling you could only reach by
 * climbing over a rack).
 */
const BLOCKED = new Set([
  ...MACHINE_ROOM_RACKS.map((rack) => `${rack.x},${rack.y}`),
  ...MACHINE_ROOM_PROPS.flatMap((prop) => prop.blocks.map(([x, y]) => `${x},${y}`)),
  ...RACK_SLOTS.filter((slot) => slot.y === 1).map((slot) => `${slot.x},0`)
]);

/**
 * @param {Tile} tile
 * @returns {boolean}
 */
export function isMachineRoomStandable(tile) {
  if (!tile || !Number.isInteger(tile.x) || !Number.isInteger(tile.y)) return false;
  if (tile.x < 0 || tile.y < 0 || tile.x >= GRID_W || tile.y >= GRID_H) return false;
  return !BLOCKED.has(`${tile.x},${tile.y}`);
}

/**
 * Where you stand to read one rack: the tile in front of its lit face (the
 * one facing the viewer's left, toward +y).
 *
 * @param {string} crewId
 * @returns {Tile | null}
 */
export function rackFrontTile(crewId) {
  const rack = MACHINE_ROOM_RACKS.find((entry) => entry.id === crewId);
  if (!rack) return null;
  const front = { x: rack.x, y: rack.y + 1 };
  return isMachineRoomStandable(front) ? front : null;
}

/**
 * Where you stand to look at one of the other things in the room: the first
 * standable tile beside its footprint, viewer side first (+y, then +x), so you
 * end up in front of it rather than behind it.
 *
 * @param {string} kind
 * @returns {Tile | null}
 */
export function propFrontTile(kind) {
  const prop = MACHINE_ROOM_PROPS.find((entry) => entry.kind === kind);
  if (!prop) return null;
  const sides = [
    [0, 1],
    [1, 0],
    [-1, 0],
    [0, -1]
  ];
  for (const [dx, dy] of sides) {
    for (const [x, y] of prop.blocks) {
      const tile = { x: x + dx, y: y + dy };
      if (isMachineRoomStandable(tile)) return tile;
    }
  }
  return null;
}

/**
 * The nearest standable tile to a fractional point — a click on the floor, or
 * where an interrupted walk had got to.
 *
 * @param {Tile} point
 * @returns {Tile | null}
 */
export function nearestStandable(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const rounded = { x: Math.round(point.x), y: Math.round(point.y) };
  if (isMachineRoomStandable(rounded)) return rounded;
  return null;
}

const STEPS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
]);

/**
 * Collapse a tile-by-tile route into its corners, so each walk leg is a
 * straight run (what `useWalkAnimation` animates one leg at a time).
 *
 * @param {Tile[]} tiles
 * @returns {Tile[]}
 */
function corners(tiles) {
  if (tiles.length <= 2) return tiles;
  const out = [tiles[0]];
  for (let i = 1; i < tiles.length - 1; i += 1) {
    const prev = tiles[i - 1];
    const next = tiles[i + 1];
    const straight =
      (prev.x === tiles[i].x && tiles[i].x === next.x) ||
      (prev.y === tiles[i].y && tiles[i].y === next.y);
    if (!straight) out.push(tiles[i]);
  }
  out.push(tiles[tiles.length - 1]);
  return out;
}

/** @param {Tile} tile */
function tileKey(tile) {
  return `${tile.x},${tile.y}`;
}

/**
 * Breadth-first search from `from` until `to` is reached (or the room runs
 * out): each reached tile mapped to the tile it was reached from.
 *
 * @param {Tile} from
 * @param {Tile} to
 * @returns {Map<string, Tile | null>}
 */
function breadthFirst(from, to) {
  const came = new Map([[tileKey(from), null]]);
  const queue = [from];
  while (queue.length) {
    const here = queue.shift();
    if (here.x === to.x && here.y === to.y) break;
    for (const [dx, dy] of STEPS) {
      const next = { x: here.x + dx, y: here.y + dy };
      if (came.has(tileKey(next)) || !isMachineRoomStandable(next)) continue;
      came.set(tileKey(next), here);
      queue.push(next);
    }
  }
  return came;
}

/**
 * A walk between two standable tiles that goes round the racks, as a list of
 * corners starting at `from`. Breadth-first on a 12×9 grid — a hundred tiles,
 * so there is nothing to optimize. `[from]` when there is no route (or no
 * move), which `useWalkAnimation` reads as standing still.
 *
 * @param {Tile} from
 * @param {Tile} to
 * @returns {Tile[]}
 */
export function machineRoomPath(from, to) {
  if (!isMachineRoomStandable(from) || !isMachineRoomStandable(to)) return [from];
  if (from.x === to.x && from.y === to.y) return [from];
  const came = breadthFirst(from, to);
  if (!came.has(tileKey(to))) return [from];
  const route = [];
  for (let at = to; at; at = came.get(tileKey(at))) route.unshift(at);
  return corners(route);
}
