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
 * `wanderNewsFrom` is the one input here that is about **you**, and it is the
 * reason this module's "produces nothing" licence still holds. It writes
 * nothing, says nothing and schedules nothing: the errand clock is untouched
 * and only the *destination* changes, because the thing you just did to a prop
 * is the one fact in this room that makes a tile worth walking to. Until it
 * existed every ambient trip on this floor was decided by a clock and a trait
 * row, so the honest answer to "did anything happen because of me" was no.
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
import { OFFICE_PROP_NEWS_WINDOW_MS } from './officeCadence.js';

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
 *
 * `wanderNewsFrom` spends the same number for the argument in
 * `wanderTripWeight`'s doc — the three thumbs on this scale are peers, so one
 * constant is the honest way to say so.
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
 * The prop you were last at, while that is still news, or `null`.
 *
 * The third thumb on the scale, and the first one that is about **you**. The
 * printer and the whiteboard are the two props § 8 says nothing ever sends
 * anybody to — the hour favours the kitchen and a habit is the prop that
 * refills somebody's hand, which neither of them does. Using one is the room's
 * one standing invitation to go and look: a sheet came out of the printer, or
 * there is something on the board that was not there before.
 *
 * **Nothing new is written, and nothing new fires.** The office log already
 * records a verb-less prop use as `{ kind: 'prop', detail: <propKind> }`
 * (`useFloorPropUse.js`), so this is the same read-two-tables-against-each-other
 * trick `wanderHabitFor` is, with the log as one of the tables. The errand
 * clock is not touched: a trip that was going to start still starts, and only
 * its destination knows you were there. That is the line between *record* and
 * *trigger* (ADR-0010) — the room notices, it does not get summoned.
 *
 * **The newest entry or nothing.** Scanning back to the first `prop` entry and
 * then testing its age is deliberate: the log is chronological, so the newest
 * one is the last thing you did, and an older fresh entry behind a stale newer
 * one cannot exist. "The last thing you did" also needs no tie-break, which
 * "any prop inside the window" would.
 *
 * **Both guards are refusals rather than defence.** A prop kind the room can no
 * longer give anybody a mark for is not somewhere to be sent (the same check
 * `wanderHabitFor` makes against `wanderTripsFor`), and a fact older than
 * `OFFICE_PROP_NEWS_WINDOW_MS` is not news. Standing *on* the prop needs no
 * guard at all and that is worth stating: `useFloorWander`'s own `avoidTile`
 * already drops the mark you are at or walking to, so the pull can only ever
 * land after you have walked away — which is exactly when somebody going to
 * look at what you left is the fiction rather than a collision.
 *
 * @param {Array<{at?: number, kind?: string, detail?: string}>} [officeLog]
 *   `getOfficeLogSnapshot()`, sampled by the caller — this module stays pure
 *   and subscribes to nothing.
 * @param {number} [now]
 * @returns {{ kind: string, weight: number } | null}
 */
export function wanderNewsFrom(officeLog = [], now = Date.now()) {
  const log = Array.isArray(officeLog) ? officeLog : [];
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    if (entry?.kind !== 'prop') continue;
    if (!(now - entry.at < OFFICE_PROP_NEWS_WINDOW_MS)) return null;
    return usablePropKinds().includes(entry.detail)
      ? { kind: entry.detail, weight: WANDER_HABIT_WEIGHT }
      : null;
  }
  return null;
}

/**
 * The thumb on the scale for one colleague's one possible errand.
 *
 * **The largest of the three multipliers, never their product.** The hour, the
 * habit and the news make the same claim about the same pick ("this errand is
 * likelier to end here"), and compounding them would put a mug-carrier nine
 * times over the machine between two and half four — a rota, which is precisely
 * what `WANDER_BIAS_WINDOWS` says it is not. Taking the largest reads as the
 * room does: the slump pulls anybody who has no habit of their own, and it
 * cannot pull somebody harder than their own habit already does. So at three in
 * the afternoon the floor drifts to the kitchen **and the printer people are
 * still going to the printer**, which is the whole point of giving them one.
 *
 * **All three weigh the same, which makes them peers rather than a ladder.**
 * `floorActivityFor`'s precedence would say the live fact outranks the general
 * one and give the news a bigger number — but `Math.max` turns "bigger" into
 * "strictly dominant", and a news weight of four would erase every colleague's
 * own habit every time you touched a prop. Half the roster has no habit, so at
 * equal weight the news pulls *them* and merely ties for the rest: the room
 * drifts toward the thing you did without the whole floor marching to it, which
 * is interest rather than a rota. That it is also "the same kind of number" the
 * other two dials are is why there is one constant and not three.
 *
 * @param {string} seatId
 * @param {string} kind a prop kind from `wanderTripsFor(seatId)`
 * @param {{ kind: string, weight: number } | null} [bias] `wanderBiasAt()`
 * @param {{ kind: string, weight: number } | null} [news] `wanderNewsFrom()`
 * @returns {number} a whole-number multiplier against a uniform pick
 */
export function wanderTripWeight(seatId, kind, bias = null, news = null) {
  const habit = wanderHabitFor(seatId);
  return Math.max(
    habit && habit.kind === kind ? habit.weight : 1,
    bias && bias.kind === kind ? bias.weight : 1,
    news && news.kind === kind ? news.weight : 1
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
