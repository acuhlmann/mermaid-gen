/**
 * The room breathing when nothing is scripted
 * (docs/office-isometric-mode.md § 5 slice 11).
 *
 * One colleague at a time leaves their desk, stands at a prop for a few
 * seconds, and walks back. **One** is a decision, not a limitation: the brief
 * is a room that breathes, not one that bustles, and a single walker is one
 * `useWalkAnimation` whose interactions with everything else are countable on
 * one hand. Ten eligible colleagues on a ~20 s cadence is plenty of life.
 *
 * Like `useFloorPresence`, this **produces nothing** — no moment fires, no
 * store is written, and the whole thing dies when you sit down, because the
 * floor unmounts. That is what keeps it ambient rather than agency
 * (`office-parody.md` § 11): the instant a wanderer could say something they
 * would be a walk-by, and walk-bys belong to the moment store.
 *
 * It is the first floor-only state about **somebody else**, which is the one
 * genuinely new thing here, and it means ambience must always lose. Three ways
 * it yields, all of them "somebody who outranks me wants this":
 *
 * 1. A meeting takes the room, or a real moment claims the wanderer (a scene, a
 *    walk-by) — they are cleared outright, because whatever claimed them is
 *    already rendering them somewhere else and § 6 rule 5 does not allow two.
 * 2. **You** head for the tile they are standing on. They walk home.
 * 3. Reduced motion: no trip ever starts. Without an animation engine a walk is
 *    a teleport, and a colleague blinking between their desk and the kitchen is
 *    not calmer than one walking there — it is unexplained. Slice 10 made
 *    reduced motion a decision; this is the first slice to decide *against*
 *    doing something at all.
 *
 * Slice 12 added a fourth, and it is the same rule wearing the opposite face:
 * `holdId` **stops the clock** while you have their card open or are stood in
 * front of them talking. Ambience still loses — it loses by waiting instead of
 * by leaving. Without it a conversation you crossed the room for gets four to
 * nine seconds before the other party wanders off mid-sentence, and the card you
 * are reading describes somebody who has gone.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { liveTileOf, prefersReducedMotion } from './useWalkAnimation.js';
import { seatFor } from '../../utils/officeFloorPlan.js';
import { sameTile } from '../../utils/officeFloorMovement.js';
import { wanderTripsFor, wanderingSeatIds } from '../../utils/officeFloorWander.js';

/** Long enough that the floor is not a train station; short enough to notice. */
const FIRST_TRIP_MS = [4_000, 9_000];
const BETWEEN_TRIPS_MS = [11_000, 24_000];
const DWELL_MS = [4_000, 9_000];

