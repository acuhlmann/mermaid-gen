import { describe, expect, it } from 'vitest';
import {
  approachTileFor,
  approachableSeatIds,
  propTileFor,
  sameTile,
  standableTileAt,
  standableTileAtPoint,
  usablePropKinds
} from '../src/utils/officeFloorMovement.js';
import {
  FLOOR_PROPS,
  FLOOR_SEATS,
  FLOOR_ZONES,
  VISITOR_TILE,
  YOU_SEAT_ID,
  boxesOverlap,
  figureBox,
  headBox,
  isOnFloor,
  isStandableTile,
  pathCrossesGlass,
  peekTileFor,
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

describe('approachTileFor', () => {
  it('gives everyone off the leadership row somewhere to be talked to', () => {
    const roster = approachableSeatIds();
    // Pins the derivation the way slice 6 pins the peek roster: a layout change
    // that quietly strands a colleague fails here.
    expect(roster).toEqual([
      'gilfoyle',
      'dinesh',
      'erlich',
      'critique',
      'explain',
      'goMad',
      'helpdesk',
      'scrumMaster',
      'intern',
      'greybeard',
      'hr',
      'facilities'
    ]);
  });

  it('works for a colleague with no desk at all', () => {
    // Gary lives at the fridge. A conversation needs somewhere to stand, not
    // something to look at, which is why this is not `peekTileFor`.
    expect(seatFor('facilities').desk).toBe(false);
    expect(peekTileFor('facilities')).toBeNull();
    expect(approachTileFor('facilities')).toBeTruthy();
  });

  it('refuses the leadership row — you cannot talk through glass', () => {
    for (const seat of FLOOR_SEATS.filter((s) => s.zone === 'leadership')) {
      expect(approachTileFor(seat.id), seat.id).toBeNull();
    }
  });

  it('puts you somewhere standable with a clear line to them', () => {
    for (const id of approachableSeatIds()) {
      const mark = approachTileFor(id);
      const seat = seatFor(id);
      expect(isStandableTile(mark), id).toBe(true);
      expect(pathCrossesGlass([mark, { x: seat.x, y: seat.y }]), id).toBe(false);
      expect(pathCrossesGlass(walkPathBetween(HOME, mark, YOU_SEAT_ID)), id).toBe(false);
    }
  });

  it('stands you next to them, not across the room', () => {
    for (const id of approachableSeatIds()) {
      const mark = approachTileFor(id);
      const seat = seatFor(id);
      expect(Math.hypot(mark.x - seat.x, mark.y - seat.y), id).toBeLessThanOrEqual(2.25);
    }
  });

  it('has no mark for you, or for a stranger', () => {
    expect(approachTileFor(YOU_SEAT_ID)).toBeNull();
    expect(approachTileFor('nobody')).toBeNull();
  });
});

describe('approachTileFor, aimed at somebody who has left their desk (slice 12)', () => {
  /** Everywhere a colleague can end up standing that is not their own chair. */
  const AWAY_TILES = () => usablePropKinds().map((kind) => ({ kind, tile: propTileFor(kind) }));

  it('finds a mark at every place somebody can wander to', () => {
    /*
     * The reason the verb can follow them at all. If a prop mark ever loses its
     * approach the room stops offering _Go and talk_ to whoever is stood there,
     * which is correct behaviour and a silent loss of reach — so it is pinned.
     */
    const marks = AWAY_TILES().map(({ kind, tile }) => [
      kind,
      approachTileFor('intern', { at: tile })
    ]);
    for (const [kind, mark] of marks) {
      expect(mark, `nowhere to stand to talk to somebody at the ${kind}`).toBeTruthy();
    }
    expect(marks).toHaveLength(3);
  });

  it('stands you beside them rather than on them, and clears their face', () => {
    /*
     * § 6 rule 27 from the other side. `isStandableTile` validates against
     * `FLOOR_SEATS`, so it knows where everybody *works* — it has no idea
     * somebody is stood at the printer, and it thinks they are still at the desk
     * they left. Both halves of the face test therefore have to be re-asked
     * about the body itself, in both directions.
     */
    const standing = { seated: false };
    for (const { kind, tile } of AWAY_TILES()) {
      const mark = approachTileFor('intern', { at: tile });
      expect(isStandableTile(mark), kind).toBe(true);
      expect(mark, kind).not.toEqual(tile);
      expect(pathCrossesGlass([mark, tile]), kind).toBe(false);
      expect(pathCrossesGlass(walkPathBetween(HOME, mark, YOU_SEAT_ID)), kind).toBe(false);
      expect(
        boxesOverlap(figureBox(mark, standing), headBox(tile, standing)),
        `you cover the face of somebody at the ${kind}`
      ).toBe(false);
      expect(
        boxesOverlap(figureBox(tile, standing), headBox(mark, standing)),
        `somebody at the ${kind} covers yours`
      ).toBe(false);
    }
  });

  it('is the seat mark when no position is given, so old callers are unchanged', () => {
    for (const id of approachableSeatIds()) {
      expect(approachTileFor(id, {}), id).toEqual(approachTileFor(id));
      const seat = seatFor(id);
      expect(approachTileFor(id, { at: { x: seat.x, y: seat.y } }), id).toEqual(
        approachTileFor(id)
      );
    }
  });

  it('still refuses somebody whose position you cannot reach', () => {
    // A position, not a licence: the fishbowl seals itself for a body standing
    // in it exactly as it does for one sitting in it (§ 6 rule 17).
    const cfo = seatFor('cfo');
    expect(approachTileFor('intern', { at: { x: cfo.x, y: cfo.y } })).toBeNull();
  });
});

describe('propTileFor', () => {
  it('gives you somewhere to stand at three of the four usable props', () => {
    // Pinned like the peek and approach rosters. The water cooler's absence is
    // the point rather than an omission: § 6 rule 11 tucked it into the kitchen
    // corner so it would stop hiding people on coffee breaks, and § 6 rule 21
    // is what that costs — there is no longer anywhere to stand at it.
    expect(usablePropKinds()).toEqual(['coffeeMachine', 'printer', 'whiteboard']);
    expect(propTileFor('waterCooler')).toBeNull();
  });

  it('puts you somewhere standable you can actually walk to', () => {
    for (const kind of usablePropKinds()) {
      const mark = propTileFor(kind);
      expect(isStandableTile(mark), kind).toBe(true);
      expect(pathCrossesGlass(walkPathBetween(HOME, mark, YOU_SEAT_ID)), kind).toBe(false);
    }
  });

  it('stands you at the prop rather than near it', () => {
    for (const kind of usablePropKinds()) {
      const prop = FLOOR_PROPS.find((entry) => entry.kind === kind);
      const mark = propTileFor(kind);
      expect(Math.hypot(mark.x - prop.x, mark.y - prop.y), kind).toBeLessThanOrEqual(2);
    }
  });

  it('never sends two props to the same tile', () => {
    // The bug this exists for: before nearest-prop-wins, the coffee machine and
    // the water cooler both resolved to (2, 7), so "use the cooler" walked you
    // to the machine and captioned it a cooler.
    const marks = usablePropKinds().map((kind) => propTileFor(kind));
    const unique = new Set(marks.map((mark) => `${mark.x},${mark.y}`));
    expect(unique.size).toBe(marks.length);
  });

  it('is the rule that costs the cooler its mark, and the machine that keeps it', () => {
    // Without nearest-prop-wins both props snap to the same tile — this is that
    // collision, still reachable through the function the rule was added to.
    const cooler = FLOOR_PROPS.find((entry) => entry.kind === 'waterCooler');
    const naive = standableTileAt(cooler, { from: HOME, radius: 2 });
    expect(naive).toEqual(propTileFor('coffeeMachine'));
    // The machine is nearer that tile than the cooler is, so the machine keeps it.
    const machine = FLOOR_PROPS.find((entry) => entry.kind === 'coffeeMachine');
    expect(Math.hypot(machine.x - naive.x, machine.y - naive.y)).toBeLessThan(
      Math.hypot(cooler.x - naive.x, cooler.y - naive.y)
    );
  });

  it('has no mark for scenery, or for a prop that is not there', () => {
    expect(propTileFor('plant')).toBeNull();
    expect(propTileFor('nothing')).toBeNull();
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
