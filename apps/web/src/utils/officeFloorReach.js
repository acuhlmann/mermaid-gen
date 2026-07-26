/**
 * Reaching somebody who is not at their desk
 * (docs/office-isometric-mode.md § 5 slice 12).
 *
 * Every mark family before this one was derived from a **seat**: `peekTileFor`
 * from the desk you walk over to read, `approachTileFor` from the chair you
 * stand beside. That held for eight slices because a colleague was only ever out
 * of their chair inside a moment that carried its own chrome — a set piece, a
 * meeting, a walk-by arriving at your desk with its own buttons. Ambient life
 * (slice 11) broke it: somebody is out of their chair every twenty seconds or so
 * for no reason at all, and while they are, the seat-derived verbs aim at
 * furniture.
 *
 * So the floor needs one more question answered before it can offer a verb:
 * **where are they actually stood, and is that somewhere I can be sent?** This
 * module is that question, and it is deliberately the only new thing slice 12
 * derives — `reachTileFor` is `approachTileFor` with an `at`, so the § 6 rules
 * that place every other mark are placing this one too.
 *
 * Two rules decide the answer, and both are older than this module.
 *
 * **Only a settled figure is anywhere.** Clicking somebody mid-stride is a coin
 * flip, and a mark derived from a tile they are still walking towards is a mark
 * they will not be at. So a walker has no whereabouts at all: not reachable, and
 * (in `FloorWanderer`) not clickable either.
 *
 * **Whoever claimed them already owns them.** A set piece or a meeting is
 * drawing that person somewhere with chrome of its own, and § 6 rule 5 does not
 * allow two of anybody. The room therefore hands back no mark, and slice 9's
 * rule finishes the sentence: a verb the room cannot honour does not render.
 * What the card says instead is a line about where they are, which is the honest
 * version of the "unavailable and says so" § 8 warned against — the *note* says
 * so, not a dead button.
 */

import { approachTileFor } from './officeFloorMovement.js';

/**
 * @typedef {{ tile: { x: number, y: number } | null, propKind: string | null }} Whereabouts
 *   `tile` is where they are stood, and `null` when they are somewhere this
 *   module will not send you: mid-stride, or inside a moment that has them.
 *   `propKind` names the place, because "Pam is at the printer" is an office and
 *   "Pam is at (3, 1)" is a bug report.
 */

/**
 * Where somebody is, when that is not their own chair.
 *
 * `null` — and this is the common answer — means they are sitting where the
 * floor plan says they sit, which is the static case every slice before this one
 * assumed. Returning the same `null` rather than a fresh "at their desk" object
 * is deliberate: the person card memoizes on this, and the overwhelmingly common
 * selection is somebody who has not moved.
 *
 * @param {string | null} seatId
 * @param {{
 *   wanderer?: { seatId: string, kind?: string, to: { x: number, y: number }, phase: string } | null,
 *   awayIds?: string[]
 * }} [state] `wanderer` is `useFloorWander`'s trip; `awayIds` is
 *   `awayFromDeskIds` — whoever a real moment already has.
 * @returns {Whereabouts | null}
 */
export function whereaboutsOf(seatId, { wanderer = null, awayIds = [] } = {}) {
  if (!seatId) return null;

  if (wanderer && wanderer.seatId === seatId) {
    // Out or home: on their feet between two places, which is not a place.
    const settled = wanderer.phase === 'dwell';
    return { tile: settled ? wanderer.to : null, propKind: wanderer.kind ?? null };
  }

  // A scene mark or a chair in the glass room. Both are somewhere; neither is
  // somewhere this module derives an approach to.
  if (awayIds.includes(seatId)) return { tile: null, propKind: null };

  return null;
}

/**
 * Where you stand to talk to somebody, wherever they happen to be.
 *
 * The whole of what slice 12 adds to the verb: one call that does not care
 * whether they are in their chair, and gives the same shape of answer either way
 * — a tile, or `null` for "the room cannot get you to them".
 *
 * @param {string} seatId
 * @param {Whereabouts | null} [where] from `whereaboutsOf`
 * @returns {{ x: number, y: number } | null}
 */
export function reachTileFor(seatId, where = null) {
  if (!where) return approachTileFor(seatId);
  if (!where.tile) return null;
  return approachTileFor(seatId, { at: where.tile });
}
