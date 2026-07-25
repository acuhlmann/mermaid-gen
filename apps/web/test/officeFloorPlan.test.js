import { describe, expect, it } from 'vitest';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import {
  BATTLE_TILES,
  COFFEE_TILES,
  FLOOR_PROPS,
  FLOOR_SEATS,
  FLOOR_ZONES,
  GRID_H,
  GRID_W,
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
  pathCost,
  projectIso,
  seatFor,
  walkPathFrom,
  zoneCentre,
  zonePolygon
} from '../src/utils/officeFloorPlan.js';

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