function jitter([low, high]) {
  return low + Math.random() * (high - low);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * @typedef {{
 *   seatId: string,
 *   kind: string,
 *   from: { x: number, y: number },
 *   to: { x: number, y: number },
 *   phase: 'out' | 'dwell' | 'home',
 *   leg: number
 * }} WanderTrip
 */

/**
 * Somebody to send somewhere, or `null` when there is nobody free.
 *
 * @param {string[]} busy
 * @param {{ x: number, y: number } | null} avoid
 * @returns {WanderTrip | null}
 */
function departure(busy, avoid) {
  const free = wanderingSeatIds().filter((id) => !busy.includes(id));
  if (free.length === 0) return null;

  const seatId = pick(free);
  // Never send somebody to the tile you are on or walking to: the room's
  // standability rules do not know about wanderers, so this is the only thing
  // stopping two figures sharing a square.
  const options = wanderTripsFor(seatId).filter((trip) => !sameTile(trip.mark, avoid));
  if (options.length === 0) return null;

  const { kind, mark } = pick(options);
  const seat = seatFor(seatId);
  return { seatId, kind, from: { x: seat.x, y: seat.y }, to: mark, phase: 'out', leg: 1 };
}

/**
 * @param {{
 *   suspended?: boolean,
 *   busyIds?: string[],
 *   avoidTile?: { x: number, y: number } | null,
 *   holdId?: string | null
 * }} options `busyIds` is `awayFromDeskIds` — whoever a real moment already has.
 *   `avoidTile` is where *you* are or are heading, which is one rule covering
 *   two cases: walking up to use a prop, and free-roaming onto its mark.
 *   `holdId` is whoever you have engaged — their card is open, or you are
 *   talking to them — and they stay where they are until you are done.
 * @returns {{
 *   wanderer: WanderTrip | null,
 *   handleArrive: () => void,
 *   figureRef: { current: HTMLElement | null }
 * }}
 */
export function useFloorWander({
  suspended = false,
  busyIds = [],
  avoidTile = null,
  holdId = null
} = {}) {
  const [wanderer, setWanderer] = useState(null);
  const departures = useRef(0);
  /** The walking element, so an interrupted trip can be turned round in place. */
  const figureRef = useRef(null);

  /*
   * Read at fire time rather than depended on. `busyIds` contains you whenever
   * you are on your feet, so scheduling off it would restart the countdown on
   * every step you take and nobody would ever get up.
   */
  const latest = useRef({ busyIds, avoidTile });
  useEffect(() => {
    latest.current = { busyIds, avoidTile };
  });

  const goHome = useCallback(() => {
    setWanderer((current) => {
      if (!current || current.phase === 'home') return current;
      const seat = seatFor(current.seatId);
      if (!seat) return null;
      return {
        ...current,
        phase: 'home',
        /*
         * § 6 rule 19's sibling, and the wanderer is the second walker it
         * applies to: a new leg re-places the figure at its new path's start,
         * so turning somebody round mid-stride snaps them forward onto the mark
         * they had not reached yet and *then* walks them back. `liveTileOf`
         * reads where they actually got to off the running transform. You can
         * claim their square while they are still walking to it, so this is a
         * reachable state rather than a theoretical one.
         */
        from: liveTileOf(figureRef.current) ?? current.to,
        to: { x: seat.x, y: seat.y },
        leg: current.leg + 1
      };
    });
  }, []);

  /** Arrived: out means settle in for a bit, home means the trip is over. */
  const handleArrive = useCallback(() => {
    setWanderer((current) => {
      if (current?.phase === 'out') return { ...current, phase: 'dwell' };
      if (current?.phase === 'home') return null;
      return current;
    });
  }, []);

  // Nobody out: count down to the next departure.
  useEffect(() => {
    if (suspended || wanderer || prefersReducedMotion()) return undefined;
    const wait = jitter(departures.current === 0 ? FIRST_TRIP_MS : BETWEEN_TRIPS_MS);
    const timer = setTimeout(() => {
      const trip = departure(latest.current.busyIds, latest.current.avoidTile);
      if (!trip) return;
      departures.current += 1;
      setWanderer(trip);
    }, wait);
    return () => clearTimeout(timer);
  }, [suspended, wanderer]);

  /*
   * You have their card open, or you are stood in front of them talking. Nobody
   * walks away from you mid-sentence — the dwell clock does not start until you
   * are finished, and then it starts fresh, so leaving is what sends them back.
   * The hold is on the *card* as well as the conversation so that the verbs a
   * card is offering cannot go stale while you read them, and so that a keyboard
   * user's focus is not pulled out from under them by a figure that unmounts.
   */
  const held = Boolean(wanderer) && wanderer.seatId === holdId;

  // Standing at the machine: count down to going back.
  useEffect(() => {
    if (wanderer?.phase !== 'dwell' || held) return undefined;
    const timer = setTimeout(goHome, jitter(DWELL_MS));
    return () => clearTimeout(timer);
  }, [wanderer, held, goHome]);

  /*
   * Ambience always loses. A meeting or a scene is already drawing this person
   * somewhere else, and § 6 rule 5 does not allow two of anybody — so this
   * clears rather than walking them back politely.
   */
  const claimed = wanderer ? busyIds.includes(wanderer.seatId) : false;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: synchronising to a surface that has taken this person away from us, exactly as useFloorPresence does for a meeting; deriving it would leave a stale wanderer to reappear when the scene ends)
    if (suspended || claimed) setWanderer(null);
  }, [suspended, claimed]);

  // You want that square. They were only loitering.
  const inYourWay = wanderer ? sameTile(wanderer.to, avoidTile) : false;
  useEffect(() => {
    if (inYourWay) goHome();
  }, [inYourWay, goHome]);

  return { wanderer, handleArrive, figureRef };
}

export default useFloorWander;
