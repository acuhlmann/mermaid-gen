/**
 * Who is around you, read from your chair (plan slice 6;
 * docs/office-isometric-mode.md § 4).
 *
 * **This produces nothing**, and that is the carve-out licensing it — the same
 * one `useFloorPresence` and `useFloorWander` stand on. Everything below is a
 * projection of state the moment store already holds, or of the seating plan,
 * which is a module constant. No timer, no store write, no LLM call: the strip
 * that renders this is a window onto the room, not a participant in it.
 *
 * **The desk cannot see the floor.** `useFloorWander` — who is actually up and
 * loitering at the printer — is floor-local by construction: it dies when the
 * floor unmounts, which is every moment you are sitting down. The plan offered
 * that roster as the source for "who is up"; taken literally it would dress
 * *who could get up* as *who is up*. So the question is answered instead from
 * the two things a seated person genuinely knows: whoever a moment has brought
 * to them, and whoever sits within sight.
 *
 * Renderer-agnostic on purpose (ADR-0011 rule 1) — it takes a snapshot and
 * returns an answer, so the floor could caption itself off the same derivation
 * without forking. The taskbar strip is renderer #1.
 */

import { FLOOR_SEATS, YOU_SEAT_ID } from './officeFloorPlan.js';
import { sceneParticipants } from './officeSceneCast.js';

/** Your own desk cluster — the six advisors at the desks adjoining yours. */
const POD_ZONE = 'pod';

/**
 * @typedef {'pair' | 'mob' | 'walkby' | 'battle' | 'coffee' | 'meeting' | 'talk' | 'quiet'}
 *   OfficePresenceKind
 */

/**
 * @typedef {{ kind: OfficePresenceKind, ids: string[] }} OfficePresence
 *   `ids` are cast ids in the order they should be shown, deduped, and never
 *   including you — the strip answers "who is around *you*", so putting the
 *   viewer in it is the one wrong answer.
 */

/** @type {string[] | null} */
let pod = null;

/**
 * The desks adjoining yours. Computed once: `FLOOR_SEATS` is a constant, and
 * this is the whole answer to "who can you see without standing up".
 *
 * Deliberately *not* `wanderingSeatIds()`, which is everybody who ever gets up
 * — a roster of eleven that includes reception and the HR corner. From your
 * chair you cannot see reception. The pod is the honest answer, and it lands on
 * the same six faces the composer band already puts under your hands, so the
 * quiet strip reads as continuous with the roster rather than as a new cast.
 *
 * @returns {string[]}
 */
export function podSeatIds() {
  pod ??= FLOOR_SEATS.filter((seat) => seat.zone === POD_ZONE && seat.id !== YOU_SEAT_ID).map(
    (seat) => seat.id
  );
  return pod;
}

/** Cast ids, deduped, in first-seen order, with you and the empties dropped. */
function others(ids) {
  const seen = [];
  for (const id of ids ?? []) {
    if (!id || id === YOU_SEAT_ID || seen.includes(id)) continue;
    seen.push(id);
  }
  return seen;
}

/**
 * Whoever has said something you have not read, newest first.
 *
 * Unread **IMs** count as presence and unread email does not, which is a
 * distinction about the medium rather than the backlog: Slop Chat is somebody
 * typing at you now, and an inbox is somebody who typed at you at some point.
 * The inbox carries its own unread badge for that.
 *
 * @param {Array<{colleagueId?: string, read?: boolean, outbound?: boolean}> | undefined} imHistory
 * @returns {string[]}
 */
function unreadImSenders(imHistory) {
  const senders = [];
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    if (!msg || msg.read || msg.outbound) continue;
    senders.push(msg.colleagueId);
  }
  return others(senders);
}

/**
 * The room in one glance.
 *
 * Exactly one kind wins, ordered by **how close the thing is to your chair**
 * rather than by how loud it is:
 *
 * 1. `pair` / `mob` — they are at your screen. Nothing outranks that.
 * 2. `walkby`      — somebody is stood at your desk.
 * 3. `battle`      — the arena has the room.
 * 4. `coffee`      — the kitchen has it.
 * 5. `meeting`     — an invite is pending; nobody has moved yet.
 * 6. `talk`        — somebody messaged and is waiting on you.
 * 7. `quiet`       — your pod, at their desks, which is the truth most of the
 *                    time and still a real answer to "who is around".
 *
 * The moment store mostly prevents overlap (`shouldHoldAmbientOfficeMoments`
 * holds the ambient director while any surface is up), but a user-started
 * huddle can land on top of a live walk-by, so the order is load-bearing rather
 * than theoretical.
 *
 * `quiet` is the only kind that is never empty, which is what lets the strip be
 * a permanent taskbar resident: a presence strip that vanished whenever the
 * office went quiet would flicker in and out all session, and a taskbar that
 * changes width on its own is worse than one that shows six idle colleagues.
 *
 * @param {object | null | undefined} snapshot `getOfficeSnapshot()`
 * @returns {OfficePresence}
 */
// eslint-disable-next-line complexity -- (reason: the rule's own guidance allows a written reason when the branches are a small, stable state machine, and this is one: seven mutually exclusive kinds read in a fixed order. The count is one `if` per kind plus a `?.` per nullable slice — getting under 12 means either merging kinds or splitting the ladder across functions, and the order *is* the decision this function exists to express.)
export function officePresenceOf(snapshot) {
  const { huddle, walkBy, battle, coffee, meetingInvite, imHistory } = snapshot ?? {};

  const gathered = others(huddle?.attendees);
  if (gathered.length) {
    return { kind: huddle.mode === 'pair' ? 'pair' : 'mob', ids: gathered };
  }

  if (walkBy?.colleagueId) return { kind: 'walkby', ids: [walkBy.colleagueId] };

  // A holy war is a two-hander — that is what `OFFICE_BATTLE_SCENES` are, and
  // the caption is "X vs Y". Enforcing it here rather than in the view means
  // the renderer never has to own a "vs nobody" string: a malformed scene falls
  // through to the next kind instead of captioning half a fight.
  const fighting = others(sceneParticipants(battle?.lines));
  if (fighting.length >= 2) return { kind: 'battle', ids: fighting };

  const brewing = others(sceneParticipants(coffee?.lines));
  if (brewing.length) return { kind: 'coffee', ids: brewing };

  // The convener leads, because they are who the caption names.
  const invited = others([meetingInvite?.colleagueId, ...(meetingInvite?.attendees ?? [])]);
  if (invited.length) return { kind: 'meeting', ids: invited };

  const messaged = unreadImSenders(imHistory);
  if (messaged.length) return { kind: 'talk', ids: messaged };

  return { kind: 'quiet', ids: podSeatIds() };
}

/** @internal Reset the memoized pod between tests. */
export function _resetOfficePresenceForTests() {
  pod = null;
}
