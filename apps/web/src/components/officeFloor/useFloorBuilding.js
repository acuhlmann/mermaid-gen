/**
 * The open plan's half of the building (`features/building/`): answering the
 * elevator when it is called from this floor, running the ride, and bringing
 * you back up when something you said yes to needs you here.
 *
 * Extracted rather than inlined in `OfficeFloor` because that view is already
 * well past its complexity budget, and because everything here is about the
 * building rather than the office — the cast never reads it.
 *
 * Three rules worth keeping:
 *
 * 1. **The call is answered with the open plan's own walk.** `walkTo` is free
 *    roam's verb, so the walk to the doors is the same walk as any other and
 *    clicking somewhere else on the way cancels it, exactly as it would cancel
 *    a walk to the printer.
 * 2. **Upstairs wins.** A glass-room meeting, a huddle at your desk, or a set
 *    piece you accepted all need you on this floor, so any of them returns you
 *    here with no ride. That reacts to something you agreed to; it never starts
 *    anything (ADR-0010 consequence #4).
 * 3. **Nothing outlives the floor.** Sitting down unmounts the floor, and the
 *    building resets with it — standing up again puts you at your desk.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './useWalkAnimation.js';
import { BUILDING_COPY } from '../../features/building/buildingCopy.js';
import {
  ELEVATOR_RIDE_MS,
  ELEVATOR_RIDE_REDUCED_MS,
  HOME_FLOOR
} from '../../features/building/officeBuilding.js';
import {
  advanceElevatorRide,
  closeElevatorDoors,
  getBuildingSnapshot,
  isElevatorCardShown,
  openElevatorDoors,
  returnToHomeFloor,
  subscribeBuilding
} from '../../features/building/officeBuildingStore.js';
import { ELEVATOR_TILE } from '../../utils/officeFloorPlan.js';

function atElevator(presence) {
  return Boolean(
    presence && presence.to.x === ELEVATOR_TILE.x && presence.to.y === ELEVATOR_TILE.y
  );
}

/**
 * Something you agreed to is happening on the open plan.
 *
 * @param {{ physicalMeeting?: boolean, huddle?: unknown, coffee?: { accepted?: boolean } | null, battle?: { accepted?: boolean } | null }} by
 */
export function isSummoned({ physicalMeeting, huddle, coffee, battle } = {}) {
  return Boolean(physicalMeeting || huddle || coffee?.accepted || battle?.accepted);
}

/** Arrow keys and Escape do nothing to the open plan while you are not on it. */
const OFF_FLOOR_KEYBOARD = Object.freeze({ origin: null });
const ON_FLOOR_KEYBOARD = Object.freeze({});

/**
 * Walk to the doors when the call was made up here, open them when you get
 * there, and let the car go if you walk off.
 */
function useAnswerCall(building, presence, walkTo, onFloorCue) {
  const answered = useRef(0);
  /** The walk that is taking you to the doors, once it has started. */
  const walkKey = useRef(null);
  const call = building.floor === HOME_FLOOR ? building.call : null;

  useEffect(() => {
    if (!call || answered.current === call.key) return;
    answered.current = call.key;
    walkKey.current = null;
    if (atElevator(presence) && presence.phase === 'standing') {
      openElevatorDoors();
      onFloorCue?.('elevator');
      return;
    }
    walkTo(ELEVATOR_TILE);
  }, [call, presence, walkTo, onFloorCue]);

  useEffect(() => {
    if (!call || !presence) return;
    if (!atElevator(presence)) {
      // Started towards the doors and then went somewhere else: cancelled.
      if (walkKey.current !== null) closeElevatorDoors();
      return;
    }
    walkKey.current = presence.key;
    if (presence.phase === 'standing') {
      openElevatorDoors();
      onFloorCue?.('elevator');
    }
  }, [call, presence, onFloorCue]);

  // Doors open and you walked away from them.
  const doorsOpenHere = building.floor === HOME_FLOOR && building.doorsOpen;
  useEffect(() => {
    if (doorsOpenHere && !atElevator(presence)) closeElevatorDoors();
  }, [doorsOpenHere, presence]);
}

/** Step the ride along: doors close, car moves, doors open on the new floor. */
function useRide(ride, onFloorCue) {
  useEffect(() => {
    if (!ride) return undefined;
    if (ride.phase === 'opening') onFloorCue?.('elevator');
    const beats = prefersReducedMotion() ? ELEVATOR_RIDE_REDUCED_MS : ELEVATOR_RIDE_MS;
    const id = setTimeout(advanceElevatorRide, beats[ride.phase]);
    return () => clearTimeout(id);
  }, [ride, onFloorCue]);
}

/**
 * @param {{
 *   presence: import('./useFloorPresence.js').FloorPresence | null,
 *   walkTo: (tile: { x: number, y: number }) => void,
 *   goHome: () => void,
 *   summonedBy: { physicalMeeting?: boolean, huddle?: unknown, coffee?: { accepted?: boolean } | null, battle?: { accepted?: boolean } | null },
 *   onFloorCue?: (cue: string, options?: object) => void
 * }} options `summonedBy` is what can need you on the open plan: a glass-room
 *   meeting, a huddle at your desk, a set piece you accepted.
 * @returns {{
 *   floor: import('../../features/building/officeBuilding.js').FloorId,
 *   onOpenPlan: boolean,
 *   showCard: boolean,
 *   goHome: () => void,
 *   topBarCopy: (copy: Record<string, any>) => Record<string, any>,
 *   keyboard: { origin?: null }
 * }} `goHome` is the open plan's, with a ride back up first when you are
 *   downstairs; `keyboard` overrides `useFloorKeyboard`'s inputs off this floor.
 */
export function useFloorBuilding({ presence, walkTo, goHome, summonedBy, onFloorCue }) {
  const building = useSyncExternalStore(
    subscribeBuilding,
    getBuildingSnapshot,
    getBuildingSnapshot
  );
  const onOpenPlan = building.floor === HOME_FLOOR;

  useAnswerCall(building, presence, walkTo, onFloorCue);
  useRide(building.ride, onFloorCue);

  const summoned = isSummoned(summonedBy);
  useEffect(() => {
    if (summoned) returnToHomeFloor();
  }, [summoned]);

  useEffect(() => () => returnToHomeFloor(), []);

  const goHomeFromAnywhere = useCallback(() => {
    returnToHomeFloor();
    goHome();
  }, [goHome]);

  return {
    floor: building.floor,
    onOpenPlan,
    showCard: isElevatorCardShown(building),
    goHome: goHomeFromAnywhere,
    topBarCopy: (/** @type {Record<string, any>} */ copy) =>
      onOpenPlan ? copy : { ...copy, ...BUILDING_COPY.basementTopBar },
    keyboard: onOpenPlan ? ON_FLOOR_KEYBOARD : OFF_FLOOR_KEYBOARD
  };
}

export default useFloorBuilding;
