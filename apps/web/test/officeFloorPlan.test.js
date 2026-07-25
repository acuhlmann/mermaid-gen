import { describe, expect, it } from 'vitest';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import { MEETING_ROSTER_MAX } from '../src/utils/officeCast.js';
import {
  BATTLE_TILES,
  COFFEE_TILES,
  FLOOR_PROPS,
  FLOOR_SEATS,
  FLOOR_ZONES,
  GRID_H,
  GRID_W,
  MEETING_BUBBLE_DEPTH,
  MEETING_PLAYER_TILE,
  MEETING_SEATS,
  ORIGIN_X,
  ORIGIN_Y,
  STAGE_H,
  STAGE_W,
  TILE_H,
  TILE_W,
  VISITOR_TILE,
  YOU_SEAT_ID,
  depthOf,
  floorSeatIds,
  isOnFloor,
  liftToDepth,
  meetingSeating,
  pathCost,
  projectIso,
  seatFor,
  walkPathFrom,
  zoneCentre,
  zonePolygon
} from '../src/utils/officeFloorPlan.js';

/**
 * A figure's screen footprint, in stage px: a 34 px `PersonaFace` head over a
 * 24 px torso pulled up 10 px to overlap it (`.office-floor-person-head`), so
 * 34 wide by 48 tall — lifted 30 px when seated (§ 6 rule 2). Confirmed against
 * `getBoundingClientRect()` in a capture rather than read off the stylesheet.
 *
 * This is the honest form of § 6 rule 10. "No mark may share `x - y` with a
 * desk" is the integer shorthand for it, and it does not survive fractional
 * marks: the glass room is a diagonal strip in column space, so every seat
 * around its table has a fractional column. What the rule is actually about is
 * one figure's head landing on another's, which is a rectangle intersection.
 */
const FIGURE_HALF_W = 17;
const FIGURE_H = 48;
const HEAD_H = 34;
const SEATED_LIFT = 30;

function figureBox(tile, { seated = true } = {}) {
  const { left, top } = projectIso(tile.x, tile.y);
  const feet = top - (seated ? SEATED_LIFT : 0);
  return { x0: left - FIGURE_HALF_W, x1: left + FIGURE_HALF_W, y0: feet - FIGURE_H, y1: feet };
}

