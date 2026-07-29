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
  it('keeps walk roster faces without a second Linda self-intro', () => {
    expect([...DAY_ONE_WALK_IDS]).toEqual(['dinesh', 'erlich', 'jared', 'richard', 'barker']);
    expect(DAY_ONE_WALK_IDS).not.toContain('hr');
    expect(DAY_ONE_INTRO_IDS).toContain('hr');
  });

  it('orders welcome → distinct closing with no sequential desk intros', () => {
    const beats = arrivalSpeechBeats();
    expect(beats).toHaveLength(2);
    expect(beats[0]).toMatchObject({ kind: 'welcome', id: 'hr' });
    expect(beats[0].line).toMatch(/Linda|People Ops/i);
    expect(beats[0].line).toMatch(/Speed round|Dinesh/i);
    expect(beats[1]).toMatchObject({ kind: 'closing', id: 'hr' });
    expect(beats[1].line).toMatch(/wizard/i);
    expect(beats[1].line).not.toEqual(beats[0].line);
    expect(beats.filter((beat) => beat.kind === 'intro')).toEqual([]);
  });

  it('gives Linda and home reachable tiles from reception', () => {
    const linda = introVisitTileFor('hr', RECEPTION_TILE);
    expect(linda).toBeTruthy();
    expect(pathCrossesGlass(walkPathBetween(RECEPTION_TILE, linda, YOU_SEAT_ID))).toBe(false);
    const home = introHomeTile();
    expect(pathCrossesGlass(walkPathBetween(linda, home, YOU_SEAT_ID))).toBe(false);
  });
});
