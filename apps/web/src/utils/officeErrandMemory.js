/**
 * Dropping an errand leaves a mark on whoever asked
 * (`docs/automations/office-life.md` queue 13).
 *
 * Every refusal on this floor has content except this one. A declined coffee
 * break keeps its cast and plays out in the kitchen without you (§ 5 slice 28);
 * a declined battle does the same; walking into somebody's errand writes a beat
 * they still have five minutes later (`useFloorInterruptMemory`). _Not today_
 * on an errand card called `dismissOfficeErrand` and that was the end of it:
 * Linda asked you to go and have a word with Chad, you said no, and the office
 * held no fact about having asked. **A room that asks and never notices the
 * answer is a room that was only ever reciting.**
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * schedules a reminder, re-raises the card or nags — which is the whole reason
 * an errand is droppable in one press with no confirmation. A refusal that gets
 * chased is auto-fix-on-idle wearing a lanyard, and the beat below cannot chase
 * anything: it changes how the *next* exchange with the asker goes, if you start
 * one.
 *
 * **The beat lands on the asker and nowhere else.** `fromId` is the one person
 * who knows the errand existed — they are the one still waiting for it. Writing
 * it on `colleagueId` as well would give the person you never spoke to a memory
 * of a conversation that never reached them, which is the fabrication the
 * situation rule in `docs/agents/domains/office.md` was measured on, arriving
 * through memory instead of through a prompt.
 *
 * **Why a function and not a line in a handler.** The drop button lives on the
 * floor today, but what a refusal costs is renderer-agnostic (ADR-0011 rule 1):
 * if the desk ever grows a way to drop an errand it calls this, rather than
 * re-deriving the same write beside a second button. It is also why the store
 * returns the dropped errand instead of writing the beat itself — the store
 * records state, and memory has one writer per edge.
 */

import { dismissOfficeErrand } from '../state/officeMomentStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';

/**
 * Drop the errand you are carrying, and leave the asker knowing you did.
 *
 * @param {string} [id] the errand's id, when a caller holds one — the store
 *   ignores a drop aimed at an errand that is no longer current.
 * @returns {{id: string, fromId: string, colleagueId: string, createdAt: number} | null}
 *   the errand that was dropped, or `null` when there was nothing to drop. A
 *   `null` writes no beat: a press that dropped nothing is not a refusal.
 */
export function dropOfficeErrandWithMemory(id) {
  const dropped = dismissOfficeErrand(id);
  if (!dropped) return null;
  rememberWorkingMemoryBeat(dropped.fromId, { errandDropped: true });
  return dropped;
}

export default dropOfficeErrandWithMemory;
