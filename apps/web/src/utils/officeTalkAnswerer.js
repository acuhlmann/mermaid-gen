/**
 * Who picks it up when you say something out loud and name nobody
 * (`DeskTalkComposer`'s undirected lane; the room-starts-it half of this
 * question is `officeAmbientSpeaker.js`, the after-a-run half is
 * `officeRunReactionPicker.js`).
 *
 * `talkOutLoud` has always rolled its answerer uniformly — `pickRandomFrom`
 * over `DESK_IM_CAST` (the whole directory, 16 names) for a shout, over
 * `OFFICE_WALKBY_LLM_CAST` (7) for a walk-over. The composer's own doc says the
 * undirected act is the one where *"someone apt answers"*, and nothing made
 * anybody apt: **a reply to the person who just spoke to you reached them one
 * time in sixteen.** That is the shape it takes on the desk, where the talk
 * composer is also how you answer a line that landed over your head — the floor
 * has a talk card with a name on it, the desk has a field addressed to the room.
 * So a colleague would walk over, say something, and your answer would be
 * fielded by somebody on the other side of the building.
 *
 * **The fact is an open conversation, which is not the ambient director's
 * fact.** `ambientSpeakerFrom` leans on anybody you have dealt with *today*,
 * because a cold open is the room choosing somebody to send. This is the
 * opposite direction: you are mid-exchange, and the person likeliest to field
 * the next sentence is the one already turned towards you. Somebody who heard
 * you is not somebody the room sent, so the two keep separate dials even where
 * they share the draw.
 *
 * **Three things decide who counts as open, and each one is a defect avoided.**
 *
 * - **Spoken only** (`isSpokenLine`, the medium rule — one home for it, in
 *   `officeImThreads.js`). A typed Slop Chat™ thread is not a conversation the
 *   room can hear. This is also the difference between working and inverted
 *   after a reload: `persistImHistory` keeps Slop Chat lines and drops talk, so
 *   a restored session's `imHistory` is *entirely* typed, and a consumer
 *   without this predicate would thumb the scale towards whoever you last
 *   messaged yesterday.
 * - **Inbound only.** Your own line is written into `imHistory` attributed to
 *   whoever the roll just picked — including on the `ignored` shape, where
 *   nobody answered at all. Counting outbound would let one coin flip that
 *   ignored you become your "open partner" for the rest of the window, which is
 *   a bias with nothing behind it.
 * - **A window** (`OFFICE_TALK_OPEN_WINDOW_MS`). An exchange you walked away
 *   from two minutes ago is over, and closing it on the clock is what keeps
 *   this a reaction rather than a standing preference. It is also why the
 *   thumb needs no decay table: the window is the decay.
 *
 * **A thumb, not a gate, and the composer is the argument.** The lane has a
 * directed mode — the roster sets a target chip and a named colleague always
 * answers (`shape: 'turnedTo'`). If an open conversation *captured* the
 * undirected act, the two acts would collapse into one and the chip would mean
 * nothing. So an open partner is four times as likely as any one stranger and
 * still not the favourite: pressing the chip is how you make it certain.
 *
 * **The draw is `ambientSpeakerFrom`'s, deliberately.** Extra lottery tickets
 * over the cast everybody already belongs to is one implementation in this
 * office, with the properties the prop-news slice paid for — nobody reaches
 * zero, a weight cannot dominate, ineligible ids (a senior you were talking to,
 * when the shape needs a body that can cross the floor) get no tickets by
 * construction, duplicate entries stay meaningful, and `0` tickets is the
 * uniform draw this office shipped with. Two facts, two dials, one draw.
 *
 * **Record, never trigger** (ADR-0010). Nothing here writes, schedules or
 * subscribes: `imHistory` is passed in and sampled at the moment you speak,
 * exactly as the hour and the office log are.
 */

import { ambientSpeakerFrom } from './officeAmbientSpeaker.js';
import { isSpokenLine } from './officeImThreads.js';
import { OFFICE_TALK_OPEN_TICKETS, OFFICE_TALK_OPEN_WINDOW_MS } from './officeCadence.js';

/**
 * Whose conversation with you is still open — ids that have *said something to
 * you out loud* inside the window, most recent first, deduped.
 *
 * Assumes `imHistory` is append-ordered by `createdAt`, which is the only way
 * the store ever writes it: the scan runs backwards and stops at the first
 * spoken line older than the window.
 *
 * @param {Array<object> | null | undefined} imHistory as the store holds it
 * @param {{ nowMs?: number, windowMs?: number }} [options]
 * @returns {string[]}
 */
export function openTalkPartnersFrom(imHistory, { nowMs, windowMs } = {}) {
  if (!Array.isArray(imHistory) || imHistory.length === 0) return [];
  const now = Number.isFinite(nowMs) ? Number(nowMs) : Date.now();
  const span = Number.isFinite(windowMs)
    ? Math.max(0, Number(windowMs))
    : OFFICE_TALK_OPEN_WINDOW_MS;
  const oldest = now - span;

  /** @type {string[]} */
  const ids = [];
  for (let i = imHistory.length - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    // The medium rule first: speech only, however the line is addressed.
    if (!isSpokenLine(msg)) continue;
    // You saying something is not somebody answering it.
    if (msg.outbound) continue;
    const at = Number(msg.createdAt);
    if (!Number.isFinite(at)) continue;
    if (at < oldest) break;
    const id = msg.colleagueId;
    if (typeof id !== 'string' || !id || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

/**
 * Draw who answers an undirected line, with anybody mid-conversation with you
 * holding extra tickets. `null` only when there is nobody to draw.
 *
 * @param {string[]} cast ids eligible for this answer shape — one entry per
 *   chance, so repeats are weight rather than a mistake
 * @param {string[]} [openIds] as `openTalkPartnersFrom` returns them
 * @param {() => number} [random]
 * @param {number} [tickets] extra entries per open partner; `0` is a uniform draw
 * @returns {string | null}
 */
export function talkAnswererFrom(
  cast,
  openIds = [],
  random = Math.random,
  tickets = OFFICE_TALK_OPEN_TICKETS
) {
  return ambientSpeakerFrom(cast, openIds, random, tickets);
}

export default talkAnswererFrom;
