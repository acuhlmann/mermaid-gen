/**
 * Getting there and getting back — the commute
 * (docs/office-isometric-mode.md § 5 slice 17).
 *
 * Until now a set piece put its cast **at** their marks: `SceneActor` and the
 * huddle ring both position a figure with `projectIso` and nothing else, so a
 * coffee break began with two people materializing at the machine and ended
 * with them vanishing back into their chairs. Walk-bys (slice 2) and ambient
 * wanderers (slice 11) had always walked; the scripted moments never did, which
 * made the busiest parts of the office the least alive.
 *
 * A **commute** is one colleague's trip to a mark and back:
 *
 *     out ──arrive──▸ there ──moment clears──▸ home ──arrive──▸ (gone)
 *
 * `out` and `home` are drawn by `FloorCommuters` as travelling figures; `there`
 * is drawn by whichever surface claimed them, exactly as before. Only one of the
 * two ever renders a given person, which is § 6 rule 5 (never two of anybody)
 * surviving the addition.
 *
 * **`home` is presentation state and nothing else** — the same argument
 * `useFloorWalker` makes for the departing walk-by, generalized to N people. The
 * office store has one truth (a moment is happening or it is not); the room
 * needs one beat more than that, in the way a CSS exit transition does, and it
 * never feeds back (ADR-0011 rule 1). Nothing here is written anywhere.
 *
 * Pure and DOM-free on purpose: the whole state machine is three functions on
 * plain values, so the interesting cases — a moment ending while somebody is
 * still walking to it, the same person claimed twice — are unit tests rather
 * than something you have to catch in a capture.
 */

import {
  COFFEE_TILES,
  BATTLE_TILES,
  HUDDLE_TILES,
  YOU_SEAT_ID,
  seatFor
} from './officeFloorPlan.js';
import { sceneParticipants } from './officeSceneCast.js';

/** @typedef {'out' | 'there' | 'home'} CommutePhase */

/**
 * @typedef {object} Commute
 * @property {string} id the colleague
 * @property {{ x: number, y: number }} from where this leg starts
 * @property {{ x: number, y: number }} to where this leg ends
 * @property {CommutePhase} phase
 * @property {string | null} hands what they walk **home** holding, never out
 * @property {number} trip increments per leg, so `walkKey` changes and the
 *   animation restarts rather than resuming someone else's route
 */

