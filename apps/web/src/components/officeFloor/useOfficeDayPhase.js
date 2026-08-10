/**
 * What time the office thinks it is, as a value the floor can render
 * (docs/office-isometric-mode.md § 5 slice 20).
 *
 * `officeDayPhaseAt` is the whole decision and it is pure; this is only the
 * part that cannot be — reading a clock, and noticing when the answer changes.
 * The split is the same one `officeCadence.js` draws for every other cadence
 * question: the brain takes an instant and returns a verdict, the hook ticks.
 *
 * **It re-renders only on a change**, which is what makes a poll acceptable on
 * a surface that draws sixteen animated figures, a walk animation and a
 * directed camera. `setState` to the same string is a no-op React bails out of,
 * so the steady-state cost of the office day is one `Date.getHours()` a minute
 * and zero repaints. That is deliberately the opposite trade from slice 16's
 * board, which is *sampled on edges* because its input (your diagram) changes
 * on every keystroke — this input changes four times a day, so a slow poll is
 * both simpler and more honest than inventing edges for it.
 *
 * Nothing is written anywhere (ADR-0011 rule 1). The office day is a fact about
 * the wall clock, not office state, so it is derived wherever it is needed and
 * dies with the floor.
 */

import { useEffect, useState } from 'react';
import { officeDayPhaseAt, OFFICE_DAY_PHASE_POLL_MS } from '../../utils/officeCadence.js';

/**
 * @param {{ now?: () => number, pollMs?: number }} [options] `now` is the seam
 *   the tests drive the day through — production never passes it.
 * @returns {'earlyMorning'|'standUp'|'midday'|'windDown'|'afterHours'}
 */
export function useOfficeDayPhase({ now = Date.now, pollMs = OFFICE_DAY_PHASE_POLL_MS } = {}) {
  const [phase, setPhase] = useState(() => officeDayPhaseAt(now()));

  useEffect(() => {
    /* Re-read immediately as well as on the interval: a floor mounted just
       after half past four should not wait a minute to catch up, and the mount
       sample above is only correct for the render that produced it. */
    const read = () => setPhase(officeDayPhaseAt(now()));
    read();
    const id = setInterval(read, pollMs);
    return () => clearInterval(id);
  }, [now, pollMs]);

  return phase;
}

export default useOfficeDayPhase;
