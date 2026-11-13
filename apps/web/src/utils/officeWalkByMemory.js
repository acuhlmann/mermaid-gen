/**
 * Waving away what somebody walked over to offer you leaves a mark on them
 * (`docs/automations/office-life.md` queue 13 — *"every surface has an ✕ and
 * every ✕ is silent"*).
 *
 * Three of the four ✕s on that sweep's list already have content: a dropped
 * errand (`officeErrandMemory.js`), a declined calendar invite
 * (`officeInviteMemory.js`) and a declined set piece
 * (`officeSceneDeclineMemory.js`). This is the fourth, and it is the one the
 * sweep should have started with, because it is the only refusal in the office
 * whose **acceptance was already remembered**: `markWorkingMemoryPitchTaken`
 * has written `pitchTaken` on whoever's idea you used since working memory
 * existed. The same bubble, in both renderers, carries **Do it** and ✕ side by
 * side — and only one of those two buttons reached anybody's memory. A room
 * that records its hits and forgets its misses is not remembering you, it is
 * keeping score of itself.
 *
 * **Only a walk-by that was offering something can be refused.** The gate is
 * `actionPrompt`, which is also exactly what makes the **Do it** button render
 * (`OfficeWalkBy.jsx`, `FloorWalker.jsx`): with a prompt the bubble is a
 * question and ✕ is an answer; without one it is somebody saying a thing, and
 * closing it means you read it. Writing a refusal there would invent a
 * suggestion to have refused — which is the fabrication the situation rule in
 * `docs/agents/domains/office.md` was measured on (8 of 12 turns), arriving
 * through memory instead of through a prompt.
 *
 * **A clock is not a refusal.** `pushOfficeWalkBy` schedules its own expiry, so
 * every walk-by you never answer clears itself after `WALKBY_TTL_MS`, and that
 * path calls the store's `dismissOfficeWalkBy` directly. This module is called
 * from the **press handler** instead, which is why the TTL can never write a
 * beat — not because anything checks for it, but because it does not come
 * through here. Taking the opposite shape (the beat inside the store mutator)
 * would have given a memory of being turned down to every colleague who walked
 * over while you were reading something else.
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * re-raises the suggestion, queues it for later or nags; the only thing written
 * is a sentence a later `/moment` may quote, which changes how the *next*
 * exchange with them goes if you start one. A pitch that chases you is
 * auto-fix-on-idle wearing a lanyard.
 *
 * **And the other half of queue 13 — *"every ✕ is silent"* — lives here too.**
 * The beat above answered the memory half in one night and left the room mute
 * at the moment it had most obviously noticed something: you waved somebody off
 * while they were standing in front of you, and they turned round and walked
 * home without a word. `walkByRefusalLine` is the mouth, `useFloorWalker` is
 * the only caller, and both halves read **one** gate (`isRefusableWalkBy`) so
 * the sentence and the memory can never disagree about whether there was
 * anything to refuse. It is canned on purpose and the rule is
 * `office-parody.md` § 11 read exactly: you pressed a button, you did not type
 * a sentence, so a bank is honest and a model call here would be spend with
 * nothing to answer.
 *
 * **Why a function and not two lines in the handler.** The ✕ is rendered by the
 * desk card and by the floor walker and both route through one handler today,
 * but what a refusal costs is renderer-agnostic (ADR-0011 rule 1) and
 * `markWorkingMemoryPitchTaken`'s own call site is the warning: it sits inline
 * in `OfficeLayer.jsx`, and that is the reason this file's twin had to be
 * found by reading a 1900-line component rather than by opening a module named
 * after the edge.
 */

import { dismissOfficeWalkBy } from '../state/officeMomentStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';

/**
 * Whether this walk-by was offering something, and can therefore be refused.
 *
 * One predicate for both halves of the refusal — the beat below and the line
 * `useFloorWalker` says on the way out — because the two are the same fact seen
 * twice and a gate that drifted would be silent in the worst direction: a
 * colleague apologising for a suggestion they never made, which is the
 * fabrication `docs/agents/domains/office.md`'s situation rule was measured on.
 *
 * @param {{ colleagueId?: string, actionPrompt?: string } | null | undefined} walkBy
 * @returns {boolean}
 */
export function isRefusableWalkBy(walkBy) {
  if (!walkBy || !walkBy.colleagueId) return false;
  return typeof walkBy.actionPrompt === 'string' && walkBy.actionPrompt.trim().length > 0;
}

/**
 * What they say on the way back to their desk, or `''` when they say nothing.
 *
 * **The bank is picked by a fraction, never by an index.** A locale bundle is
 * copy and a shorter list in one language must not be indexed past — the same
 * reasoning `officeFloorInterrupt.js` states for its own `roll`, and the same
 * reason this returns the finished string rather than a number for somebody
 * else to look up later.
 *
 * Gated on `isRefusableWalkBy` above, so a bubble that was only ever telling
 * you something closes in silence: pressing ✕ on a remark means you read it,
 * and a line there would invent a suggestion to have been turned down.
 *
 * @param {{ colleagueId?: string, actionPrompt?: string } | null | undefined} walkBy
 * @param {{ declined?: string[] } | null | undefined} copy the floor's copy bundle
 * @param {() => number} [random]
 * @returns {string}
 */
export function walkByRefusalLine(walkBy, copy, random = Math.random) {
  if (!isRefusableWalkBy(walkBy)) return '';
  const lines = Array.isArray(copy?.declined) ? copy.declined.filter(Boolean) : [];
  if (lines.length === 0) return '';
  return lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))];
}

/**
 * Wave away the walk-by on screen, and leave whoever came over knowing you
 * did.
 *
 * @param {string} [id] the walk-by's id, when a caller holds one — the store
 *   ignores a dismiss aimed at a walk-by that is no longer on screen.
 * @returns {{id: string, colleagueId: string, body: string, actionPrompt?: string,
 *   createdAt: number} | null} the walk-by that was dismissed, or `null` when
 *   there was nothing on screen to dismiss. A `null` writes no beat: a press
 *   that dismissed nothing is not an answer to anything.
 */
export function dismissOfficeWalkByWithMemory(id) {
  const dismissed = dismissOfficeWalkBy(id);
  if (!dismissed) return null;
  /*
   * A walk-by with nobody attached is the same degradation the other three
   * refusals already chose: a refusal aimed at nobody is not a refusal. The
   * walk-by is still dismissed — the store did that before we got here — so
   * both bubbles behave identically either way.
   */
  if (!isRefusableWalkBy(dismissed)) return dismissed;
  rememberWorkingMemoryBeat(dismissed.colleagueId, { pitchDeclined: true });
  return dismissed;
}

export default dismissOfficeWalkByWithMemory;
