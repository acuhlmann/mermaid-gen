/**
 * Ambient floor life — who leaves their desk, and where they go
 * (docs/office-isometric-mode.md § 5 slice 11).
 *
 * **This produces nothing**, and that is what licenses it under
 * `office-parody.md` § 11. Nobody speaks, nobody pitches, nothing is written to
 * a store: a colleague walks to the coffee machine, stands there, and walks
 * back. Ambient content is timer-driven and canned-heavy on a tiny budget, and
 * this is the cheapest possible reading of that — the budget here is zero,
 * because motion is not content. The moment a wanderer could say something it
 * would be a walk-by, and walk-bys belong to the moment store.
 *
 * Nothing new is derived. A wander mark **is** a prop mark (`propTileFor`), so
 * every geometry rule in § 6 that validated where *you* stand to use the coffee
 * machine is validating where Chad stands to loiter at it — one definition of
 * "somebody could stand here and be seen", as § 6 rule 17's note asks for. The
 * only per-person question is whether they can get there, and that is
 * `pathCrossesGlass` again.
 *
 * The pay-off is the same one slice 6 got from `peekTileFor`: **who wanders is
 * an answer the room gives, not a list somebody maintains.** Leadership sit
 * behind glass with no route out, so they never leave their desks — the
 * fishbowl seals in both directions, and nobody had to write down that
 * executives do not fetch their own coffee.
 */

import {
  YOU_SEAT_ID,
  FLOOR_SEATS,
  pathCrossesGlass,
  seatFor,
  walkPathBetween
} from './officeFloorPlan.js';
import { propTileFor, usablePropKinds } from './officeFloorMovement.js';

/**
 * @typedef {{ kind: string, mark: { x: number, y: number } }} WanderTrip
 *   Somewhere a colleague can walk to and stand, named by the prop that makes
 *   it a *place* rather than a tile. The name is what stops the fiction reading
 *   as a bug: "Pam is at the printer" is an office, "Pam is standing in the
 *   middle of the room" is a broken layout.
 */

/**
 * Everywhere this colleague could plausibly wander off to.
 *
 * @param {string} seatId
 * @returns {WanderTrip[]} empty for you, for anybody without a desk to leave,
 *   and for anybody the glass has sealed in.
 */
export function wanderTripsFor(seatId) {
  const seat = seatFor(seatId);
  if (!seat || !seat.desk || seat.id === YOU_SEAT_ID) return [];

  const from = { x: seat.x, y: seat.y };
  const trips = [];
  for (const kind of usablePropKinds()) {
    const mark = propTileFor(kind);
    if (!mark) continue;
    // The room's own answer to "can they get out of there", and the reason no
    // list of who stays put exists.
    if (pathCrossesGlass(walkPathBetween(from, mark, seatId))) continue;
    trips.push({ kind, mark });
  }
  return trips;
}

/** @type {string[] | null} */
let roster = null;

/**
 * Everybody who ever gets up. Order follows the seat roster.
 *
 * Computed once, like `usablePropKinds`: the answer depends only on module
 * constants, and each call is a route cost per colleague per prop.
 *
 * @returns {string[]}
 */
export function wanderingSeatIds() {
  roster ??= FLOOR_SEATS.map((seat) => seat.id).filter((id) => wanderTripsFor(id).length > 0);
  return roster;
}
