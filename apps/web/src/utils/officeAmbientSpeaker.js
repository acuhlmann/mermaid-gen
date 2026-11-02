/**
 * Who the room sends next, when the room is the one starting it
 * (docs/office-parody.md § 11; the reactive half of this question is
 * `officeRunReactionPicker.js`).
 *
 * The ambient director owns *when* a moment fires and *which kind* it is
 * (`officeCadence.js` / `pickNextMoment`). It has never owned *who*: the LLM
 * rung drew a name uniformly out of a per-kind cast list, and the canned rung
 * let whichever template the roll landed on decide, so the person who walked
 * over to your desk was a coin flip over a bank. That is the one place the
 * office's own memory was not consulted at all. You can wreck somebody's
 * errand, decline their meeting, walk out of their argument and leave a
 * three-paragraph email in their tray, and the next cold open is as likely to
 * be anybody else — which is "many verbs in, few consequences out" in its
 * purest form.
 *
 * **Reactive already did this, and the asymmetry is the finding.**
 * `pickRunReactionColleague` has preferred `listWorkingMemoryColleagueIds()`
 * since the run-walk slice. It can afford to be *absolute* about it (it takes
 * `prefer[0]`) because you just finished a run and there is one obvious thing
 * to react to. Ambient cannot: a cold open happens every few minutes for a
 * whole visit, and a director that always picks the last person you dealt with
 * turns a sixteen-person office into a one-person show the instant you touch
 * anybody. So this is a *thumb on the scale*, not a gate.
 *
 * **The thumb is extra lottery tickets, and that shape is the argument.** The
 * alternative was a probability — "x% of the time, prefer somebody familiar" —
 * and the prop-news slice already paid for the lesson that a weight which can
 * dominate will: under a `Math.max`, a heavier third claimant erased every
 * colleague's own habit. Tickets cannot dominate by construction. A familiar
 * colleague is entered `OFFICE_AMBIENT_FAMILIAR_TICKETS` extra times and
 * everybody keeps the entry they had, so:
 *
 * - nobody's chance ever reaches zero, whatever the dial says;
 * - the bias **fades on its own** as the visit goes on. One person in working
 *   memory out of a seven-strong cast is twice as likely as a stranger; once
 *   you have dealt with the whole cast every name is doubled and the draw is
 *   uniform again, with no window, no decay table and no clock;
 * - `OFFICE_AMBIENT_FAMILIAR_TICKETS = 0` is the exact old behaviour, so the
 *   rollback is a constant rather than a revert.
 *
 * **Record, never trigger** (ADR-0010). Nothing here writes, schedules or
 * subscribes. `memoryIds` is passed in — the store is read at fire time by the
 * caller, exactly like the hour and the office log are — so this module is a
 * pure function of a list and a roll, and the floor does not re-render because
 * somebody's memory changed.
 *
 * **Duplicates in `cast` are meaningful and are kept.** The canned banks hold
 * more than one line for some colleagues, and `pickUnseenTemplate` draws over
 * *templates*, so a colleague with two lines is already twice as likely to
 * speak. Passing the per-template id list (dupes and all) keeps that base
 * distribution exactly as it is today and lets the tickets ride on top of it;
 * de-duplicating first would quietly re-cast the bank, which is a different
 * change wearing this one's clothes.
 */

import { OFFICE_AMBIENT_FAMILIAR_TICKETS } from './officeCadence.js';

/**
 * Draw one speaker from `cast`, with anybody in `memoryIds` holding extra
 * tickets. `null` only when there is nobody to draw.
 *
 * @param {string[]} cast ids eligible for this kind of moment — one entry per
 *   chance, so repeats are weight rather than a mistake
 * @param {string[]} [memoryIds] ids with something from today, as
 *   `listWorkingMemoryColleagueIds()` returns them
 * @param {() => number} [random]
 * @param {number} [tickets] extra entries per familiar id; `0` is a uniform draw
 * @returns {string | null}
 */
export function ambientSpeakerFrom(
  cast,
  memoryIds = [],
  random = Math.random,
  tickets = OFFICE_AMBIENT_FAMILIAR_TICKETS
) {
  if (!Array.isArray(cast) || cast.length === 0) return null;

  const pool = [...cast];
  const extra = Math.max(0, Math.floor(Number(tickets) || 0));
  if (extra > 0 && Array.isArray(memoryIds) && memoryIds.length > 0) {
    const eligible = new Set(cast);
    for (const id of memoryIds) {
      if (!eligible.has(id)) continue;
      for (let i = 0; i < extra; i += 1) pool.push(id);
    }
  }

  return pool[Math.floor(random() * pool.length)] ?? null;
}

export default ambientSpeakerFrom;
