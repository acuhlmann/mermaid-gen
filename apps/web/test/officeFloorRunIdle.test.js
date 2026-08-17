import { describe, expect, it } from 'vitest';
import { floorRunContextFor, isFloorRunIdle } from '../src/utils/officeFloorRunIdle.js';

describe('isFloorRunIdle', () => {
  const idle = {
    standingFree: true,
    phase: 'standing',
    dwellSaid: null,
    person: null,
    join: null,
    sceneJoin: null
  };

  it('is idle when standing free with no card, commute, or dwell line', () => {
    expect(isFloorRunIdle(idle)).toBe(true);
  });

  it('is busy while walking, talking (not standingFree), or a card is open', () => {
    expect(isFloorRunIdle({ ...idle, phase: 'walking' })).toBe(false);
    expect(isFloorRunIdle({ ...idle, standingFree: false })).toBe(false);
    expect(isFloorRunIdle({ ...idle, dwellSaid: { body: 'hey' } })).toBe(false);
    expect(isFloorRunIdle({ ...idle, person: { id: 'intern' } })).toBe(false);
    expect(isFloorRunIdle({ ...idle, join: { colleagueId: 'intern' } })).toBe(false);
    expect(isFloorRunIdle({ ...idle, sceneJoin: { kind: 'coffee' } })).toBe(false);
  });

  it('snapshots away ids and you-tile for the picker', () => {
    expect(
      floorRunContextFor({
        ...idle,
        awayIds: ['intern'],
        youTile: { x: 8, y: 7 }
      })
    ).toEqual({
      idle: true,
      awayIds: ['intern'],
      youTile: { x: 8, y: 7 }
    });
  });
});
