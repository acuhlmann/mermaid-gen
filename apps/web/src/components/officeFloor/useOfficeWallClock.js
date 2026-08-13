/**
 * The wall clock's hands, as values the floor can render
 * (docs/office-isometric-mode.md § 5 slice 25).
 *
 * The impure half of the wall clock, in the same shape as `useOfficeDayPhase`:
 * `officeWallClockAt` is the whole decision and it is pure; this is only the
 * part that cannot be — reading the time and noticing when the minute rolls
 * over. The two hooks read the *same* instant the office day does, so the hands
 * and the window light can never disagree about the hour (one clock, two faces).
 *
 * **It re-renders only when the hands actually move.** `setState` with an equal
 * value is a no-op React bails out of, so a poll that lands mid-minute repaints
 * nothing — the steady-state cost is one `Date` read every half-minute, and the
 * hands redraw once a minute. That is the licence for polling at all on a
 * surface that draws sixteen animated figures: the clock is a fact about the
 * wall, not office state, so nothing is written anywhere (ADR-0011 rule 1) and
 * it dies with the floor.
 */

import { useEffect, useState } from 'react';
import { OFFICE_WALL_CLOCK_POLL_MS, officeWallClockAt } from '../../utils/officeCadence.js';

/**
 * @param {{ now?: () => number, pollMs?: number }} [options] `now` is the seam
 *   the tests drive the hands through — production never passes it.
 * @returns {{ hour: number, minute: number, hourDeg: number, minuteDeg: number }}
 */
export function useOfficeWallClock({ now = Date.now, pollMs = OFFICE_WALL_CLOCK_POLL_MS } = {}) {
  const [hands, setHands] = useState(() => officeWallClockAt(now()));

  useEffect(() => {
    /*
     * Read immediately as well as on the interval, exactly like the phase
     * dial: a floor mounted just past the minute should not show the previous
     * one until the first tick. The functional set compares values and keeps
     * the old object — returning the *same* reference is what bails React out
     * of the repaint; an equal-but-new object would re-render the floor once
     * a poll instead of once a minute.
     */
    const read = () => {
      const next = officeWallClockAt(now());
      setHands((current) =>
        current.hourDeg === next.hourDeg && current.minuteDeg === next.minuteDeg ? current : next
      );
    };
    read();
    const id = setInterval(read, pollMs);
    return () => clearInterval(id);
  }, [now, pollMs]);

  return hands;
}

export default useOfficeWallClock;
