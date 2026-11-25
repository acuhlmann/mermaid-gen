/**
 * Where in the building you are, and what the elevator is doing.
 *
 * View state for the isometric floor, like `officeViewModeStore`: it says which
 * floor's stage is on screen and nothing about the office itself. No office
 * moment reads it and nothing here starts one — a walk-by that arrives while
 * you are in the basement happens upstairs without you, the same as it would
 * if you had gone to make a coffee. The one thing that crosses the other way
 * is `returnToHomeFloor`, which the floor calls when something you said yes to
 * (a glass-room meeting, a coffee break) needs you upstairs.
 *
 * A call has three steps and only the first is a press:
 *
 *     callElevator ──you reach the doors──▸ openElevatorDoors ──pick a floor──▸ rideElevatorTo
 *
 * Whoever draws you on the current floor answers the call by walking you to
 * the doors and calling `openElevatorDoors` on arrival, so the press is the
 * same button on every floor and the walk belongs to the floor that knows its
 * own geometry.
 *
 * Not persisted. Standing up from your desk puts you at your desk, which is on
 * the open-plan floor; the floor resets this when it unmounts.
 */

import { HOME_FLOOR, isBuildingFloor } from './officeBuilding.js';

/**
 * @typedef {{
 *   floor: import('./officeBuilding.js').FloorId,
 *   call: { floor: string, key: number } | null,
 *   doorsOpen: boolean,
 *   ride: { from: string, to: string, phase: 'closing' | 'moving' | 'opening', key: number } | null,
 *   reading: { kind: 'rack' | 'prop', id: string } | null
 * }} BuildingSnapshot
 *   `reading` is the thing on this floor you walked up to and are looking at —
 *   held here rather than in the floor's stage because the card slot, which
 *   is outside the stage, is where its words go.
 */

/** @type {BuildingSnapshot} */
const INITIAL = Object.freeze({
  floor: HOME_FLOOR,
  call: null,
  doorsOpen: false,
  ride: null,
  reading: null
});

/** @type {BuildingSnapshot} */
let snapshot = INITIAL;
let keys = 0;

const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch (err) {
      console.warn('officeBuildingStore: listener threw:', err?.message ?? err);
    }
  }
}

/** @param {Partial<BuildingSnapshot>} patch */
function set(patch) {
  snapshot = { ...snapshot, ...patch };
  emit();
}

/** @param {() => void} listener */
export function subscribeBuilding(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {BuildingSnapshot} */
export function getBuildingSnapshot() {
  return snapshot;
}

/**
 * Whether the floor's card slot belongs to the elevator: a call in progress,
 * doors open, a ride, or simply being somewhere other than the open plan
 * (whose own cards are all about the cast, who are upstairs).
 *
 * @param {BuildingSnapshot} [building]
 */
export function isElevatorCardShown(building = snapshot) {
  return Boolean(
    building.floor !== HOME_FLOOR || building.call || building.doorsOpen || building.ride
  );
}

/**
 * Press the call button. Ignored mid-ride — the car is busy — and while the
 * doors are already open for you.
 */
export function callElevator() {
  if (snapshot.ride || snapshot.doorsOpen) return;
  keys += 1;
  set({ call: { floor: snapshot.floor, key: keys }, reading: null });
}

/** You reached the doors: they open, and the panel is yours to press. */
export function openElevatorDoors() {
  if (!snapshot.call || snapshot.ride) return;
  set({ call: null, doorsOpen: true });
}

/** You walked off, or pressed close. A cancelled call is the same thing. */
export function closeElevatorDoors() {
  if (!snapshot.call && !snapshot.doorsOpen) return;
  set({ call: null, doorsOpen: false });
}

/**
 * Pick a floor. Only from inside the car (doors open), only somewhere real and
 * somewhere else — which buttons are pressable is `elevatorButtonsFor`'s
 * question; this only refuses what no button could have asked for.
 *
 * @param {string} to
 * @returns {boolean} whether the car set off
 */
export function rideElevatorTo(to) {
  if (!snapshot.doorsOpen || snapshot.ride) return false;
  if (!isBuildingFloor(to) || to === snapshot.floor) return false;
  keys += 1;
  set({
    doorsOpen: false,
    reading: null,
    ride: { from: snapshot.floor, to, phase: 'closing', key: keys }
  });
  return true;
}

/**
 * The next beat of the ride. The floor changes between `moving` and
 * `opening`, so the new floor's stage mounts behind doors that are still shut.
 */
export function advanceElevatorRide() {
  const { ride } = snapshot;
  if (!ride) return;
  if (ride.phase === 'closing') {
    set({ ride: { ...ride, phase: 'moving' } });
    return;
  }
  if (ride.phase === 'moving') {
    set({ floor: /** @type {any} */ (ride.to), ride: { ...ride, phase: 'opening' } });
    return;
  }
  set({ ride: null });
}

/**
 * You arrived at something on this floor (or walked away from it: `null`).
 *
 * @param {{ kind: 'rack' | 'prop', id: string } | null} target
 */
export function setBuildingReading(target) {
  const next = target ? { kind: target.kind, id: target.id } : null;
  const current = snapshot.reading;
  if (current?.kind === next?.kind && current?.id === next?.id) return;
  set({ reading: next });
}

/**
 * Straight back to the open plan, no ride: something you agreed to needs you
 * there, or the floor is going away. A no-op when you are already there and
 * nothing is in flight, so callers need not check first.
 */
export function returnToHomeFloor() {
  if (snapshot === INITIAL) return;
  if (
    snapshot.floor === HOME_FLOOR &&
    !snapshot.call &&
    !snapshot.doorsOpen &&
    !snapshot.ride &&
    !snapshot.reading
  ) {
    return;
  }
  snapshot = INITIAL;
  emit();
}

export function resetBuildingForTests() {
  snapshot = INITIAL;
  keys = 0;
  listeners.clear();
}
