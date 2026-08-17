import { describe, expect, it } from 'vitest';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import { VISITOR_TILE } from '../src/utils/officeFloorPlan.js';
import {
  OFFICE_RUN_WALK_CAST,
  pickRunReactionColleague
} from '../src/utils/officeRunReactionPicker.js';

describe('pickRunReactionColleague', () => {
  it('is the IM ∩ walk intersection, never senior', () => {
    expect(OFFICE_RUN_WALK_CAST).toEqual(['intern', 'scrumMaster', 'greybeard']);
    expect(OFFICE_RUN_WALK_CAST.some((id) => CAST_TIERS.senior.includes(id))).toBe(false);
  });

  it('walks when asked and a path exists', () => {
    expect(
      pickRunReactionColleague({
        wantWalk: true,
        youTile: VISITOR_TILE
      })
    ).toEqual({ colleagueId: 'intern', kind: 'walkby', situation: 'runWalk' });
  });

  it("prefers someone already in today's memory who can walk", () => {
    expect(
      pickRunReactionColleague({
        wantWalk: true,
        youTile: VISITOR_TILE,
        memoryIds: ['greybeard', 'intern']
      })
    ).toEqual({ colleagueId: 'greybeard', kind: 'walkby', situation: 'runWalk' });
  });

  it('never picks someone already away', () => {
    expect(
      pickRunReactionColleague({
        wantWalk: true,
        youTile: VISITOR_TILE,
        awayIds: ['intern', 'scrumMaster']
      })
    ).toEqual({ colleagueId: 'greybeard', kind: 'walkby', situation: 'runWalk' });
  });

  it('falls back to IM when a walk is not asked, using the same picker', () => {
    expect(
      pickRunReactionColleague({
        wantWalk: false,
        memoryIds: ['scrumMaster']
      })
    ).toEqual({ colleagueId: 'scrumMaster', kind: 'im', situation: 'run' });
  });

  it('stays silent when the whole intersection is away', () => {
    expect(
      pickRunReactionColleague({
        wantWalk: true,
        awayIds: OFFICE_RUN_WALK_CAST
      })
    ).toEqual({ colleagueId: null, kind: 'im', situation: 'run' });
  });
});
