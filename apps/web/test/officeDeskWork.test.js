import { describe, expect, it } from 'vitest';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import { DESK_WORK_LOOKS, OFFICE_DESK_WORK, deskWorkFor } from '../src/utils/officeDeskWork.js';

const CAST = [...CAST_TIERS.team, ...CAST_TIERS.senior, ...CAST_TIERS.office];

describe('their own work', () => {
  it('gives every cast member a row', () => {
    // Drift guard, same shape as the seat rows and the face traits: a new
    // colleague costs one row here, and this fails until they get one.
    for (const id of CAST) {
      expect(deskWorkFor(id), `${id} has nothing on their screen`).toBeTruthy();
    }
    expect(Object.keys(OFFICE_DESK_WORK).sort()).toEqual([...CAST].sort());
  });

  it('draws from the closed set of looks the monitor can render', () => {
    for (const [id, work] of Object.entries(OFFICE_DESK_WORK)) {
      expect(DESK_WORK_LOOKS, `${id} has an unrenderable look`).toContain(work.look);
    }
  });

  it('gives everyone something to say, short enough for a speech bubble', () => {
    for (const [id, work] of Object.entries(OFFICE_DESK_WORK)) {
      expect(work.line.length, `${id} says nothing`).toBeGreaterThan(0);
      expect(work.line.length, `${id} monologues`).toBeLessThanOrEqual(90);
    }
  });

  it('has no row for the player', () => {
    // Your own screen is the deliverable, not ambience — and you cannot peek
    // at yourself, you sit down at it.
    expect(deskWorkFor('you')).toBeNull();
  });
});