function sameTile(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

function seatTile(id) {
  const seat = seatFor(id);
  return seat ? { x: seat.x, y: seat.y } : null;
}

/**
 * Who a moment has claimed, and the tile they stand on.
 *
 * **The glass-room meeting is deliberately absent.** Its chairs are inside a
 * sealed box: the west panel spans y 5.7–8.5, the north panel x 9.4–11.5, and
 * the other two sides are the floor plate's own edge, so there is no route in
 * that does not cross glass — which is exactly why slice 5 placed attendees
 * directly. Walking them in needs either a door (a geometry change that
 * re-opens `pathCrossesGlass` for free roam and § 6 rules 17–18) or a threshold
 * with a queue, and both deserve their own slice. § 8 records the choice.
 *
 * `hands` is what the trip *gives* you, and it only applies on the way back —
 * the same split `officeFloorProps.js` draws between a prop's `verb` and its
 * `hands`. You walk to the machine empty-handed and away from it with a coffee.
 *
 * You are never here: you are drawn by `FloorPlayer` and moved by free roam
 * (`useFloorCoffeeWalk` already walks you to the machine), so a commute for
 * `you` would be the second of two people wearing your face.
 *
 * @param {{ coffee?: any, battle?: any, huddle?: any }} moments
 * @returns {Array<{ id: string, tile: { x: number, y: number }, hands: string | null }>}
 */
export function momentMarksFor({ coffee, battle, huddle } = {}) {
  /** @type {Array<{ id: string, tile: { x: number, y: number }, hands: string | null }>} */
  const marks = [];
  const claimed = new Set();

  const claim = (ids, tiles, hands) => {
    ids.forEach((id, index) => {
      // § 6 rule 5 again: whoever claimed them first draws them. Two moments
      // holding one person is a bug upstream, not something to render twice.
      if (!id || id === YOU_SEAT_ID || claimed.has(id) || !seatTile(id)) return;
      claimed.add(id);
      /*
       * The **raw** index, not a compacted one. `FloorScene` and `FloorHuddle`
       * both index their tiles by position in their own list, so a mark derived
       * from a different count is a mark the surface will not draw them at —
       * they would walk to one tile and pop to another on arrival. Skipping
       * somebody therefore leaves their slot empty rather than closing the ring
       * up, which is also the truthful picture: the gap is where the person two
       * moments are fighting over would have stood.
       */
      marks.push({ id, tile: tiles[index % tiles.length], hands: hands ?? null });
    });
  };

  claim(sceneParticipants(coffee?.lines), COFFEE_TILES, 'coffee');
  claim(sceneParticipants(battle?.lines), BATTLE_TILES, null);
  claim(huddle?.attendees ?? [], HUDDLE_TILES, null);

  return marks;
}

/**
 * The state transition: what the commutes should be, given what they were and
 * where the moments now want people.
 *
 * Four cases, and the two awkward ones are why this is a function rather than a
 * couple of lines in an effect:
 *
 * - **Still wanted, same mark** — left alone, whatever phase it is in. Without
 *   this a scene that re-renders (a new line, a vote) would restart everybody's
 *   walk on every beat.
 * - **Newly wanted** — a fresh `out` leg from their chair.
 * - **No longer wanted** — an `home` leg from wherever this leg was heading.
 *   Note `from` is the leg's destination, not their live position: somebody
 *   recalled mid-stride snaps to the mark and walks back from it, which is a
 *   visible cheat of at most one leg and much cheaper than reading transforms
 *   back off the DOM for a case that lasts under a second.
 * - **Wanted again while walking home** — a new `out` leg starting from where
 *   that home leg was going, so they turn round rather than teleporting.
 *
 * @param {Commute[]} prev
 * @param {Array<{ id: string, tile: { x: number, y: number }, hands: string | null }>} marks
 * @param {{ seed?: boolean }} [options] `seed` puts every new commute straight
 *   into `there`. Used for the first pass only: standing up into a coffee break
 *   that is already running should show two people at the machine, not two
 *   people setting off for it after the fact.
 * @returns {Commute[]}
 */
export function nextCommutes(prev, marks, { seed = false } = {}) {
  const before = new Map(prev.map((commute) => [commute.id, commute]));
  /** @type {Commute[]} */
  const next = [];
  const wanted = new Set();

  for (const mark of marks) {
    wanted.add(mark.id);
    const current = before.get(mark.id);
    if (current && current.phase !== 'home' && sameTile(current.to, mark.tile)) {
      next.push(current);
      continue;
    }
    const from = current ? current.to : seatTile(mark.id);
    if (!from) continue;
    next.push({
      id: mark.id,
      from,
      to: mark.tile,
      phase: seed ? 'there' : 'out',
      hands: mark.hands ?? null,
      trip: (current?.trip ?? 0) + 1
    });
  }

  for (const commute of prev) {
    if (wanted.has(commute.id)) continue;
    if (commute.phase === 'home') {
      next.push(commute);
      continue;
    }
    const home = seatTile(commute.id);
    if (!home) continue;
    next.push({
      id: commute.id,
      from: commute.to,
      to: home,
      phase: 'home',
      hands: commute.hands,
      trip: commute.trip + 1
    });
  }

  return next;
}

/**
 * One walker reports arrival: an `out` leg settles at its mark, a `home` leg is
 * over and the commute stops existing.
 *
 * Returns the same array when nothing changed, so a duplicate arrival (the
 * walk hook can settle more than once across a reduced-motion remount) does not
 * churn React state.
 *
 * @param {Commute[]} list
 * @param {string} id
 * @returns {Commute[]}
 */
export function arriveCommute(list, id) {
  let changed = false;
  /** @type {Commute[]} */
  const next = [];
  for (const commute of list) {
    if (commute.id !== id || commute.phase === 'there') {
      next.push(commute);
      continue;
    }
    changed = true;
    if (commute.phase === 'out') next.push({ ...commute, phase: 'there' });
    // A finished `home` leg is simply dropped — they are back in their chair,
    // and the seat loop draws them again the moment they leave `awayIds`.
  }
  return changed ? next : list;
}

/**
 * A stable identity for a set of marks, so an effect can fire on *what the
 * moments want* rather than on the array literal a render happens to build.
 *
 * @param {Array<{ id: string, tile: { x: number, y: number } }>} marks
 * @returns {string}
 */
export function marksKey(marks) {
  return marks.map((mark) => `${mark.id}@${mark.tile.x},${mark.tile.y}`).join('|');
}

export default momentMarksFor;
