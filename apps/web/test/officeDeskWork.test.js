import { describe, expect, it } from 'vitest';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import {
  DESK_WORK_DOING,
  DESK_WORK_LOOKS,
  OFFICE_DESK_WORK,
  deskWorkFor,
  deskWorkPromptLines
} from '../src/utils/officeDeskWork.js';

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

  it('gives every closed-set value a sentence, so no enum name reaches a prompt', () => {
    // The way this breaks is a *sixth* look or doing value being added to the
    // closed set with no sentence beside it: `deskWorkPromptLines` would then
    // quietly drop it, and one colleague's own work would stop existing with
    // nothing rendered to notice. Sweep the sets, not the roster.
    for (const id of CAST) {
      const lines = deskWorkPromptLines(id);
      expect(lines.length, `${id} has no sentence for their own work`).toBe(2);
      for (const line of lines) {
        expect(line.length, `${id} overruns the 200-char wire cap`).toBeLessThanOrEqual(200);
        // An enum name leaking through would read as a bare word in a
        // sentence-shaped block — every real line is a clause about them.
        expect(line, `${id} leaks an enum name`).toMatch(/\byou\b|\byour\b/);
      }
    }
    const looksUsed = new Set(Object.values(OFFICE_DESK_WORK).map((w) => w.look));
    const doingUsed = new Set(Object.values(OFFICE_DESK_WORK).map((w) => w.doing));
    expect([...looksUsed].sort()).toEqual([...DESK_WORK_LOOKS].sort());
    expect([...doingUsed].sort()).toEqual([...DESK_WORK_DOING].sort());
  });

  it('never hands the model the line it says when you peek', () => {
    // `line` is their canned answer to being looked at. Putting it in the
    // prompt is handing the model the recital and asking it not to recite.
    for (const [id, work] of Object.entries(OFFICE_DESK_WORK)) {
      expect(
        deskWorkPromptLines(id).join('\n'),
        `${id} was handed their own punchline`
      ).not.toContain(work.line);
    }
  });

  it('says nothing for the player and for a stranger', () => {
    // Empty rather than absent: the server drops the heading on an empty array
    // instead of announcing that this colleague has no inner life.
    expect(deskWorkPromptLines('you')).toEqual([]);
    expect(deskWorkPromptLines('nobody')).toEqual([]);
    expect(deskWorkPromptLines('')).toEqual([]);
  });

  it('has no row for the player', () => {
    // Your own screen is the deliverable, not ambience — and you cannot peek
    // at yourself, you sit down at it.
    expect(deskWorkFor('you')).toBeNull();
  });
});
