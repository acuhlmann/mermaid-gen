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
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { propUseFor } from '../../utils/officeFloorProps.js';

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
 *   onGetCoffee?: () => Promise<boolean> | boolean
 * }} options
 * @returns {{ phase: PropUsePhase }}
 */
export function useFloorPropUse({ propKind, arrived, onGetCoffee }) {
  const [phase, setPhase] = useState('idle');
  /** Which prop we have already used, so arriving does not re-fire on render. */
  const used = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Walking away puts the machine back to untouched; anything it actually did
  // (a coffee break) is in the office store and carries on without us.
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

  useEffect(() => {
    if (!propKind || !arrived) return;
    if (used.current === propKind) return;
    used.current = propKind;
    const run = async () => {
      setPhase('working');
      let delivered = false;
      try {
        delivered = await fire(propKind);
      } finally {
        if (alive.current) setPhase(delivered ? 'done' : 'blocked');
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: one use per arrival; `fire` closes over the desk verb, whose identity must not pour a second coffee)
  }, [propKind, arrived]);

  return { phase };
}

export default useFloorPropUse;
