/**
 * Declining a meeting leaves a mark on whoever called it
 * (`docs/automations/office-life.md` queue 13, the second instance).
 *
 * The errand drop was the first refusal on this floor to leave a fact behind
 * (`officeErrandMemory.js`); the calendar invite was the one the same sweep
 * found still silent. Chad books "WG: Diagram Alignment Sync (recurring)" over
 * your afternoon, you press Decline, the toast goes away, and the office holds
 * nothing about having asked — so the next time you stand next to him the room
 * is as blank as it would be if the invite had never been sent. **A room that
 * asks and never notices the answer is a room that was only ever reciting.**
 *
 * **It records, it does not trigger** (ADR-0010 consequence #4). Nothing here
 * re-raises the invite, schedules a follow-up or nags, which is why a decline
 * can stay a single press with no confirmation. A refusal that gets chased is
 * auto-fix-on-idle with a calendar, and the beat below cannot chase anything:
 * it changes how the *next* exchange with the organizer goes, if you start one.
 *
 * **The beat lands on the organizer and nowhere else.** `colleagueId` is the
 * one person a calendar decline actually reaches; the attendees on the invite
 * were not told your answer, and writing it on them would hand somebody a
 * memory of a conversation that never got to them — the fabrication the
 * situation rule in `docs/agents/domains/office.md` was measured on, arriving
 * through memory instead of through a prompt.
 *
 * **Only the two refusals go through here.** `dismissOfficeMeetingInvite` has
 * four callers and three of them are not a no: accepting clears the toast on
 * the way into the glass room, and calling or picking your own meeting clears
 * it to get it out of the way. Those stay on the bare store call, because a
 * dismissal that happens to clear an invite is not an answer to it — the
 * decline button and the propose-new-time gag (where the organizer turns your
 * counter-offer down and the toast closes itself) are.
 *
 * **Why a function and not a line in the handler.** The invite toast renders in
 * both worlds, and what a refusal costs is renderer-agnostic (ADR-0011 rule 1),
 * so it is written once here rather than beside each button. It is also why the
 * store returns the dismissed invite instead of writing the beat itself — the
 * store records state, and memory has one writer per edge.
 */

import { dismissOfficeMeetingInvite } from '../state/officeMomentStore.js';
import { rememberWorkingMemoryBeat } from '../state/officeWorkingMemoryStore.js';

/**
 * Turn down the meeting you were invited to, and leave the organizer knowing.
 *
 * @returns {{id: string, colleagueId: string, title: string, body: string,
 *   attendees: string[], audience?: string[], createdAt: number} | null}
 *   the invite that was declined, or `null` when there was nothing on screen
 *   to decline. A `null` writes no beat: a press that declined nothing is not
 *   a refusal.
 */
export function declineOfficeMeetingInviteWithMemory() {
  const declined = dismissOfficeMeetingInvite();
  if (!declined) return null;
  rememberWorkingMemoryBeat(declined.colleagueId, { inviteDeclined: true });
  return declined;
}

export default declineOfficeMeetingInviteWithMemory;
