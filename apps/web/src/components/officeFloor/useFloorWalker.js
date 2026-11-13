/**
 * Walker lifecycle for isometric mode.
 *
 * The office store holds one truth — `walkBy` is either happening or it isn't.
 * A floor walker needs one beat more than that: when the moment clears (you
 * dismissed it, or the TTL expired) the colleague should walk *back* to their
 * desk rather than vanish mid-sentence. That departing copy is presentation
 * state, the same way a CSS exit transition is, and it never feeds back into
 * office state — no floor-only truth (ADR-0011).
 *
 * **The refusal line rides on that same departing copy, and that is the whole
 * reason it is legal here.** Queue 13's other half — *"every ✕ is silent"* —
 * wants somebody you waved off to say something on the way home, and a line is
 * not a new event type, a new moment kind or a second truth: it is this exit
 * transition with words on it, derived from the walk-by that was already on
 * screen and thrown away with it. Nothing is written, nothing is scheduled, and
 * the desk renderer's card closes exactly as it did before (ADR-0011 rule 1 is
 * about forking *state* per mode, and there is none to fork).
 *
 * **Only this hook can tell the two endings apart, which is why the line is
 * derived here.** `dismissOfficeWalkBy` is called by the 24 s TTL as well as by
 * the ✕, and from inside the store the two are the same mutation — the reason
 * `officeWalkByMemory.js` writes its beat from the press handler instead. One
 * tick after the store clears, "you turned them down" and "you were reading
 * something else" are indistinguishable here too, so `handleRefused` is called
 * synchronously by the press and the effect below spends what it left behind.
 * A clock running out is still not a refusal: it says nothing, exactly as it
 * writes nothing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { officeChromeCopy } from '../../utils/officeCast.js';
import { walkByRefusalLine } from '../../utils/officeWalkByMemory.js';

/**
 * @param {{ id: string, colleagueId: string } | null | undefined} walkBy
 * @returns {{
 *   walker: { id: string, colleagueId: string, refused?: boolean } | null,
 *   departing: boolean,
 *   handleRefused: (id?: string) => void,
 *   handleDeparted: () => void
 * }}
 */
export function useFloorWalker(walkBy) {
  const [leaving, setLeaving] = useState(/** @type {any} */ (null));
  const lastRef = useRef(/** @type {any} */ (null));
  const refusalRef = useRef('');

  /*
   * The press, not the dismissal. Called beside `onDismissWalkBy` rather than
   * instead of it, so the store call this hook watches for is untouched and a
   * floor that never wires this up degrades to the silence it had before.
   *
   * The line is rolled **now**, while the walk-by is still on screen, because
   * one tick later `lastRef` is the only copy of it left and `copy.declined`
   * must be read against the bundle that was active when you pressed.
   */
  const handleRefused = useCallback((id) => {
    const current = lastRef.current;
    if (!current) return;
    if (id && current.id !== id) return;
    refusalRef.current = walkByRefusalLine(current, officeChromeCopy()?.floor);
  }, []);

  useEffect(() => {
    if (walkBy) {
      lastRef.current = walkBy;
      refusalRef.current = '';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: syncing presentation state to an external store's transition; there is no render-time signal that a moment just ended)
      setLeaving(null);
      return;
    }
    if (lastRef.current) {
      const refused = refusalRef.current;
      const departing = refused
        ? /*
           * `actionPrompt` is dropped so the bubble cannot render **Do it**
           * under the sentence that answered it — the offer is over, and a
           * second chance to take it is the pitch chasing you (ADR-0010).
           */
          { ...lastRef.current, body: refused, actionPrompt: undefined, refused: true }
        : lastRef.current;
      refusalRef.current = '';
      setLeaving(departing);
      lastRef.current = null;
    }
  }, [walkBy]);

  return {
    walker: walkBy ?? leaving,
    departing: !walkBy && Boolean(leaving),
    handleRefused,
    handleDeparted: () => setLeaving(null)
  };
}
