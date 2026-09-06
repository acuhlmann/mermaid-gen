/**
 * An errand you walked into is still true five minutes later
 * (`docs/automations/office-life.md` queue 2).
 *
 * The floor has been able to ruin somebody's coffee run since slice 18: you
 * claim the tile they were heading for, `goHome({ byYou: true })` turns them
 * round, and `officeFloorInterrupt.js` gives them a line about it. Then the trip
 * ends and **nothing anywhere remembers it happened.** So `useFloorDwell`'s
 * gate — ask the model only when this colleague has a fact about you, deal from
 * the canned deck otherwise (`useDeskActions.remarkTo`, `cap: 0`) — almost never
 * opened, and the person whose mug you cost them had forgotten you by the time
 * you walked over. A colleague who forgets being run into does not have a life;
 * they have a script with a pause in it.
 *
 * **This records, it does not trigger** (ADR-0010). Nothing here schedules a
 * moment, and the beat changes no timer: it changes how the *next* exchange goes
 * if you start one. That is the same self-limiting property that makes slice
 * 18's line safe — you cannot cause any of it sitting still.
 *
 * **It writes what the room drew, not a second derivation of it.** The beat is
 * built from `interruptSpeech`'s answer, the same value the balloon renders and
 * the narrator speaks, so working memory can never quote a line nobody heard —
 * the one-derivation-two-consumers rule ADR-0011 rule 1 asks for, extended to a
 * third consumer.
 *
 * The dedupe key is `seatId:leg` rather than the line or the trip object.
 * `interrupted` is set on the same tick `leg` increments and survives into the
 * `lingering` update that follows, so keying on the trip's identity would write
 * the same beat twice — once when they turn round, once when they reach their
 * desk — and the second one is not a second interruption.
 */

import { useEffect, useRef } from 'react';
import { rememberWorkingMemoryBeat } from '../../state/officeWorkingMemoryStore.js';

/**
 * @param {{
 *   said: { speakerId: string, text: string, reaction: string } | null,
 *   leg?: number
 * }} options `said` is `OfficeFloor`'s `wandererSaid`; `leg` is the trip's, and
 *   is what makes one interruption one beat.
 */
export function useFloorInterruptMemory({ said, leg = 0 } = {}) {
  const written = useRef('');
  const key = said ? `${said.speakerId}:${leg}` : '';

  useEffect(() => {
    if (!key) {
      /*
       * Nothing in flight. Clearing here is what makes the key mean "this
       * interruption" rather than "this seat and leg number": a later trip by
       * the same person starts at `leg: 1` again, so a latch that never cleared
       * would silently swallow the second time you walked into them — the
       * failure being fixed here, one level up.
       */
      written.current = '';
      return;
    }
    if (written.current === key) return;
    written.current = key;
    rememberWorkingMemoryBeat(said.speakerId, {
      theirs: said.text,
      interrupted: said.reaction
    });
    // `said` is derived from the same trip as `key` and changes with it; depending
    // on it as well would re-run this on a copy bundle swap mid-linger.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: `key` is the identity of the fact being recorded; `said` is its payload and is stable for a given key)
  }, [key]);
}

export default useFloorInterruptMemory;
