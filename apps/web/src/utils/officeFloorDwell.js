/**
 * Standing next to somebody for too long
 * (docs/office-isometric-mode.md § 5 slice 19).
 *
 * Slice 18 gave the floor a voice for one event it already raised. This one adds
 * the **signal that was missing**: how long you have been stood next to
 * somebody. That is the difference between the two slices and it is worth
 * stating plainly — nothing in the room reports loitering, so this is the first
 * floor mechanic with a trigger of its own rather than a line attached to an
 * existing one.
 *
 * It exists because the talk verb deliberately leaves a silence.
 * `OfficeLayer`'s `handleTalkGreet` is an empty function with a one-line reason
 * — _"user speaks first — no auto-opener when walking up to someone"_ — so
 * walking over to a colleague and not typing produces nothing at all. That is
 * right for a conversation you opened and wrong for a room: in an office the
 * other person eventually looks up. Dwell fills exactly that gap and duplicates
 * none of it. Walk over and type, and it is a conversation; walk over and stand
 * there, and they break the silence.
 *
 * **Reactive, by §11's own test.** You crossed the room and stayed, so you
 * started it, and it cannot fire while you are sitting still or walking past.
 * That is why the line is allowed to be an LLM call in persona rather than a
 * bank entry — the thing the whole office layer exists to avoid is a canned
 * answer to something the user did on purpose.
 *
 * **Range is `NAME_CHIP_RANGE_TILES`, and reusing it is the point.** Slice 15
 * already decided what "next to somebody" means on this floor and lights their
 * name chip at exactly that distance, so the person who is about to speak is
 * the person whose name is showing. A second radius would put the two out of
 * step and there would be no way to tell from the room which one was in force.
 */

import { tierOf } from './castTiers.js';
import { whereaboutsOf } from './officeFloorReach.js';
import {
  FLOOR_SEATS,
  NAME_CHIP_RANGE_TILES,
  YOU_SEAT_ID,
  tileDistance
} from './officeFloorPlan.js';

/**
 * @typedef {{ colleagueId: string, at: { x: number, y: number } | null }} DwellTarget
 *   `at` follows `whereaboutsOf`'s convention exactly: **null means they are in
 *   their own chair**, and a tile means they are stood somewhere else. That is
 *   not laziness about the seat lookup — it is what `FloorDeskSpeech` needs to
 *   pick between the over-seat and over-standing lift (§ 6 rules 15 and 20), so
 *   passing a resolved tile for everybody would put every seated colleague's
 *   balloon a tile above their head.
 */

/**
 * Who you are stood next to, or `null` — which is the answer almost all of the
 * time, including whenever you are sitting down.
 *
 * Whereabouts come from `whereaboutsOf`, the same question the person card and
 * the speech bubble ask, so this cannot disagree with them about where somebody
 * is. Three exclusions, and only one of them is about manners:
 *
 * - **You.** Obviously.
 * - **The `senior` tier**, because of the **glass**, not because executives are
 *   above being spoken to. `tileDistance` is Chebyshev and the leadership seats
 *   sit at y 0–1, so a perfectly ordinary standable tile at y 2 is one tile from
 *   Jack Barker with a sealed panel in between (§ 6 rules 17–18). `talkTileFor`
 *   draws the same line for the same reason.
 * - **Anybody a moment has claimed**, which `whereaboutsOf` reports as a `null`
 *   tile. § 6 rule 5 does not allow two of anybody, and a colleague in a coffee
 *   scene is already being drawn by a surface with its own chrome. This also
 *   covers a walker mid-stride: somebody crossing your square is not somebody
 *   you are stood next to.
 *
 * Ties break on `FLOOR_SEATS` order rather than at random. In the pod you are
 * regularly within a tile of two people at once, and a random pick would let the
 * speaker change on an unrelated re-render — the same beat, credited to a
 * different person, for no reason you could see.
 *
 * @param {{ x: number, y: number } | null} youTile
 * @param {{ wanderer?: unknown, awayIds?: string[] }} [floorState] from `useFloorAway`
 * @returns {DwellTarget | null}
 */
/**
 * Where this colleague is standing for the purposes of being loitered at, or
 * `null` when they are not available to be.
 *
 * Its own function rather than five guards inline, because `dwellTargetAt`
 * would otherwise ship over its complexity budget — and § 8's finding is that
 * extracting is the fix that works, since complexity is counted per function.
 * It also puts the three exclusions in one readable place.
 *
 * `tile` is where they are; `at` is what the caller passes to `FloorDeskSpeech`,
 * which is `null` for somebody in their own chair. Two fields rather than one
 * because the balloon needs the distinction and the distance does not.
 *
 * @param {{ id: string, x: number, y: number }} seat
 * @param {{ wanderer?: unknown, awayIds?: string[] }} floorState
 * @returns {{ tile: { x: number, y: number }, at: { x: number, y: number } | null } | null}
 */
function standingSpotOf(seat, floorState) {
  if (seat.id === YOU_SEAT_ID || tierOf(seat.id) === 'senior') return null;
  const where = whereaboutsOf(seat.id, floorState);
  if (!where) return { tile: { x: seat.x, y: seat.y }, at: null };
  return where.tile ? { tile: where.tile, at: where.tile } : null;
}

export function dwellTargetAt(youTile, floorState = {}) {
  if (!youTile) return null;

  let best = null;
  for (const seat of FLOOR_SEATS) {
    const spot = standingSpotOf(seat, floorState);
    if (!spot) continue;
    const distance = tileDistance(youTile, spot.tile);
    if (distance > NAME_CHIP_RANGE_TILES) continue;
    if (best && best.distance <= distance) continue;
    best = { colleagueId: seat.id, at: spot.at, distance };
  }

  return best ? { colleagueId: best.colleagueId, at: best.at } : null;
}

/**
 * The line they broke the silence with, out of the shared IM log.
 *
 * Bounded by **when the remark was asked for**, which is the whole of what
 * separates this from `useFloorActivity`'s `lastInboundFrom`. That one wants the
 * newest thing somebody ever said to you, because a conversation you opened has
 * a history. This one must not: walk up to somebody you traded messages with an
 * hour ago and their old line would appear over their head the instant you got
 * near, as though they had said it just now.
 *
 * The scan stops at the first message older than the remark rather than
 * filtering the whole log — `imHistory` is append-ordered, so everything before
 * that point is older still.
 *
 * @param {Array<{ colleagueId: string, body?: string, createdAt?: number, outbound?: boolean }>} imHistory
 * @param {{ colleagueId: string, at: number } | null} spoke from `useFloorDwell`
 * @returns {string}
 */
export function dwellLineFrom(imHistory, spoke) {
  if (!spoke) return '';
  for (let i = (imHistory?.length ?? 0) - 1; i >= 0; i -= 1) {
    const msg = imHistory[i];
    if ((msg.createdAt ?? 0) < spoke.at) return '';
    if (msg.colleagueId === spoke.colleagueId && !msg.outbound) return msg.body ?? '';
  }
  return '';
}

export default dwellTargetAt;
