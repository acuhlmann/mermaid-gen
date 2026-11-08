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
  if (!dismissed.colleagueId) return dismissed;
  if (typeof dismissed.actionPrompt !== 'string' || !dismissed.actionPrompt.trim()) {
    return dismissed;
  }
  rememberWorkingMemoryBeat(dismissed.colleagueId, { pitchDeclined: true });
  return dismissed;
}

export default dismissOfficeWalkByWithMemory;
