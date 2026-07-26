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

import { useFloorWander } from './useFloorWander.js';
import { awayFromDeskIds } from '../../utils/officeSceneCast.js';
import { YOU_SEAT_ID } from '../../utils/officeFloorPlan.js';

/**
 * @param {{
 *   coffee?: unknown,
 *   battle?: unknown,
 *   meeting?: unknown,
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
 *   floorState: { wanderer: unknown, awayIds: string[] }
 * }} `floorState` is the pair `whereaboutsOf` takes, so its two consumers cannot
 *   be handed different halves.
 */
export function useFloorAway({
  coffee,
  battle,
  meeting,
  standing,
  avoidTile = null,
  holdId = null
}) {
  const awayIds = awayFromDeskIds({
    coffee,
    battle,
    meeting,
    standing,
    playerId: YOU_SEAT_ID
  });

  const { wanderer, handleArrive, figureRef } = useFloorWander({
    suspended: Boolean(meeting),
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
    floorState: { wanderer, awayIds }
  };
}

export default useFloorAway;
