/**
 * An errand you walked into is still true five minutes later, and the room saw
 * it happen (`docs/automations/office-life.md` queue 2).
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
 * **The errand is part of the fact, not decoration.** `interruptedProp` is the
 * prop kind the trip was for, taken off the same `interruptSpeech` answer, and
 * it is what lets `unfinishedErrandFrom` send somebody back for the coffee they
 * never got. It changes nothing about the line and nothing about the prompt:
 * `workingMemoryPromptLines` reads `interrupted` alone, because naming the
 * machine in a sentence the model will read is a delta the prompt cannot check
 * (the situation rule in `docs/agents/domains/office.md`). It is a fact for the
 * floor, not a fact for a mouth.
 *
 * **Two memories, one edge, one latch.** The beat is the victim's own and
 * nobody else's — the quote in it is a line they said to you. The office log is
 * the room's, and an interruption belongs there for the plainest reason any
 * entry in it does: it happens in the middle of an open-plan floor and the
 * person it happened to announces it out loud. Until the log entry existed, the
 * one event on this floor with the most witnesses was the only one a third
 * colleague could not mention — `officeLogDigest.js` was already carrying email
 * subjects on the argument that a subject line is what the office gossips
 * about. Both writes sit behind the same `seatId:leg` latch below, because one
 * collision is one fact however many memories hold it.
 *
 * **Which half goes where is the split `officeLogDigest.js` restates.** The
 * reaction (`gotIt` / `gaveUp`) is public — you can see from across the room
 * whether they went back empty-handed — and the prop is not named on either
 * side, so the two records can never disagree about which machine it was. The
 * line itself stays out of the log entirely: it was said to you.
 *
 * The dedupe key is `seatId:leg` rather than the line or the trip object.
 * `interrupted` is set on the same tick `leg` increments and survives into the
 * `lingering` update that follows, so keying on the trip's identity would write
 * the same beat twice — once when they turn round, once when they reach their
 * desk — and the second one is not a second interruption.
 */

import { useEffect, useRef } from 'react';
import { recordOfficeLogEntry } from '../../state/officeLogStore.js';
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
      interrupted: said.reaction,
      interruptedProp: said.kind
    });
    /*
     * The room's half. `colleagueId` is who you walked into and `detail` is
     * which of the two reactions the floor drew, which is also what keeps the
     * log's consecutive-duplicate collapse honest here: two collisions with the
     * same person and the same outcome, back to back inside a minute, read as
     * one line — which is the truthful reading, since the second says nothing
     * the first did not — while ruining the errand and then catching them on the
     * way back stays two, because the reactions differ.
     */
    recordOfficeLogEntry('interrupt', {
      colleagueId: said.speakerId,
      detail: said.reaction
    });
    // `said` is derived from the same trip as `key` and changes with it; depending
    // on it as well would re-run this on a copy bundle swap mid-linger.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (reason: `key` is the identity of the fact being recorded; `said` is its payload and is stable for a given key)
  }, [key]);
}

export default useFloorInterruptMemory;
