import { describe, expect, it } from 'vitest';
import {
  NIGHT_SHIFT_COLUMNS,
  hasUnseenNightShift,
  nightShiftCards,
  nightShiftColumns,
  nightShiftCounts,
  nightShiftStandupBeats,
  shiftWhen,
  shortDate
} from '../src/features/nightShift/nightShiftBoard.js';
import { NIGHT_FIXTURE } from './helpers/nightShiftFixture.js';

const NOW = Date.parse('2026-11-25T09:00:00Z');

describe('columns', () => {
  it('sorts each crew member into exactly one column, in board order', () => {
    const columns = nightShiftColumns(NIGHT_FIXTURE);
    expect(columns.map((column) => column.id)).toEqual([...NIGHT_SHIFT_COLUMNS]);
    const byColumn = Object.fromEntries(
      columns.map((column) => [column.id, column.cards.map((card) => card.id)])
    );
    expect(byColumn).toEqual({
      shipped: ['office-life', 'improve'],
      checked: ['resolve'],
      noShow: ['prune'],
      onLeave: ['canvas-graph-edit']
    });
    expect(nightShiftCounts(NIGHT_FIXTURE)).toEqual({
      shipped: 2,
      checked: 1,
      noShow: 1,
      onLeave: 1
    });
  });

  it('lets the ledger outrank the roster: a parked crew member who worked is not on leave', () => {
    const working = {
      ...NIGHT_FIXTURE,
      crew: [{ ...NIGHT_FIXTURE.crew[4], tonight: NIGHT_FIXTURE.crew[2].tonight }]
    };
    expect(nightShiftCards(working)[0]?.column).toBe('checked');
  });
});

describe('the standup', () => {
  const beats = nightShiftStandupBeats(NIGHT_FIXTURE, { now: NOW });

  it('opens and closes with the host, and calls on whoever clocked in, shipped first', () => {
    expect(beats.map((beat) => beat.key)).toEqual([
      'intro',
      'crew-office-life',
      'crew-improve',
      'crew-resolve',
      'no-shows',
      'on-leave',
      'outro'
    ]);
    expect(beats[0]?.text).toContain('3 of 5');
    expect(beats[0]?.text).toContain('last night');
  });

  it('only mentions what the board shows: the same PRs, and the no-shows by name', () => {
    expect(beats.find((beat) => beat.key === 'crew-office-life')?.prs).toEqual([958]);
    expect(beats.find((beat) => beat.key === 'crew-office-life')?.text).toContain(
      'Queue 0 — a new step. Merged #958.'
    );
    expect(beats.find((beat) => beat.key === 'crew-resolve')?.prs).toEqual([]);
    expect(beats.find((beat) => beat.key === 'no-shows')?.text).toContain('Prune');
    expect(beats.find((beat) => beat.key === 'on-leave')?.text).toContain('Canvas Graph Edit is');
  });

  it('is an empty room, not an error, when nobody clocked in', () => {
    const empty = {
      shiftDate: '2026-11-24',
      crew: [{ id: 'prune', parked: false, lastSeen: '2026-09-19', tonight: [], earlier: [] }]
    };
    const quiet = nightShiftStandupBeats(empty, { now: NOW });
    expect(quiet[0]?.text).toContain('empty');
    expect(nightShiftStandupBeats({ shiftDate: null, crew: [] })).toEqual([]);
  });
});

describe('dates and the seen marker', () => {
  it('says "last night" for the newest shift you could have slept through', () => {
    expect(shiftWhen('2026-11-24', NOW)).toBe('last night');
    expect(shiftWhen('2026-11-25', NOW)).toBe('last night');
    expect(shiftWhen('2026-11-20', NOW)).toBe('on 20 Nov');
    expect(shortDate('2026-09-01')).toBe('1 Sep');
  });

  it('offers the standup only for a shift newer than the one you caught up on', () => {
    expect(hasUnseenNightShift(NIGHT_FIXTURE, null)).toBe(true);
    expect(hasUnseenNightShift(NIGHT_FIXTURE, '2026-11-23')).toBe(true);
    expect(hasUnseenNightShift(NIGHT_FIXTURE, '2026-11-24')).toBe(false);
    expect(hasUnseenNightShift({ shiftDate: null, crew: [] }, null)).toBe(false);
  });
});
