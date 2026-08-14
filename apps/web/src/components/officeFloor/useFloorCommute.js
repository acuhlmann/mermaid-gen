/**
 * The commute, as React state (§ 5 slice 17).
 *
 * Thin on purpose: the whole state machine is pure in
 * `utils/officeFloorCommute.js`, and this holds the list, fires the transition
 * when the moments change, and hands the three answers its consumers need.
 *
 * It lives beside `useFloorAway` rather than inside it because they answer
 * neighbouring questions and only one of them is allowed to be stateful —
 * "who is out of their chair" is derived from the store every render, while
 * "who is still walking back" is a beat the room owes after the store has moved
 * on. `useFloorAway` composes the two so its callers never see the seam.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { arriveCommute, marksKey, nextCommutes } from '../../utils/officeFloorCommute.js';

/**
 * @param {Array<{ id: string, tile: { x: number, y: number }, hands: string | null }>} marks
 * @returns {{
 *   commuters: import('../../utils/officeFloorCommute.js').Commute[],
 *   settledIds: Set<string>,
 *   walkingIds: Set<string>,
 *   commutingIds: string[],
 *   handleCommuteArrive: (id: string) => void
 * }} `commuters` are the ones on their feet (`out` / `home`) — the only ones
 *   `FloorCommuters` draws. `settledIds` are the ones a surface may now draw at
 *   their mark. `commutingIds` is everybody in any phase, which is what keeps a
 *   desk empty until its owner is genuinely back in it.
 *
 *   `walkingIds` is `settledIds` asked the other way round, and slice 27 is why
 *   it has to exist. A surface whose whole cast commutes can gate on "has
 *   arrived": absent from `settledIds` means still walking. The glass room's
 *   cast does **not** all commute — the leadership tier is sealed in its own
 *   fishbowl and has no route to a threshold — so the same test would erase
 *   every executive from the meeting. Asking "is this person mid-walk" is the
 *   question that stays correct when only some of the cast ever set off.
 */
export function useFloorCommute(marks) {
  const [commutes, setCommutes] = useState(
    /** @type {import('../../utils/officeFloorCommute.js').Commute[]} */ ([])
  );

  /* Read through a ref so the effect below depends on *what the moments want*
     (`marksKey`) rather than on the array literal a render happened to build —
     the same reason `useOfficeRunReactions` keeps its params in a ref. */
  const marksRef = useRef(marks);
  marksRef.current = marks;

  /* The first pass seeds straight to `there`: standing up into a coffee break
     that is already running should show two people at the machine, not two
     people setting off for it after the fact. */
  const seededRef = useRef(false);

  const key = marksKey(marks);

  useEffect(() => {
    const seed = !seededRef.current;
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: syncing presentation state to an external store's transition, exactly as useFloorWalker does; there is no render-time signal that a moment just ended)
    setCommutes((prev) => nextCommutes(prev, marksRef.current, { seed }));
  }, [key]);

  const handleCommuteArrive = useCallback((id) => {
    setCommutes((prev) => arriveCommute(prev, id));
  }, []);

  return useMemo(
    () => ({
      commuters: commutes.filter((commute) => commute.phase !== 'there'),
      settledIds: new Set(
        commutes.filter((commute) => commute.phase === 'there').map((commute) => commute.id)
      ),
      walkingIds: new Set(
        commutes.filter((commute) => commute.phase !== 'there').map((commute) => commute.id)
      ),
      commutingIds: commutes.map((commute) => commute.id),
      handleCommuteArrive
    }),
    [commutes, handleCommuteArrive]
  );
}

export default useFloorCommute;
