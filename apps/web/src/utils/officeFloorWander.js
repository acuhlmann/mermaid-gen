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
 *
 * `wanderHabitFor` is that pay-off collected a second time, for *where* rather
 * than *who*. Until it existed the only thumb on the scale was the hour
 * (`wanderBiasAt`), one global row that moved every persona alike, so the
 * printer belonged to nobody and the kitchen belonged to the clock. A habit is
 * again nothing new: `deskDoingFor` already says what is in somebody's hand at
 * their desk and `propHandsFor` already says what each prop puts in a hand, so
 * a colleague's errand is the prop that refills what they are holding. No row
 * was added to any table, and the whiteboard belongs to nobody because it hands
 * nothing over.
 */

import {
  YOU_SEAT_ID,
  FLOOR_SEATS,
  pathCrossesGlass,
  seatFor,
  walkPathBetween
} from './officeFloorPlan.js';
import { propTileFor, usablePropKinds } from './officeFloorMovement.js';
import { deskDoingFor } from './officeFloorActivity.js';
import { propHandsFor } from './officeFloorProps.js';

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

/**
 * How much likelier an errand is to be somebody's own habitual one.
 *
 * The same number as `WANDER_BIAS_WINDOWS`' weight, for the same reason its
 * doc gives: three reads as a trend over the handful of trips a visit
 * contains, and does not make the other two props look broken. It is also the
 * same *kind* of number — a multiplier against a uniform pick, so a colleague
 * whose habit is the printer still goes for coffee, just less often than the
 * colleague beside them who has no habit at all.
 *
 * Module-private: the number is an implementation detail of
 * `wanderTripWeight`, and anybody who needs it can read it off
 * `wanderHabitFor(id).weight` rather than import a constant.
 */
const WANDER_HABIT_WEIGHT = 3;

/**
 * The one place `FLOOR_HOLDS` names the same object twice.
 *
 * `officeFloorProps.js` documents the distinction in its own words: `coffee` is
 * "what the machine hands you" and `mug` is "the one you keep at your desk, as
 * opposed to the one the machine gave you". They are one errand at two stages,
 * so somebody sat at their desk with a `mug` is refilled by the prop that hands
 * out `coffee`. `papers` needs no alias — the printer hands over exactly what
 * Jared is already reading.
 *
 * @type {Readonly<Record<string, string>>}
 */
const HOLD_REFILLED_BY = Object.freeze({ mug: 'coffee' });

/**
 * The prop that would put this hold back in somebody's hand, or `null`.
 *
 * @param {string | null} hold one of `FLOOR_HOLDS`, or `null` for empty hands
 * @returns {string | null}
 */
function propThatRefills(hold) {
  if (!hold) return null;
  const handed = HOLD_REFILLED_BY[hold] ?? hold;
  return usablePropKinds().find((kind) => propHandsFor(kind) === handed) ?? null;
}

/** @type {Map<string, { kind: string, weight: number } | null> | null} */
let habits = null;

/** @internal test hook — habits memoize across calls; reset between clock reads. */
export function _resetWanderHabitsForTests() {
  habits = null;
}

/**
 * The errand this colleague runs more than the others do, or `null` for the
 * majority of the roster.
 *
 * **Nothing is written down.** Like `wanderingSeatIds`, this is an answer two
 * tables the room already keeps give when you hold them against each other:
 * `deskDoingFor` says what is in somebody's hand at their desk, `propHandsFor`
 * says what each prop puts in a hand, and a habit is the prop that refills the
 * thing they are already holding. Jared is reading a stack of printouts, so the
 * printer is Jared's; Greybeard has a mug, so the kitchen is Greybeard's.
 *
 * Three consequences worth stating, because each looks like a gap and is not:
 *
 * - **The whiteboard belongs to nobody**, because it hands nothing over — the
 *   same "honest answer rather than a gap" `FLOOR_PROP_USES` already gives for
 *   the thing you cannot carry away.
 * - **Six of the eleven have no habit**, because `typing`, `headset` and
 *   `phone` leave the hands empty or hold something no prop on this floor
 *   dispenses. They are picked from exactly as before, which is what keeps
 *   this a bias rather than a rota.
 * - **`deskDoingFor`, never `baseDoingFor`.** A habit is a fact about a person
 *   and must not become a fourth face of the clock: `PHASE_ART` puts a mug in
 *   every hand through `earlyMorning` and papers in every hand through
 *   `windDown`, so reading the phased art would hand the whole roster the same
 *   habit twice a day and tell the same thing the light already tells.
 *
 * @param {string} seatId
 * @returns {{ kind: string, weight: number } | null}
 */
export function wanderHabitFor(seatId) {
  habits ??= new Map(
    wanderingSeatIds().map((id) => {
      const kind = propThatRefills(deskDoingFor(id).hold);
      // A habit they cannot walk to is not a habit. The glass decides this for
      // `hr`, who can reach the printer and never the kitchen.
      const reachable = kind !== null && wanderTripsFor(id).some((trip) => trip.kind === kind);
      return [id, reachable ? { kind, weight: WANDER_HABIT_WEIGHT } : null];
    })
  );
  return habits.get(seatId) ?? null;
}

/**
 * The thumb on the scale for one colleague's one possible errand.
 *
 * **The larger of the two multipliers, never their product.** The hour and the
 * habit make the same claim about the same pick ("this errand is likelier to
 * end here"), and compounding them would put a mug-carrier nine times over the
 * machine between two and half four — a rota, which is precisely what
 * `WANDER_BIAS_WINDOWS` says it is not. Taking the larger reads as the room
 * does: the slump pulls anybody who has no habit of their own, and it cannot
 * pull somebody harder than their own habit already does. So at three in the
 * afternoon the floor drifts to the kitchen **and the printer people are still
 * going to the printer**, which is the whole point of giving them one.
 *
 * @param {string} seatId
 * @param {string} kind a prop kind from `wanderTripsFor(seatId)`
 * @param {{ kind: string, weight: number } | null} [bias] `wanderBiasAt()`
 * @returns {number} a whole-number multiplier against a uniform pick
 */
export function wanderTripWeight(seatId, kind, bias = null) {
  const habit = wanderHabitFor(seatId);
  return Math.max(
    habit && habit.kind === kind ? habit.weight : 1,
    bias && bias.kind === kind ? bias.weight : 1
  );
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
