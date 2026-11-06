/**
 * Reading somebody's screen is still true five minutes later
 * (`docs/automations/office-life.md` question 1 — *"if I do something to a
 * person — **click them**, walk into them, stand beside them, hand them a
 * sentence — do they behave differently later?"*).
 *
 * Desk peeking has been in the room since slice 6: you cross the floor, your
 * seat empties, you stand at their desk, and they say a line about what is on
 * their monitor. It was the last verb aimed at **one named person** that left
 * nothing behind — an interruption, an email, a dropped errand, a declined
 * invite and a declined set piece all write a beat, and the most deliberate
 * approach of the five wrote none. So you could read Gilfoyle's terminal over
 * his shoulder, walk two tiles, stand beside him, and be a stranger:
 * `hasWorkingMemoryFact` false, the dwell line dealt off the stranger reserve,
 * and `workingMemoryPromptLines` with nothing to say about the thing you had
 * both just done.
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * schedules a moment or starts a timer; the beat changes how the *next*
 * exchange goes if you start one. Same self-limiting shape as the interruption
 * beat — you cannot cause any of it sitting still, because a peek is a walk you
 * chose.
 *
 * **Three consequences follow with no further wiring, which is the point of
 * writing a fact rather than a feature.** `hasWorkingMemoryFact` turns true, so
 * a later dwell spends from the generous reserve rather than the stranger one
 * (`useDeskActions.remarkTo`). `workingMemoryPromptLines` gains the line, so
 * whatever they say next has a fact about you to say it from. And
 * `listWorkingMemoryColleagueIds` now holds them, so the ambient director's own
 * weighted draw (`ambientSpeakerFrom`) is more likely to pick the person whose
 * screen you were reading — the room answering for a reason rather than a roll.
 *
 * **The latch is the colleague, cleared when the peek ends.** `phase` goes
 * `walking` → `looking` and stays there for as long as you stand at the desk,
 * so an unlatched effect would write a beat on every render while you read.
 * Keying on the id alone and clearing on the way out is what makes two peeks at
 * the same person two beats and one long peek one — the same correction
 * `useFloorInterruptMemory` records about `leg`.
 *
 * **Arrival, never the walk.** A peek that is still crossing the room has not
 * read anything, and the walk is abandonable: Escape sends you home from the
 * corridor, and a meeting taking the room drops the peek outright
 * (`officeFloorPeek.test.jsx` pins both). `looking` is the floor's own word for
 * having got there, and it is the same "only once you have arrived" rule
 * `speakingId` and `activePropKind` already follow.
 */

import { useEffect, useRef } from 'react';
import { rememberWorkingMemoryBeat } from '../../state/officeWorkingMemoryStore.js';

/**
 * @param {{ peek?: { colleagueId?: string, phase?: string } | null }} options
 *   `peek` is `useFloorActivity`'s projection — the same object the card and the
 *   speech bubble read, so the memory cannot disagree with them about whose
 *   desk you are standing at.
 */
export function useFloorPeekMemory({ peek } = {}) {
  const written = useRef('');
  const key = peek?.phase === 'looking' ? (peek.colleagueId ?? '') : '';

  useEffect(() => {
    if (!key) {
      written.current = '';
      return;
    }
    if (written.current === key) return;
    written.current = key;
    rememberWorkingMemoryBeat(key, { peeked: true });
  }, [key]);
}

export default useFloorPeekMemory;
