/**
 * The building the office sits in: which floors exist, which ones the elevator
 * will take you to, and how long a ride takes.
 *
 * Until this module the office was one floor plate (`officeFloorPlan.js`). It
 * still is — that plan is untouched and stays the open-plan floor's single
 * source of truth. A further floor is **its own plan module and its own
 * stage**, rendered in place of the open plan while you are on it, rather than
 * a parameter threaded through every consumer of the open plan's constants
 * (seats, peeks, commutes, the camera, bubbles). Those consumers are about the
 * cast, and the cast lives upstairs; a floor nobody else walks needs none of
 * them. The Machine Room (`machineRoomPlan.js`) is the first such floor.
 *
 * Pure on purpose — no React, no DOM — so which buttons light up is a unit
 * test rather than a screenshot.
 */

/** @typedef {'basement' | 'office' | 'leadership'} FloorId */

/**
 * Every floor the elevator panel lists, bottom to top. `rideable: false` is a
 * button that lights up but goes nowhere yet (see `elevatorButtonsFor`).
 *
 * @type {ReadonlyArray<{ id: FloorId, button: string, rideable: boolean, minLevel?: number }>}
 */
export const BUILDING_FLOORS = Object.freeze([
  { id: 'basement', button: 'B1', rideable: true },
  // The open plan's own top bar has always said FLOOR 3.
  { id: 'office', button: '3', rideable: true },
  // Upstairs is where the senior emails come from and where Barker "stays".
  // Lvl 10 is Chief Slopitect Officer — the first title with Chief in it.
  { id: 'leadership', button: '4', rideable: false, minLevel: 10 }
]);

/** The floor you are on when you stand up from your desk. */
export const HOME_FLOOR = 'office';

/**
 * A ride, in phases. The doors close, the car moves, the doors open on the new
 * floor. View-state timings for one transition you asked for — nothing here
 * schedules anything on its own (ADR-0010 consequence #4).
 */
export const ELEVATOR_RIDE_MS = Object.freeze({ closing: 520, moving: 1100, opening: 520 });

/** Reduced motion: the same three beats, short enough to read as a cut. */
export const ELEVATOR_RIDE_REDUCED_MS = Object.freeze({ closing: 60, moving: 240, opening: 60 });

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isBuildingFloor(id) {
  return BUILDING_FLOORS.some((floor) => floor.id === id);
}

/**
 * @param {string} id
 * @returns {string} the label on the elevator button and the indicator above the doors
 */
export function floorButtonLabel(id) {
  return BUILDING_FLOORS.find((floor) => floor.id === id)?.button ?? '?';
}

/**
 * The buttons on the elevator panel, top floor first (the way a panel reads).
 *
 * - `current` — you are on it; pressing it does nothing.
 * - `go` — the car will take you there.
 * - `locked` — your HR level is below the floor's `minLevel`.
 * - `fitOut` — you have the level, but the floor is not built yet. Facilities
 *   says next quarter. It is the honest state of a floor that has no plan
 *   module, and the joke is that it is also the honest state of most offices.
 *
 * @param {{ current: string, level?: number }} at
 * @returns {Array<{ id: FloorId, button: string, state: 'current' | 'go' | 'locked' | 'fitOut', minLevel?: number }>}
 */
export function elevatorButtonsFor({ current, level = 1 }) {
  return [...BUILDING_FLOORS].reverse().map((floor) => {
    const base = { id: floor.id, button: floor.button, minLevel: floor.minLevel };
    if (floor.id === current) return { ...base, state: 'current' };
    if (floor.minLevel && level < floor.minLevel) return { ...base, state: 'locked' };
    if (!floor.rideable) return { ...base, state: 'fitOut' };
    return { ...base, state: 'go' };
  });
}

/**
 * Which way the car is going, for the arrow above the doors.
 *
 * @param {string} from
 * @param {string} to
 * @returns {'up' | 'down' | null}
 */
export function rideDirection(from, to) {
  const ids = BUILDING_FLOORS.map((floor) => floor.id);
  const a = ids.indexOf(from);
  const b = ids.indexOf(to);
  if (a < 0 || b < 0 || a === b) return null;
  return b > a ? 'up' : 'down';
}
