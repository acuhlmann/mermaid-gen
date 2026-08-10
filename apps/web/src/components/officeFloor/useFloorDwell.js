/**
 * The clock behind "you have been standing there a while"
 * (docs/office-isometric-mode.md § 5 slice 19).
 *
 * `dwellTargetAt` answers *who* you are next to; this owns the only new signal
 * the slice adds, which is **how long**, and composes the two ends into the one
 * thing the view actually renders. Deliberately the smallest possible version:
 * one timer, one line per approach, and nothing written anywhere — the remark
 * itself goes through the desk's existing verb into `imHistory`, so this hook
 * produces no state about anybody (ADR-0011 rule 1).
 *
 * It takes the raw inputs and returns the finished beat rather than leaving the
 * composition to the caller, for the reason § 8 records about `OfficeFloorView`:
 * that component is the worst complexity offender on the floor, and seven
 * `?.`/`??`/ternary operators spent assembling a speech bubble there are seven
 * it does not have to spare. Complexity is counted per function, so this is the
 * fix that works.
 *
 * **One line per approach, and leaving is what re-arms it.** A repeating timer
 * would turn a colleague into a car alarm, and that failure is worse than
 * silence: the office's whole anti-annoyance policy exists because a surface
 * people mute is not there for the moment that mattered. `target` changing —
 * including to nobody — is the signal that the approach is over.
 *
 * **Five seconds is a decision.** Short enough that you find it by accident on
 * the way past somebody's desk, long enough that walking through the pod does
 * not set off three people in a row. Arriving somewhere is not loitering.
 */

import { useEffect, useRef, useState } from 'react';
import { dwellLineFrom, dwellTargetAt } from '../../utils/officeFloorDwell.js';

/** How long you have to stand there before anybody looks up. */
export const DWELL_MS = 5_000;

/**
 * @param {{
 *   youTile: { x: number, y: number } | null,
 *   floorState?: { wanderer?: unknown, awayIds?: string[] },
 *   active?: boolean,
 *   imHistory?: Array<object>,
 *   suspended?: boolean,
 *   onRemark?: (colleagueId: string) => Promise<unknown> | unknown
 * }} options `active` is whether you are actually free to loiter — a card open
 *   or a conversation running is a *reason* to be stood there, and those
 *   surfaces already speak for themselves.
 * @returns {{ said: { speakerId: string, text: string } | null, at: { x: number, y: number } | null }}
 *   `said` is the line to draw and to speak; `at` is where to draw it, `null`
 *   for somebody in their own chair (`FloorDeskSpeech`'s own convention).
 */
export function useFloorDwell({
  youTile,
  floorState,
  active = true,
  imHistory,
  suspended = false,
  onRemark
}) {
  const [spoke, setSpoke] = useState(null);
  const dwell = dwellTargetAt(youTile, floorState);
  const target = active ? (dwell?.colleagueId ?? null) : null;

  /* Read at fire time. The handler is rebuilt by `OfficeLayer` on most renders
     and depending on it would restart the countdown every time, which is the
     one way this timer could never finish. */
  const onRemarkRef = useRef(onRemark);
  useEffect(() => {
    onRemarkRef.current = onRemark;
  });

  useEffect(() => {
    /*
     * A new approach is a new beat, so whatever was said during the last one is
     * over. This has to be a write rather than a derivation: `spoke` already
     * carries the colleague it belongs to, so rendering could tell a *different*
     * person's line apart on its own — what it cannot tell apart is walking away
     * from somebody and coming straight back to them, which is the case that
     * decides whether they are allowed to speak twice.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: clearing the previous approach, which is a transition rather than a projection — `target` returning to the same id is exactly the case a derived value cannot distinguish)
    setSpoke(null);
    if (suspended || !target) return undefined;

    const timer = setTimeout(() => {
      // Recorded before the call, not after: the remark is what bounds the
      // search through `imHistory`, and awaiting an LLM round-trip first would
      // let the line arrive before the mark that is supposed to precede it.
      setSpoke({ colleagueId: target, at: Date.now() });
      void onRemarkRef.current?.(target);
    }, DWELL_MS);
    return () => clearTimeout(timer);
  }, [suspended, target]);

  /*
   * The line lands in `imHistory` a round trip after the remark was asked for,
   * so what is rendered is looked up rather than returned — and bounded by when
   * it was asked for, or an old message from the same colleague would surface
   * as though they had just said it.
   */
  const line = dwellLineFrom(imHistory, spoke);
  return {
    said: line ? { speakerId: spoke.colleagueId, text: line } : null,
    at: dwell?.at ?? null
  };
}

export default useFloorDwell;
