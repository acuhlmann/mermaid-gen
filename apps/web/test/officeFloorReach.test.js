import { describe, expect, it } from 'vitest';
import { reachTileFor, whereaboutsOf } from '../src/utils/officeFloorReach.js';
import { approachTileFor, propTileFor } from '../src/utils/officeFloorMovement.js';
import { wanderTripsFor } from '../src/utils/officeFloorWander.js';
import { YOU_SEAT_ID, seatFor } from '../src/utils/officeFloorPlan.js';

/**
 * Reaching somebody who is not at their desk (slice 12).
 *
 * The whole of what this module decides is *whether somebody is anywhere*, and
 * the two answers that are not a tile matter more than the one that is: a walker
 * is nowhere (a moving target is a coin flip) and somebody a moment has claimed
 * is somewhere the room will not send you (§ 6 rule 5 — whatever claimed them is
 * already drawing them, with chrome of its own).
 */

const PRINTER = () => propTileFor('printer');

function trip(phase, seatId = 'intern', kind = 'printer') {
  return { seatId, kind, from: { x: 0, y: 0 }, to: propTileFor(kind), phase, leg: 1 };
}

describe('whereaboutsOf', () => {
  it('says nothing at all about somebody in their own chair', () => {
    // And says it as the *same* `null` every time, which is what lets the person
    // card's memo hold for the overwhelmingly common selection.
    expect(whereaboutsOf('intern', { wanderer: null, awayIds: [] })).toBeNull();
    expect(whereaboutsOf('intern', {})).toBeNull();
    expect(whereaboutsOf(null, {})).toBeNull();
  });

  it('puts a settled wanderer at the prop they are stood at', () => {
    expect(whereaboutsOf('intern', { wanderer: trip('dwell') })).toEqual({
      tile: PRINTER(),
      propKind: 'printer'
    });
  });

  it('gives a walking wanderer no tile, in either direction', () => {
    /*
     * Only a settled figure is anywhere. A mark derived from a tile they are
     * still walking towards is a mark they will not be at, and a hit target that
     * is crossing the room is a coin flip — so both legs of a trip are "away,
     * nowhere", and `FloorWanderer` renders no button for either.
     */
    for (const phase of ['out', 'home']) {
      expect(whereaboutsOf('intern', { wanderer: trip(phase) }), phase).toEqual({
        tile: null,
        propKind: 'printer'
      });
    }
  });

  it('gives somebody a moment has claimed no tile either', () => {
    // A coffee mark and a chair in the glass room are both somewhere; neither is
    // somewhere this module derives an approach to.
    expect(whereaboutsOf('intern', { awayIds: ['intern', 'refine'] })).toEqual({
      tile: null,
      propKind: null
    });
  });

  it('is about the person asked for, not about whoever happens to be up', () => {
    const state = { wanderer: trip('dwell', 'refine'), awayIds: [] };
    expect(whereaboutsOf('intern', state)).toBeNull();
    expect(whereaboutsOf('refine', state)?.tile).toEqual(PRINTER());
  });
});

describe('reachTileFor', () => {
  it('is the plain seat approach for somebody who has not moved', () => {
    expect(reachTileFor('intern', null)).toEqual(approachTileFor('intern'));
    expect(reachTileFor('intern')).toEqual(approachTileFor('intern'));
  });

  it('follows them to where they are standing', () => {
    const where = whereaboutsOf('intern', { wanderer: trip('dwell') });
    const mark = reachTileFor('intern', where);

    expect(mark).toEqual(approachTileFor('intern', { at: PRINTER() }));
    // The point of the slice: the verb no longer aims at the chair they left.
    expect(mark).not.toEqual(approachTileFor('intern'));
    const seat = seatFor('intern');
    expect(Math.hypot(mark.x - PRINTER().x, mark.y - PRINTER().y)).toBeLessThan(
      Math.hypot(mark.x - seat.x, mark.y - seat.y)
    );
  });

  it('refuses whoever is mid-stride or claimed, which is what unrenders the verb', () => {
    /*
     * Slice 9's rule finishes this sentence: a control the room cannot honour
     * does not render. `null` here is what takes _Go and talk_ off the card,
     * rather than disabling it and explaining itself.
     */
    expect(reachTileFor('intern', whereaboutsOf('intern', { wanderer: trip('out') }))).toBeNull();
    expect(reachTileFor('intern', whereaboutsOf('intern', { awayIds: ['intern'] }))).toBeNull();
  });

  it('keeps leadership out of reach by keeping them in the fishbowl', () => {
    expect(reachTileFor('cfo', null)).toBeNull();
    expect(reachTileFor(YOU_SEAT_ID, null)).toBeNull();

    /*
     * And the reason is worth pinning, because it is not a list. Handed a body
     * on the open floor this module would happily send you over — a CFO standing
     * at the printer is somebody you can talk to. What keeps that from happening
     * is that there is no route out of the glass (`wanderTripsFor` is empty for
     * all four), so the position never arises. § 6 rule 17's payoff again: the
     * room refuses by being a room, and nobody maintains who is off-limits.
     */
    expect(reachTileFor('cfo', { tile: PRINTER(), propKind: 'printer' })).toBeTruthy();
    expect(wanderTripsFor('cfo')).toEqual([]);
  });
});
