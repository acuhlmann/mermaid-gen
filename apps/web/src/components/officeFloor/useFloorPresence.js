/**
 * Where you are on the floor when you are not in your chair
 * (docs/office-isometric-mode.md § 5 slice 7).
 *
 * **This produces nothing**, and that is what licenses it. ADR-0011's rule 1
 * binds office *state*; walking around fires no moment, writes to no store, and
 * dies the instant you sit down — the same standing this hook's ancestor
 * `usePeek` had, and the reason desk peeking was allowed to be floor-only.
 *
 * One body, two reasons to be out of your chair. A peek used to render its own
 * `FloorPlayer` starting from your desk; once you could already be standing
 * somewhere else that would have teleported you home before every walk. So a
 * peek is now a destination with an `intent` attached rather than a separate
 * actor, and there is exactly one of you on the floor at any moment.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { liveTileOf } from './useWalkAnimation.js';
import { YOU_SEAT_ID, seatFor } from '../../utils/officeFloorPlan.js';

/**
 * Where a new walk starts. Interrupting one mid-stride has to begin from the
 * tile you had actually reached, or the new `walkKey` re-places you at the old
 * walk's origin and you snap backwards across the room.
 */
function originOf(current, el) {
  if (!current) {
    const home = seatFor(YOU_SEAT_ID);
    return home ? { x: home.x, y: home.y } : { x: 0, y: 0 };
  }
  if (current.phase === 'standing') return current.to;
  return liveTileOf(el) ?? current.to;
}

/**
 * @typedef {{ kind: 'peek' | 'talk', colleagueId: string }} FloorIntent
 *   Why you walked somewhere. A destination with a reason attached, rather
 *   than a state machine per reason — which is what keeps there being exactly
 *   one of you on the floor.
 */

/**
 * @typedef {{
 *   from: { x: number, y: number },
 *   to: { x: number, y: number },
 *   phase: 'walking' | 'standing',
 *   key: number,
 *   intent: FloorIntent | null,
 *   homeward: boolean
 * }} FloorPresence
 */

/**
 * @param {boolean} suspended a meeting puts you in a chair in the glass room;
 *   two of you on the floor at once gives the game away.
 * @returns {{
 *   presence: FloorPresence | null,
 *   playerRef: { current: HTMLElement | null },
 *   walkTo: (tile: { x: number, y: number }) => void,
 *   peekAt: (colleagueId: string, tile: { x: number, y: number }) => void,
 *   talkTo: (colleagueId: string, tile: { x: number, y: number }) => void,
 *   goHome: () => void,
 *   handleArrive: () => void
 * }} `presence` is `null` when you are at your own desk.
 */
export function useFloorPresence(suspended) {
  const [presence, setPresence] = useState(null);
  const playerRef = useRef(null);
  const walks = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: synchronising to a surface that takes the room away from us; deriving it instead would strand stale presence behind, so you would reappear mid-floor when the meeting ended)
    if (suspended) setPresence(null);
  }, [suspended]);

  const startWalk = useCallback((to, intent, homeward) => {
    setPresence((current) => {
      walks.current += 1;
      return {
        from: originOf(current, playerRef.current),
        to,
        phase: 'walking',
        // Every walk gets its own key, so clicking the tile you are already
        // walking to still restarts the journey rather than silently no-oping.
        key: walks.current,
        intent,
        homeward
      };
    });
  }, []);

  const walkTo = useCallback((tile) => startWalk(tile, null, false), [startWalk]);

  const peekAt = useCallback(
    (colleagueId, tile) => startWalk(tile, { kind: 'peek', colleagueId }, false),
    [startWalk]
  );

  const talkTo = useCallback(
    (colleagueId, tile) => startWalk(tile, { kind: 'talk', colleagueId }, false),
    [startWalk]
  );

  const goHome = useCallback(() => {
    const home = seatFor(YOU_SEAT_ID);
    if (!home) return;
    startWalk({ x: home.x, y: home.y }, null, true);
  }, [startWalk]);

  /*
   * Phase-driven rather than closure-driven: `useWalkAnimation` keeps the
   * callback it was mounted with for the duration of a walk.
   */
  const handleArrive = useCallback(() => {
    setPresence((current) => {
      if (!current || current.phase !== 'walking') return current;
      if (current.homeward) return null;
      return { ...current, phase: 'standing' };
    });
  }, []);

  return {
    presence: suspended ? null : presence,
    playerRef,
    walkTo,
    peekAt,
    talkTo,
    goHome,
    handleArrive
  };
}

export default useFloorPresence;
