/**
 * Answering a meeting invite leaves a mark on whoever called it — either way
 * (`docs/automations/office-life.md` queue 13, the second instance, and
 * question 1's inverse at the same door).
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
 * **Every answer goes through here; the dismissals that are not answers do
 * not.** `dismissOfficeMeetingInvite` has four callers and two of them clear
 * the toast without answering it: calling your own meeting or opening the
 * picker takes the card off the screen to get it out of the way, and those stay
 * on the bare store call. The other two are answers — the decline button and
 * the propose-new-time gag (where the organizer turns your counter-offer down
 * and the toast closes itself), both of them a no — and **Accept**, which is a
 * yes.
 *
 * **This file said "only the two refusals" until 2026-11-20, and that sentence
 * was two claims wearing one.** It is true that accepting is not a *refusal*
 * and false that it is not an *answer*, and the reading it licensed was that
 * pressing **Accept** should leave nothing behind — so the office kept every no
 * to an invite and forgot every yes, which is the asymmetry
 * `officeSceneJoinMemory.js` had already been written to close on the coffee
 * break and the cubicle battle. The invite was the surface that slice did not
 * reach. `acceptOfficeMeetingInviteWithMemory` below is the same shape at the
 * same door, and the test that pinned the old reading is rewritten to the new
 * contract rather than deleted.
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

/**
 * Say yes to the meeting you were invited to, and leave the organizer knowing
 * you came.
 *
 * The beat lands on the **organizer** for the same reason the refusal's does:
 * an invite is one person's question and the press is the answer to it. The
 * other attendees were in the room with you, which is a fact of its own and not
 * this one — every meeting seats a roster and no attendee has ever carried a
 * memory of sitting in it, so widening this write would be the start of a
 * different slice rather than the end of this one (recorded as a ledger todo).
 *
 * **It returns the invite rather than starting the meeting.** Taking the card
 * off the screen and remembering the answer are one decision; walking into the
 * glass room is `startMeeting`'s, and the caller keeps it — the same split the
 * store draws by returning the invite instead of acting on it. So a caller that
 * cannot start a meeting still has not lied about one: it has the invite in
 * hand and can stop.
 *
 * @returns {{id: string, colleagueId: string, title: string, body: string,
 *   attendees: string[], audience?: string[], createdAt: number} | null}
 *   the invite that was accepted, or `null` when there was nothing on screen to
 *   accept. A `null` writes no beat: a press that accepted nothing is not an
 *   answer to anything.
 */
export function acceptOfficeMeetingInviteWithMemory() {
  const accepted = dismissOfficeMeetingInvite();
  if (!accepted) return null;
  rememberWorkingMemoryBeat(accepted.colleagueId, { inviteAccepted: true });
  return accepted;
}

export default declineOfficeMeetingInviteWithMemory;
