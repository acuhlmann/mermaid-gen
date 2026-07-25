/**
 * Walker lifecycle for isometric mode.
 *
 * The office store holds one truth — `walkBy` is either happening or it isn't.
 * A floor walker needs one beat more than that: when the moment clears (you
 * dismissed it, or the TTL expired) the colleague should walk *back* to their
 * desk rather than vanish mid-sentence. That departing copy is presentation
 * state, the same way a CSS exit transition is, and it never feeds back into
 * office state — no floor-only truth (ADR-0011).
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @param {{ id: string, colleagueId: string } | null | undefined} walkBy
 * @returns {{
 *   walker: { id: string, colleagueId: string } | null,
 *   departing: boolean,
 *   handleDeparted: () => void
 * }}
 */
export function useFloorWalker(walkBy) {
  const [leaving, setLeaving] = useState(/** @type {any} */ (null));
  const lastRef = useRef(/** @type {any} */ (null));

  useEffect(() => {
    if (walkBy) {
      lastRef.current = walkBy;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: syncing presentation state to an external store's transition; there is no render-time signal that a moment just ended)
      setLeaving(null);
      return;
    }
    if (lastRef.current) {
      setLeaving(lastRef.current);
      lastRef.current = null;
    }
  }, [walkBy]);

  return {
    walker: walkBy ?? leaving,
    departing: !walkBy && Boolean(leaving),
    handleDeparted: () => setLeaving(null)
  };
}
