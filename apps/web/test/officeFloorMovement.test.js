import { describe, expect, it } from 'vitest';
import {
  sameTile,
  standableTileAt,
  standableTileAtPoint
} from '../src/utils/officeFloorMovement.js';
import {
  FLOOR_PROPS,
  FLOOR_SEATS,
  FLOOR_ZONES,
  VISITOR_TILE,
  YOU_SEAT_ID,
  isOnFloor,
  isStandableTile,
  pathCrossesGlass,
  projectIso,
  seatFor,
  walkPathBetween
} from '../src/utils/officeFloorPlan.js';

/**
 * Free roam's whole safety story is that where you may stand is *derived* from
 * the furniture rather than authored as a walkable mask (§ 7's standing habit).
 * These assertions are what turn that from a claim into a guard: a layout change
 * that opens a route into the leadership fishbowl, or parks a figure on somebody's
 * head, fails here rather than in a screenshot six slices later.
 */
const HOME = (() => {
  const seat = seatFor(YOU_SEAT_ID);
  return { x: seat.x, y: seat.y };
})();

/** Every integer tile on the plate, which is the space a click can land in. */
function everyTile() {
  const tiles = [];
  for (let x = 0; x < 12; x += 1) {
    for (let y = 0; y < 9; y += 1) tiles.push({ x, y });
  }
  return tiles;
}

describe('standableTileAt', () => {
  it('leaves a clear tile exactly where you clicked', () => {
    // The aisle between the pod and the kitchen: nothing on it, nothing near it.
    expect(isStandableTile({ x: 4, y: 3 })).toBe(true);
    expect(standableTileAt({ x: 4.2, y: 2.9 }, { from: HOME })).toEqual({ x: 4, y: 3 });
  });

  it('steps you beside a desk rather than into it', () => {
    const mark = standableTileAt(HOME, { from: HOME });
    expect(mark).toBeTruthy();
    expect(mark).not.toEqual(HOME);
    // One tile away — snapping is for stepping aside, not for travelling.
    expect(Math.abs(mark.x - HOME.x) + Math.abs(mark.y - HOME.y)).toBeLessThanOrEqual(2);
  });

  it('never lands you on a seat, in the furniture, or off the plate', () => {
    for (const tile of everyTile()) {
      const mark = standableTileAt(tile, { from: HOME });
      if (!mark) continue;
      expect(isOnFloor(mark.x, mark.y)).toBe(true);
      for (const seat of FLOOR_SEATS) {
        expect(
          Math.hypot(seat.x - mark.x, seat.y - mark.y),
          `${JSON.stringify(tile)} put you on ${seat.id}`
        ).toBeGreaterThanOrEqual(0.8);
      }
      for (const prop of FLOOR_PROPS) {
        if (prop.kind === 'glassPanel') continue;
        expect(Math.hypot(prop.x - mark.x, prop.y - mark.y)).toBeGreaterThanOrEqual(0.7);
      }
    }
  });

  it('never returns a tile you would have to walk through glass to reach', () => {
    for (const tile of everyTile()) {
      const mark = standableTileAt(tile, { from: HOME });
      if (!mark) continue;
      expect(
        pathCrossesGlass(walkPathBetween(HOME, mark, YOU_SEAT_ID)),
        `${JSON.stringify(tile)} routed you through a wall`
      ).toBe(false);
    }
  });

  /*
   * The honest form of § 6 rule 17. Asserting "clicking a director returns
   * null" was the tempting shorthand and it is wrong in both directions: it
   * fails on tiles that are merely *outside* the west wall (open floor you may
   * stand on), and it would pass while some other click smuggled you in
   * through a gap. What the rule claims is that no click anywhere on the plate
   * puts you inside the room — so that is what gets asserted.
   */
  it('keeps the leadership fishbowl sealed from every click on the floor', () => {
    const [x0, y0, x1, y1] = FLOOR_ZONES.find((zone) => zone.id === 'leadership').rect;
    const inside = (t) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1;

    for (const tile of everyTile()) {
      const mark = standableTileAt(tile, { from: HOME });
      if (!mark) continue;
      expect(
        inside(mark),
        `clicking ${JSON.stringify(tile)} walked you to ${JSON.stringify(mark)}, inside the glass`
      ).toBe(false);
    }
  });

  it('will not stand you on a director', () => {
    for (const seat of FLOOR_SEATS.filter((s) => s.zone === 'leadership')) {
      expect(isStandableTile({ x: seat.x, y: seat.y }), seat.id).toBe(false);
    }
  });

  it('lets you walk right up to the glass from outside it', () => {
    // Clicking just inside the leadership wall puts you against it, not through
    // it — the room refuses entry without refusing the approach. (6,2) rather
    // than the nearer (7,2) because the whiteboard at 7.8/2.4 would stand
    // between you and the viewer there — § 6 rule 11, applied by derivation.
    const mark = standableTileAt({ x: 7, y: 1 }, { from: HOME });
    expect(mark).toEqual({ x: 6, y: 2 });
  });

  it('will not park you on somebody else who is standing there', () => {
    // The visitor tile belongs to whoever walks over to bother you.
    expect(isStandableTile(VISITOR_TILE)).toBe(false);
  });

  it('honours where you are coming from', () => {
    // Reachability is a different question from standing room (§ 6 rule 17):
    // with no origin the glass check is skipped and tiles inside open up.
    const sealed = standableTileAt({ x: 7, y: 1 }, { from: HOME });
    const unchecked = standableTileAt({ x: 7, y: 1 }, { from: null });
    expect(sealed).toEqual({ x: 6, y: 2 });
    expect(unchecked).toEqual({ x: 7, y: 1 });
  });

  it('resolves the same click to the same tile every time', () => {
    const once = standableTileAt({ x: 6.5, y: 2.5 }, { from: HOME });
    const twice = standableTileAt({ x: 6.5, y: 2.5 }, { from: HOME });
    expect(once).toEqual(twice);
  });
});

describe('standableTileAtPoint', () => {
  it('agrees with the projection it inverts', () => {
    const tile = { x: 4, y: 3 };
    const { left, top } = projectIso(tile.x, tile.y);
    expect(standableTileAtPoint(left, top, { from: HOME })).toEqual(tile);
  });

  it('is null out in the car park', () => {
    expect(standableTileAtPoint(-4000, -4000, { from: HOME })).toBeNull();
  });
});

describe('sameTile', () => {
  it('compares by coordinate, and treats null as its own value', () => {
    expect(sameTile({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(sameTile({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    expect(sameTile(null, null)).toBe(true);
    expect(sameTile(null, { x: 1, y: 2 })).toBe(false);
  });
});
