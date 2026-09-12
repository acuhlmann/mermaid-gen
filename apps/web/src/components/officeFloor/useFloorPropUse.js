/**
 * Using the thing once you have walked to it (slice 9).
 *
 * Sibling of `useFloorTalk`, and the same division of labour: presence gets you
 * there, this owns only what happens on arrival. For three of the four props
 * that is nothing at all — a line is a line — and for the coffee machine it is
 * one call to the desk verb the machine duplicates (ADR-0011 rule 2).
 *
 * Two things are worth the file rather than an effect inside `useFloorActivity`:
 *
 * 1. **Once per arrival.** The verb is a real moment with real cost; a render
 *    loop that re-fired it would pour coffee forever. `useFloorTalk` guards its
 *    opener the same way, with a ref rather than a dependency, because the
 *    handler's identity must not be a re-trigger.
 * 2. **Whether it worked is view state.** `getCoffee` returns `false` when the
 *    desk is busy or an office surface is already up, and a machine that
 *    silently does nothing reads as a broken machine. The card says so instead,
 *    which is why the outcome is remembered here and nowhere else — it dies
 *    when you walk away, like everything else about standing somewhere.
 *
 * ## What using a prop leaves behind
 *
 * Until now nothing did. ADR-0011's worked example records "the printer and
 * whiteboard duplicate nothing and produce nothing", and the Sign-off rule it
 * cites (ADR-0010) is about **artifacts** — the office never authors a
 * deliverable. Neither of the two things below is one:
 *
 * - **A hand.** `propHandsFor` already says what a prop hands over, and
 *   `floorActivityFor`'s rung 4 (`carrying`) was already written for the day
 *   somebody other than a wanderer picked something up — "the order is written
 *   down for the day somebody makes them overlap". So you walk away from the
 *   printer holding the printout, drawn by the `papers` art that already
 *   exists. Nothing new is invented, and the whiteboard still hands over
 *   nothing because you cannot carry a whiteboard.
 * - **A line in the office log.** The log is the office's *record* of the day
 *   (ADR-0010 consequence #4 — it records, it never triggers), and its own
 *   header says its writers are "the surfaces that already know". This effect
 *   is that surface: it is the one place in the building that knows you used
 *   the thing, and it already had the fact in hand. That is what makes a prop
 *   **helpful** rather than only interactive — a colleague's next line can be
 *   spoken from "you printed something off" without the floor generating
 *   anything.
 *
 * Two boundaries worth keeping. The hand **survives walking away** while
 * `phase` deliberately does not: the outcome of standing somewhere dies with
 * standing there, and a page in your hand is a thing you are holding until you
 * sit down (the hook unmounts and it goes with it — ADR-0011 rule 1, no floor
 * state outlives the floor). And only a prop with **no `verb`** records, because
 * a verb already records its own consequence: `getCoffee` pours a break and the
 * break logs `coffee` through the office-event funnel, so logging here as well
 * would say one thing twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { propHandsFor, propUseFor } from '../../utils/officeFloorProps.js';
import { recordOfficeLogEntry } from '../../state/officeLogStore.js';

/**
 * @typedef {'idle' | 'working' | 'done' | 'blocked'} PropUsePhase
 *   `done` covers both a verb that delivered and a prop that never had one —
 *   from the card's point of view they are the same thing: you are stood there
 *   and there is a line to read.
 */

/**
 * @param {{
 *   propKind: string | null,
 *   arrived: boolean,
 *   onGetCoffee?: () => Promise<boolean> | boolean,
 *   onPropCue?: (propKind: string) => void,
 *   onFloorCue?: (cue: string, options?: object) => void
 * }} options
 * @returns {{ phase: PropUsePhase, carrying: string | null }}
 */
export function useFloorPropUse({ propKind, arrived, onGetCoffee, onPropCue, onFloorCue }) {
  const [phase, setPhase] = useState('idle');
  /**
   * What you are holding because a prop handed it to you — one of
   * `FLOOR_HOLDS`, or `null` until something does. Deliberately outside the
   * walk-away reset below: see this file's header.
   */
  const [carrying, setCarrying] = useState(null);
  /** Which prop we have already used, so arriving does not re-fire on render. */
  const used = useRef(null);
  const alive = useRef(true);
  const onPropCueRef = useRef(onPropCue);
  const onFloorCueRef = useRef(onFloorCue);
  useEffect(() => {
    onPropCueRef.current = onPropCue;
    onFloorCueRef.current = onFloorCue;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Walking away puts the machine back to untouched; anything it actually did
  // (a coffee break, a page in your hand, a line in the log) is elsewhere and
  // carries on without us.
  useEffect(() => {
    if (propKind) return;
    used.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: clearing an outcome whose prop is gone; there is nothing left to derive it from once the intent has cleared)
    setPhase('idle');
  }, [propKind]);

  const fire = useCallback(
    async (kind) => {
      const use = propUseFor(kind);
      if (!use?.verb) return true; // scenery with a line: arriving *is* using it
      if (use.verb === 'coffee') return (await onGetCoffee?.()) !== false;
      return true;
    },
    [onGetCoffee]
  );

  /**
   * What a use that actually delivered leaves behind, in the two places that
   * outlive standing here. Both are reads of tables the room already keeps —
   * nothing decides anything new about a prop at this call site.
   *
   * @param {string} kind
   */
  const keep = useCallback((kind) => {
    const took = propHandsFor(kind);
    // Only *set*, never clear: reading the whiteboard does not take the
    // printout out of your hands, and `propHandsFor` is null for it.
    if (took) setCarrying(took);
    if (!propUseFor(kind)?.verb) recordOfficeLogEntry('prop', { detail: kind });
  }, []);

  useEffect(() => {
    if (!propKind || !arrived) return;
    if (used.current === propKind) return;
    used.current = propKind;
    // Diegetic SFX before the verb — the printer should whir when you arrive,
    // not after the gag line has already rendered.
    onPropCueRef.current?.(propKind);
    const run = async () => {
      setPhase('working');
      let delivered = false;
      try {
        delivered = await fire(propKind);
      } finally {
        if (alive.current) {
          setPhase(delivered ? 'done' : 'blocked');
          // A jammed machine hands over nothing and the office remembers
          // nothing, which is the same rule a wander trip already follows:
          // `goHome` sends an interrupted colleague back empty-handed because
          // they never reached the thing.
          if (delivered) keep(propKind);
          // Point 2 of this file's own header: a machine that silently does
          // nothing reads as a broken machine, and the card saying so was only
          // half the answer — a jam you can hear is the half that arrives
          // before you have read anything.
          if (!delivered) onFloorCueRef.current?.('jam');
        }
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: one use per arrival; `fire` closes over the desk verb, whose identity must not pour a second coffee)
  }, [propKind, arrived]);

  return { phase, carrying };
}

export default useFloorPropUse;
