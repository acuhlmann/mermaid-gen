/**
 * Who is out of their chair, and who gets up next.
 *
 * Two questions that have to be answered together, which is why they are one
 * hook. `awayFromDeskIds` covers whoever a **moment** has — a set piece, the
 * glass room, you on your feet — and `useFloorWander` covers whoever got up on
 * their own. The stage empties a desk for either reason, and ambience must never
 * pick somebody a moment is already drawing (§ 6 rule 5 does not allow two of
 * anybody), so the second reads the first.
 *
 * Extracted from `OfficeFloorView` when slice 12 gave the pairing a third
 * consumer: `whereaboutsOf` needs both halves to say where a colleague is, and
 * the view component had earned its way off § 8's size list in slice 11 and
 * should stay off it.
 */

import { useMemo } from 'react';
import { useFloorCommute } from './useFloorCommute.js';
import { useFloorWander } from './useFloorWander.js';
import { awayFromDeskIds } from '../../utils/officeSceneCast.js';
import { momentMarksFor } from '../../utils/officeFloorCommute.js';
import { YOU_SEAT_ID } from '../../utils/officeFloorPlan.js';

/**
 * @param {{
 *   coffee?: unknown,
 *   battle?: unknown,
 *   meeting?: unknown,
 *   huddle?: unknown,
 *   standing?: unknown,
 *   avoidTile?: { x: number, y: number } | null,
 *   holdId?: string | null
 * }} state `standing` is your presence — truthy whenever you are on your feet.
 *   `avoidTile` is where you are or are heading; `holdId` is whoever you have
 *   engaged, who then stays put until you are done with them.
 * @returns {{
 *   awayIds: string[],
 *   wanderer: unknown,
 *   handleWanderArrive: () => void,
 *   wandererRef: { current: HTMLElement | null },
 *   commuters: import('../../utils/officeFloorCommute.js').Commute[],
 *   settledIds: Set<string>,
 *   walkingIds: Set<string>,
 *   handleCommuteArrive: (id: string) => void,
 *   floorState: { wanderer: unknown, awayIds: string[] }
 * }} `floorState` is the pair `whereaboutsOf` takes, so its two consumers cannot
 *   be handed different halves. `settledIds` is what lets a surface draw its own
 *   actor: until somebody has walked to their mark they are a commuter, and two
 *   of anybody is § 6 rule 5. `walkingIds` is the same fact for a surface whose
 *   cast does not all commute — see `useFloorCommute`.
 */
export function useFloorAway({
  coffee,
  battle,
  meeting,
  huddle,
  standing,
  avoidTile = null,
  holdId = null
}) {
  const momentAwayIds = awayFromDeskIds({
    coffee,
    battle,
    meeting,
    huddle,
    standing,
    playerId: YOU_SEAT_ID
  });

  /*
   * Slice 17: getting there and getting back takes time, and the desk has to
   * stay empty for all of it. `awayFromDeskIds` empties a chair the instant the
   * store claims somebody and refills it the instant the store lets go — which
   * is why a scene used to end with two people blinking back into their seats
   * while their own figures were still standing at the machine.
   */
  const marks = useMemo(
    // Slice 27: the glass room joins the commute. Its attendees walk to a
    // threshold outside the sealed box and the room cuts them into their
    // chairs, so the marks this returns are doorways rather than seats.
    () => momentMarksFor({ coffee, battle, huddle, meeting }),
    [coffee, battle, huddle, meeting]
  );
  const { commuters, settledIds, walkingIds, commutingIds, handleCommuteArrive } =
    useFloorCommute(marks);

  /* Whoever is mid-commute is out of their chair for the same reason everybody
     else in this list is, so the three sources merge before anyone sees them.
     Memoized on *content* rather than identity: both inputs are fresh arrays
     every render, and `useFloorWander` keys its cadence off `busyIds`. The keys
     are hoisted because a dependency list may only hold simple expressions. */
  const momentAwayKey = momentAwayIds.join('|');
  const commutingKey = commutingIds.join('|');
  const awayIds = useMemo(
    () => [...new Set([...momentAwayIds, ...commutingIds])],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: the two `…Key` strings above are the content of the two arrays; depending on the arrays themselves would rebuild this every render)
    [momentAwayKey, commutingKey]
  );

  const { wanderer, handleArrive, figureRef } = useFloorWander({
    suspended: Boolean((meeting && meeting.modality !== 'remote') || huddle),
    busyIds: awayIds,
    avoidTile,
    holdId
  });

  return {
    // § 6 rule 5: the desk stays, its owner doesn't — and somebody who has
    // wandered off is away for exactly the same reason somebody in a coffee
    // scene is, so the stage is handed one list.
    awayIds: wanderer ? [...awayIds, wanderer.seatId] : awayIds,
    wanderer,
    handleWanderArrive: handleArrive,
    wandererRef: figureRef,
    commuters,
    settledIds,
    walkingIds,
    handleCommuteArrive,
    floorState: { wanderer, awayIds }
  };
}

export default useFloorAway;