/** Just the head — the part that must never be covered. */
function headBox(tile, options) {
  const box = figureBox(tile, options);
  return { ...box, y1: box.y0 + HEAD_H };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

describe('isometric projection', () => {
  it('puts tile 0,0 at the stage origin', () => {
    expect(projectIso(0, 0)).toEqual({ left: ORIGIN_X, top: ORIGIN_Y });
  });

  it('moves +x down-right and +y down-left by half a tile', () => {
    expect(projectIso(1, 0)).toEqual({ left: ORIGIN_X + TILE_W / 2, top: ORIGIN_Y + TILE_H / 2 });
    expect(projectIso(0, 1)).toEqual({ left: ORIGIN_X - TILE_W / 2, top: ORIGIN_Y + TILE_H / 2 });
  });

  it('handles fractional tiles so props can straddle them', () => {
    expect(projectIso(0.5, 0.5)).toEqual({ left: ORIGIN_X, top: ORIGIN_Y + TILE_H / 2 });
  });

  it('orders depth so nearer tiles paint later', () => {
    expect(depthOf(0, 0)).toBeLessThan(depthOf(1, 0));
    expect(depthOf(3, 4)).toBe(depthOf(4, 3));
    expect(depthOf(11, 8)).toBeGreaterThan(depthOf(11, 7));
  });
});

describe('floor layout', () => {
  it('gives every cast member a seat', () => {
    const cast = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];
    const seated = floorSeatIds();
    // Drift guard: a new colleague costs one seat row, like a face trait row.
    for (const id of cast) {
      expect(seated, `${id} has no desk on the floor`).toContain(id);
    }
  });

  it('seats the player and nobody else twice', () => {
    expect(seatFor(YOU_SEAT_ID)).toBeTruthy();
    const ids = floorSeatIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never puts two people on the same tile', () => {
    const tiles = FLOOR_SEATS.map((seat) => `${seat.x},${seat.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it('keeps every seat and prop inside the floor plate', () => {
    for (const seat of FLOOR_SEATS) {
      expect(isOnFloor(seat.x, seat.y), `${seat.id} is off the floor`).toBe(true);
    }
    for (const prop of FLOOR_PROPS) {
      expect(isOnFloor(prop.x, prop.y), `${prop.kind} is off the floor`).toBe(true);
    }
  });

  it('keeps the projected room inside the stage', () => {
    const corners = [
      projectIso(-0.5, -0.5),
      projectIso(GRID_W - 0.5, -0.5),
      projectIso(GRID_W - 0.5, GRID_H - 0.5),
      projectIso(-0.5, GRID_H - 0.5)
    ];
    for (const point of corners) {
      expect(point.left).toBeGreaterThanOrEqual(0);
      expect(point.left).toBeLessThanOrEqual(STAGE_W);
      expect(point.top).toBeGreaterThanOrEqual(0);
      expect(point.top).toBeLessThanOrEqual(STAGE_H);
    }
  });

  it('seats leadership behind glass and Gary on his feet', () => {
    for (const id of CAST_TIERS.senior) {
      expect(seatFor(id)?.zone).toBe('leadership');
    }
    expect(seatFor('facilities')?.desk).toBe(false);
    expect(seatFor('refine')?.desk).toBe(true);
  });
});

describe('walk paths', () => {
  const walkers = FLOOR_SEATS.filter((seat) => seat.id !== YOU_SEAT_ID).map((seat) => seat.id);

  it('starts at the walker’s desk and ends beside yours', () => {
    for (const id of walkers) {
      const path = walkPathFrom(id);
      const seat = seatFor(id);
      expect(path.length, `${id} has no path`).toBeGreaterThanOrEqual(2);
      expect(path[0]).toEqual({ x: seat.x, y: seat.y });
      expect(path[path.length - 1]).toEqual(VISITOR_TILE);
    }
  });

  it('walks in straight legs — no diagonal drift across the room', () => {
    for (const id of walkers) {
      const path = walkPathFrom(id);
      for (let leg = 1; leg < path.length; leg += 1) {
        const movedX = path[leg].x !== path[leg - 1].x;
        const movedY = path[leg].y !== path[leg - 1].y;
        expect(movedX && movedY, `${id} leg ${leg} moves diagonally`).toBe(false);
      }
    }
  });

  it('picks the cheaper of the two L-routes', () => {
    for (const id of walkers) {
      const seat = seatFor(id);
      const chosen = walkPathFrom(id);
      const start = { x: seat.x, y: seat.y };
      const alternatives = [
        [start, { x: VISITOR_TILE.x, y: start.y }, VISITOR_TILE],
        [start, { x: start.x, y: VISITOR_TILE.y }, VISITOR_TILE]
      ];
      const best = Math.min(...alternatives.map((path) => pathCost(path, id)));
      expect(pathCost(chosen, id), `${id} took the worse route`).toBe(best);
    }
  });

  it('has no path for somebody without a desk', () => {
    expect(walkPathFrom('nobody-here')).toEqual([]);
  });

  it('keeps the visitor tile free of furniture and other people', () => {
    expect(isOnFloor(VISITOR_TILE.x, VISITOR_TILE.y)).toBe(true);
    const occupied = FLOOR_SEATS.some(
      (seat) => seat.x === VISITOR_TILE.x && seat.y === VISITOR_TILE.y
    );
    expect(occupied).toBe(false);
    const propThere = FLOOR_PROPS.some(
      (prop) => Math.abs(prop.x - VISITOR_TILE.x) < 0.6 && Math.abs(prop.y - VISITOR_TILE.y) < 0.6
    );
    expect(propThere).toBe(false);
  });
});

describe('set-piece marks', () => {
  const marks = [
    ['coffee', COFFEE_TILES],
    ['battle', BATTLE_TILES]
  ];

  it('stands the pair side by side, at equal depth', () => {
    for (const [label, tiles] of marks) {
      expect(tiles, label).toHaveLength(2);
      expect(depthOf(tiles[0].x, tiles[0].y), label).toBe(depthOf(tiles[1].x, tiles[1].y));
      const gap = Math.abs(
        projectIso(tiles[0].x, tiles[0].y).left - projectIso(tiles[1].x, tiles[1].y).left
      );
      expect(gap, `${label} marks are too close together`).toBeGreaterThanOrEqual(TILE_W);
    }
  });

  it('keeps the marks out of any seat’s screen column', () => {
    // Tiles sharing x - y project to the same column, so a mark there stacks
    // the standing figure on whoever is sitting a couple of tiles away.
    const seatColumns = new Set(FLOOR_SEATS.map((seat) => seat.x - seat.y));
    for (const [label, tiles] of marks) {
      for (const tile of tiles) {
        expect(seatColumns.has(tile.x - tile.y), `${label} mark shares a column with a desk`).toBe(
          false
        );
      }
    }
  });

  it('keeps the marks on the floor and off the furniture', () => {
    for (const [label, tiles] of marks) {
      for (const tile of tiles) {
        expect(isOnFloor(tile.x, tile.y), label).toBe(true);
        const onSeat = FLOOR_SEATS.some((seat) => seat.x === tile.x && seat.y === tile.y);
        expect(onSeat, `${label} mark is on a desk`).toBe(false);
      }
    }
  });
});

describe('meeting seats (slice 5)', () => {
  const table = FLOOR_PROPS.find((prop) => prop.kind === 'meetingTable');
  const meetingZone = FLOOR_ZONES.find((zone) => zone.id === 'meeting');
  /** Everyone the glass room seats: the eight attendees plus your chair. */
  const allMarks = [...MEETING_SEATS, MEETING_PLAYER_TILE];

  it('seats a full roster, once each, with your own chair kept clear', () => {
    // Drift guard: the picker lets you invite MEETING_ROSTER_MAX people, so the
    // room has to hold exactly that many — plus you, on a mark of your own.
    expect(MEETING_SEATS).toHaveLength(MEETING_ROSTER_MAX);
    const keys = allMarks.map((tile) => `${tile.x},${tile.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps every mark inside the glass room', () => {
    const [x0, y0, x1, y1] = meetingZone.rect;
    for (const tile of allMarks) {
      const where = `${tile.x},${tile.y}`;
      expect(isOnFloor(tile.x, tile.y), `${where} is off the floor`).toBe(true);
      expect(tile.x > x0 && tile.x < x1, `${where} is outside the meeting zone`).toBe(true);
      expect(tile.y > y0 && tile.y < y1, `${where} is outside the meeting zone`).toBe(true);
    }
  });

  it('paints the far row behind the table and the near row in front of it', () => {
    // The table is one prop with one z-index, so this ordering is the whole
    // trick that makes eight people read as seated *around* it: the far row is
    // cut off at the tabletop, the near row's torsos sit over it.
    const tableDepth = depthOf(table.x, table.y);
    for (const tile of allMarks) {
      const behindTheTable = tile.y < table.y;
      expect(
        depthOf(tile.x, tile.y) < tableDepth,
        `${tile.x},${tile.y} paints on the wrong side of the table`
      ).toBe(behindTheTable);
      // …and nobody stands *on* it (the art is 1.1 tiles deep, so 0.55 either
      // side of its anchor is tabletop).
      expect(Math.abs(tile.y - table.y), `${tile.x},${tile.y} is on the tabletop`).toBeGreaterThan(
        0.6
      );
    }
  });

  it('never drops a meeting attendee on top of somebody at their desk', () => {
    for (const tile of allMarks) {
      for (const seat of FLOOR_SEATS) {
        if (!seat.desk) continue;
        expect(
          overlaps(figureBox(tile), figureBox({ x: seat.x, y: seat.y })),
          `a seat at ${tile.x},${tile.y} covers ${seat.id} at their desk`
        ).toBe(false);
      }
    }
  });

  it('lets neighbours overlap but never hides a face across the table', () => {
    // Four heads along one 1.9-tile side of a table cannot avoid overlapping —
    // 56 px of screen column per tile, 34 px per head — and side-by-side
    // shoulders are exactly what a crowded table looks like. What must stay
    // clear is the row opposite: an eclipsed attendee is a missing attendee.
    for (const near of allMarks) {
      for (const far of allMarks) {
        if (near.y === far.y) continue;
        expect(
          overlaps(figureBox(near), headBox(far)),
          `${near.x},${near.y} covers the face at ${far.x},${far.y}`
        ).toBe(false);
      }
    }
  });

  it('parks a speech bubble in the speaker’s column, clear of every head', () => {
    // A bubble anchored on the speaker's own tile covered the whole room — the
    // room renders ~170 px wide and a FloorBubble is ~264. Lifting it onto one
    // depth line keeps the tail pointing at them and the room visible.
    const headTop = (tile) => figureBox(tile).y0;
    const highestHead = Math.min(...allMarks.map(headTop));
    for (const tile of allMarks) {
      const above = liftToDepth(tile, MEETING_BUBBLE_DEPTH);
      const where = `${tile.x},${tile.y}`;
      // Same screen column as the speaker: the tail has to point at somebody.
      expect(projectIso(above.x, above.y).left, `${where} bubble drifted sideways`).toBe(
        projectIso(tile.x, tile.y).left
      );
      // The bubble's bottom edge sits above the tallest head in the room.
      expect(projectIso(above.x, above.y).top, `${where} bubble covers a face`).toBeLessThan(
        highestHead
      );
    }
  });

  it('gives the facilitator the head of the table and keeps invite order after', () => {
    const seating = meetingSeating(['refine', 'scrumMaster', 'critique'], 'scrumMaster');
    expect(seating.map((seat) => seat.id)).toEqual(['scrumMaster', 'refine', 'critique']);
    expect(seating[0].tile).toEqual(MEETING_SEATS[0]);
    expect(seating[1].tile).toEqual(MEETING_SEATS[1]);
  });

  it('seats whoever showed up when the facilitator is not in the room', () => {
    const seating = meetingSeating(['refine', 'critique'], 'scrumMaster');
    expect(seating.map((seat) => seat.id)).toEqual(['refine', 'critique']);
  });

  it('drops duplicates and anyone past the last chair', () => {
    const crowd = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];
    expect(crowd.length).toBeGreaterThan(MEETING_SEATS.length);
    expect(meetingSeating(crowd)).toHaveLength(MEETING_SEATS.length);
    expect(meetingSeating(['refine', 'refine', 'critique']).map((s) => s.id)).toEqual([
      'refine',
      'critique'
    ]);
    expect(meetingSeating(undefined)).toEqual([]);
  });
});

describe('zones', () => {
  it('projects a rect to four points with the centre between them', () => {
    const zone = FLOOR_ZONES[0];
    const polygon = zonePolygon(zone.rect);
    expect(polygon).toHaveLength(4);
    const centre = zoneCentre(zone.rect);
    const lefts = polygon.map((p) => p.left);
    const tops = polygon.map((p) => p.top);
    expect(centre.left).toBeGreaterThanOrEqual(Math.min(...lefts));
    expect(centre.left).toBeLessThanOrEqual(Math.max(...lefts));
    expect(centre.top).toBeGreaterThanOrEqual(Math.min(...tops));
    expect(centre.top).toBeLessThanOrEqual(Math.max(...tops));
  });

  it('has a unique id per zone', () => {
    const ids = FLOOR_ZONES.map((zone) => zone.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
