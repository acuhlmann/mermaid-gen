/**
 * ADR-0011 executable contracts for isometric mode.
 *
 * These tests encode architecture rules agents must not break when extending
 * the floor. Prefer adding an assertion here over repeating prose in comments.
 */

import { describe, expect, it } from 'vitest';
import { floorAnnouncement } from '../src/components/officeFloor/floorAnnouncement.js';
import { FLOOR_PROP_USES, propUseFor } from '../src/utils/officeFloorProps.js';
import { officeChromeCopy, officeSenderInfo } from '../src/utils/officeCast.js';
import { isStandableTile, seatFor, YOU_SEAT_ID } from '../src/utils/officeFloorPlan.js';
import { wanderTripsFor, wanderingSeatIds } from '../src/utils/officeFloorWander.js';

const copy = officeChromeCopy().floor;
const lines = copy.narration;

describe('ADR-0011 rule 2 — diegesis duplicates, never replaces', () => {
  it('only the coffee machine wires through to a desk verb', () => {
    const withVerb = FLOOR_PROP_USES.filter((row) => row.verb);
    expect(withVerb).toEqual([{ kind: 'coffeeMachine', verb: 'coffee' }]);
    expect(propUseFor('printer')?.verb).toBeNull();
    expect(propUseFor('whiteboard')?.verb).toBeNull();
  });

  it('lists every prop kind exactly once', () => {
    const kinds = FLOOR_PROP_USES.map((row) => row.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('spatial narration never quotes speech (slice 10)', () => {
  it('floorAnnouncement names people and places, not their lines', () => {
    const intern = officeSenderInfo('intern');
    const introSnippet = intern.introLine?.slice(0, 24) ?? '';
    const said = floorAnnouncement({
      copy,
      talk: { colleagueId: 'intern', phase: 'talking' }
    });
    expect(said.text).toContain(intern.name);
    if (introSnippet.length > 8) {
      expect(said.text).not.toContain(introSnippet);
    }
  });

  it('walk-by narration says they are arriving, not what they said', () => {
    const said = floorAnnouncement({
      copy,
      walkBy: { id: 'w1', colleagueId: 'greybeard' }
    });
    expect(said.text).toMatch(/walking over/i);
    expect(said.text).not.toMatch(/mainframe/i);
  });
});

describe('geometry POV — isStandableTile excludeSeatId (§6 rule 27)', () => {
  it('defaults to skipping your seat in face clearance', () => {
    const you = seatFor(YOU_SEAT_ID);
    expect(you).toBeTruthy();
    expect(isStandableTile({ x: you.x, y: you.y })).toBe(false);
  });

  it('can validate a wanderer mark against every seat including yours', () => {
    for (const id of wanderingSeatIds()) {
      for (const trip of wanderTripsFor(id)) {
        expect(isStandableTile(trip.mark, { excludeSeatId: id })).toBe(true);
        expect(isStandableTile(trip.mark, { excludeSeatId: YOU_SEAT_ID })).toBe(
          isStandableTile(trip.mark)
        );
      }
    }
  });
});

describe('card-slot narration order matches floorAnnouncement priority', () => {
  it('meeting beats talk beats peek beats prop beats walk-by beats roam', () => {
    const stack = {
      copy,
      meeting: { state: 'playing' },
      talk: { colleagueId: 'intern', phase: 'talking' },
      peek: { colleagueId: 'intern', phase: 'looking' },
      prop: { propKind: 'printer', phase: 'using' },
      presence: { phase: 'standing', key: 1 },
      walkBy: { id: 'w1', colleagueId: 'intern' }
    };
    expect(floorAnnouncement(stack).text).toBe(lines.inMeeting);
    expect(floorAnnouncement({ ...stack, meeting: null }).key).toMatch(/^talk:/);
    expect(floorAnnouncement({ ...stack, meeting: null, talk: null }).key).toMatch(/^peek:/);
    expect(floorAnnouncement({ ...stack, meeting: null, talk: null, peek: null }).key).toMatch(
      /^prop:/
    );
    expect(
      floorAnnouncement({ ...stack, meeting: null, talk: null, peek: null, prop: null }).key
    ).toMatch(/^walkby:/);
    expect(
      floorAnnouncement({
        ...stack,
        meeting: null,
        talk: null,
        peek: null,
        prop: null,
        walkBy: null
      }).key
    ).toMatch(/^roam:/);
  });
});
