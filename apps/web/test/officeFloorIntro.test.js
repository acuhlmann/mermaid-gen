import { describe, expect, it } from 'vitest';
import {
  arrivalSpeechBeats,
  DAY_ONE_WALK_IDS,
  introHomeTile,
  introVisitTileFor
} from '../src/utils/officeFloorIntro.js';
import { DAY_ONE_INTRO_IDS } from '../src/utils/officeCast.js';
import {
  RECEPTION_TILE,
  pathCrossesGlass,
  walkPathBetween,
  YOU_SEAT_ID
} from '../src/utils/officeFloorPlan.js';

describe('officeFloorIntro', () => {
  it('walks Your Team without a second Linda self-intro', () => {
    expect([...DAY_ONE_WALK_IDS]).toEqual(['dinesh', 'erlich', 'jared', 'richard', 'barker']);
    expect(DAY_ONE_WALK_IDS).not.toContain('hr');
    expect(DAY_ONE_INTRO_IDS).toContain('hr');
  });

  it('orders welcome → team → distinct closing', () => {
    const beats = arrivalSpeechBeats();
    expect(beats[0]).toMatchObject({ kind: 'welcome', id: 'hr' });
    expect(beats[0].line).toMatch(/Linda/);
    expect(beats.at(-1)).toMatchObject({ kind: 'closing', id: 'hr' });
    expect(beats.at(-1).line).toMatch(/desk is waiting/i);
    expect(beats.at(-1).line).not.toEqual(beats[0].line);
    expect(beats.filter((beat) => beat.kind === 'intro').map((beat) => beat.id)).toEqual([
      ...DAY_ONE_WALK_IDS
    ]);
  });

  it('gives every walk stop a reachable visit tile from reception', () => {
    let from = RECEPTION_TILE;
    const linda = introVisitTileFor('hr', from);
    expect(linda).toBeTruthy();
    expect(pathCrossesGlass(walkPathBetween(from, linda, YOU_SEAT_ID))).toBe(false);
    from = linda;
    for (const id of DAY_ONE_WALK_IDS) {
      const tile = introVisitTileFor(id, from);
      expect(tile, id).toBeTruthy();
      expect(pathCrossesGlass(walkPathBetween(from, tile, YOU_SEAT_ID)), id).toBe(false);
      from = tile;
    }
    const home = introHomeTile();
    expect(pathCrossesGlass(walkPathBetween(from, home, YOU_SEAT_ID))).toBe(false);
  });
});
