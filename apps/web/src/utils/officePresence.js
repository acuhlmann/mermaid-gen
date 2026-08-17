/**
 * What expects you next, read from your chair (plan slice 6;
 * docs/office-isometric-mode.md § 4).
 *
 * **This produces nothing**, and that is the carve-out licensing it — the same
 * one `useFloorPresence` and `useFloorWander` stand on. Everything below is a
 * projection of state the moment store already holds. No timer, no store write,
 * no LLM call: the strip that renders this is a window onto obligations, not a
 * participant in it.
 *
 * The strip is **actionable-only**: when nothing expects you, it is absent.
 * Pod faces and ambient floor scenes (battle, coffee, huddle at your screen)
 * are deliberately excluded — they either lied about who was "around" or routed
 * a click somewhere useless.
 *
 * Renderer-agnostic on purpose (ADR-0011 rule 1).
 */

import { FLOOR_SEATS, YOU_SEAT_ID } from './officeFloorPlan.js';
import { isSlopChatMessage } from './officeImThreads.js';
import { sceneParticipants } from './officeSceneCast.js';

/** Your own desk cluster — the six advisors at the desks adjoining yours. */
const POD_ZONE = 'pod';

/**
 * @typedef {'walkby' | 'meeting' | 'talk' | 'errand' | 'email'} OfficeNextKind
 */

/**
 * @typedef {{
 *   kind: OfficeNextKind,
 *   ids: string[],
 *   meta?: { fromId?: string, emailId?: string }
 * }} OfficeNext
 *   `ids` are cast ids in display order, deduped, never including you.
 */

/** @type {string[] | null} */
let pod = null;

/**
 * The desks adjoining yours. Still exported for roster continuity tests and
 * Slop Chat status — not shown on the idle strip anymore.
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
 * @param {Array<{colleagueId?: string, read?: boolean, outbound?: boolean, channel?: string}> | undefined} imHistory
 * @returns {string[]}
 */
function unreadImSenders(imHistory) {
  const senders = [];
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    if (!msg || msg.read || msg.outbound || !isSlopChatMessage(msg)) continue;
    senders.push(msg.colleagueId);
  }
  return others(senders);
}

/**
 * Unread mail with a human obligation — CTA marker, training, phishing drill,
 * or errand button. Plain unread thread does not count; the inbox badge carries that.
 *
 * @param {Array<{id?: string, colleagueId?: string, read?: boolean, actionPrompt?: string, training?: number, phishing?: boolean, errand?: string}> | undefined} emails
 * @returns {{ id: string, colleagueId: string } | null}
 */
function newestActionableEmail(emails) {
  for (let i = (emails?.length ?? 0) - 1; i >= 0; i -= 1) {
    const email = emails[i];
    if (!email?.id || !email.colleagueId || email.read) continue;
    if (email.actionPrompt || Number.isFinite(email.training) || email.phishing || email.errand) {
      return { id: email.id, colleagueId: email.colleagueId };
    }
  }
  return null;
}

/**
 * The next obligation on you, or null when the strip should be hidden.
 *
 * Ordered by how directly someone is waiting on **you**:
 *
 * 1. `walkby`  — at your desk.
 * 2. `talk`    — unread Slop Chat.
 * 3. `meeting` — invite pending.
 * 4. `errand`  — go and speak to somebody.
 * 5. `email`   — unread mail with a CTA marker.
 *
 * Huddles, battles, coffee, and the idle pod are excluded — either already on
 * screen, ambient theatre, or not an obligation.
 *
 * @param {object | null | undefined} snapshot `getOfficeSnapshot()`
 * @returns {OfficeNext | null}
 */
export function officeNextOf(snapshot) {
  const { walkBy, meetingInvite, imHistory, errand, emails, huddle } = snapshot ?? {};

  // Already consuming the screen — a second nudge in the taskbar is noise.
  if (others(huddle?.attendees).length) return null;

  if (walkBy?.colleagueId) {
    return { kind: 'walkby', ids: [walkBy.colleagueId] };
  }

  const messaged = unreadImSenders(imHistory);
  if (messaged.length) {
    return { kind: 'talk', ids: messaged };
  }

  const invited = others([meetingInvite?.colleagueId, ...(meetingInvite?.attendees ?? [])]);
  if (invited.length) {
    return { kind: 'meeting', ids: invited };
  }

  if (errand?.colleagueId) {
    return {
      kind: 'errand',
      ids: [errand.colleagueId],
      meta: errand.fromId ? { fromId: errand.fromId } : undefined
    };
  }

  const email = newestActionableEmail(emails);
  if (email) {
    return {
      kind: 'email',
      ids: [email.colleagueId],
      meta: { emailId: email.id }
    };
  }

  return null;
}

/** @deprecated Use `officeNextOf` — kept for tests migrating off the old ladder. */
export function officePresenceOf(snapshot) {
  return officeNextOf(snapshot);
}

/**
 * @typedef {'meeting' | 'huddle' | 'battle' | 'coffee' | 'desk' | 'available'} OfficeStatusKind
 */

/**
 * What one named colleague is doing right now.
 *
 * @param {object | null | undefined} snapshot `getOfficeSnapshot()`
 * @param {string} colleagueId
 * @returns {OfficeStatusKind}
 */
export function officeStatusOf(snapshot, colleagueId) {
  if (!colleagueId) return 'available';
  const { huddle, battle, coffee, meetingInvite, walkBy } = snapshot ?? {};

  if (meetingInvite?.attendees?.includes(colleagueId)) return 'meeting';
  if (meetingInvite?.colleagueId === colleagueId) return 'meeting';
  if (huddle?.attendees?.includes(colleagueId)) return 'huddle';
  if (sceneParticipants(battle?.lines).includes(colleagueId)) return 'battle';
  if (sceneParticipants(coffee?.lines).includes(colleagueId)) return 'coffee';
  if (walkBy?.colleagueId === colleagueId) return 'desk';
  return 'available';
}

/**
 * Where pressing the presence strip should take you.
 *
 * @param {OfficeNext | null | undefined} next
 * @returns {{ action: 'standUp' | 'messenger' | 'inbox' | 'invite', colleagueId?: string, emailId?: string }}
 */
export function presenceFollowOf(next) {
  switch (next?.kind) {
    case 'talk':
      return {
        action: 'messenger',
        colleagueId: next.ids?.[0] || undefined
      };
    case 'email':
      return {
        action: 'inbox',
        colleagueId: next.ids?.[0] || undefined,
        emailId: next.meta?.emailId
      };
    case 'meeting':
      return { action: 'invite' };
    case 'walkby':
    case 'errand':
      return { action: 'standUp' };
    default:
      return { action: 'standUp' };
  }
}

/** @internal Reset the memoized pod between tests. */
export function _resetOfficePresenceForTests() {
  pod = null;
}
