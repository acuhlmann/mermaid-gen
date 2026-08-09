import { describe, expect, it } from 'vitest';
import {
  arriveCommute,
  marksKey,
  momentMarksFor,
  nextCommutes
} from '../src/utils/officeFloorCommute.js';
import { COFFEE_TILES, HUDDLE_TILES, YOU_SEAT_ID, seatFor } from '../src/utils/officeFloorPlan.js';

const coffee = { id: 'c1', lines: [{ speakerId: 'intern' }, { speakerId: 'greybeard' }] };
const battle = { id: 'b1', lines: [{ speakerId: 'gilfoyle' }, { speakerId: 'dinesh' }] };
const huddle = { attendees: ['richard', 'jared'] };

const idsOf = (list) => list.map((c) => c.id);
const byId = (list, id) => list.find((c) => c.id === id);

describe('momentMarksFor', () => {
  it('gives every scene participant a mark at their scene’s tiles', () => {
    const marks = momentMarksFor({ coffee });
    expect(idsOf(marks)).toEqual(['intern', 'greybeard']);
    expect(marks[0].tile).toEqual(COFFEE_TILES[0]);
    expect(marks[1].tile).toEqual(COFFEE_TILES[1]);
  });

  it('hands a coffee back but never on the way out', () => {
    // `hands` is what the trip gives you; `nextCommutes` only applies it home.
    expect(momentMarksFor({ coffee })[0].hands).toBe('coffee');
    expect(momentMarksFor({ battle })[0].hands).toBeNull();
  });

  it('rings your desk for a huddle', () => {
    const marks = momentMarksFor({ huddle });
    expect(idsOf(marks)).toEqual(['richard', 'jared']);
    expect(marks[0].tile).toEqual(HUDDLE_TILES[0]);
  });

  it('never commutes you — free roam owns where you are', () => {
    const marks = momentMarksFor({ coffee: { lines: [{ speakerId: YOU_SEAT_ID }] } });
    expect(marks).toEqual([]);
  });

  it('lets the first moment keep anybody two moments claim (§ 6 rule 5)', () => {
    const marks = momentMarksFor({
      coffee,
      huddle: { attendees: ['intern', 'richard'] }
    });
    expect(idsOf(marks)).toEqual(['intern', 'greybeard', 'richard']);
    expect(byId(marks, 'intern').tile).toEqual(COFFEE_TILES[0]);
    /*
     * The **raw** ring index, so the mark matches the tile `FloorHuddle` will
     * draw richard at. Compacting the index here would send them walking to
     * HUDDLE_TILES[0] and then pop them to HUDDLE_TILES[1] on arrival, which is
     * the exact teleport this slice exists to remove.
     */
    expect(byId(marks, 'richard').tile).toEqual(HUDDLE_TILES[1]);
  });

  it('leaves the glass-room meeting alone — its chairs are behind glass', () => {
    expect(momentMarksFor({ meeting: { attendees: ['jared'], modality: 'physical' } })).toEqual([]);
  });
});

describe('nextCommutes', () => {
  it('sets off from their own chair', () => {
    const list = nextCommutes([], momentMarksFor({ coffee }));
    const trip = byId(list, 'intern');
    expect(trip.phase).toBe('out');
    expect(trip.from).toEqual({ x: seatFor('intern').x, y: seatFor('intern').y });
    expect(trip.to).toEqual(COFFEE_TILES[0]);
  });

  it('seeds straight to `there`, so standing up mid-scene shows the scene', () => {
    const list = nextCommutes([], momentMarksFor({ coffee }), { seed: true });
    expect(list.every((c) => c.phase === 'there')).toBe(true);
  });

  it('does not restart a walk when the moment merely re-renders', () => {
    const marks = momentMarksFor({ coffee });
    const first = nextCommutes([], marks);
    const again = nextCommutes(first, momentMarksFor({ coffee }));
    expect(again[0]).toBe(first[0]);
    expect(again[1]).toBe(first[1]);
  });

  it('walks them home when the moment clears, carrying what it gave them', () => {
    const there = nextCommutes([], momentMarksFor({ coffee })).map((c) => ({
      ...c,
      phase: 'there'
    }));
    const home = nextCommutes(there, []);
    const trip = byId(home, 'intern');
    expect(trip.phase).toBe('home');
    expect(trip.from).toEqual(COFFEE_TILES[0]);
    expect(trip.to).toEqual({ x: seatFor('intern').x, y: seatFor('intern').y });
    expect(trip.hands).toBe('coffee');
    expect(trip.trip).toBeGreaterThan(byId(there, 'intern').trip);
  });

  it('sends somebody home even if the moment ended before they arrived', () => {
    const out = nextCommutes([], momentMarksFor({ coffee }));
    expect(out.every((c) => c.phase === 'out')).toBe(true);
    const home = nextCommutes(out, []);
    expect(home.every((c) => c.phase === 'home')).toBe(true);
  });

  it('turns somebody round rather than teleporting them when re-claimed', () => {
    const there = nextCommutes([], momentMarksFor({ coffee })).map((c) => ({
      ...c,
      phase: 'there'
    }));
    const home = nextCommutes(there, []);
    const again = nextCommutes(home, momentMarksFor({ coffee }));
    const trip = byId(again, 'intern');
    expect(trip.phase).toBe('out');
    // They start from where the home leg was heading — their chair — not from a
    // stale mark, so the new walk is continuous with the one it interrupted.
    expect(trip.from).toEqual({ x: seatFor('intern').x, y: seatFor('intern').y });
  });

  it('leaves an in-progress home leg alone', () => {
    const home = nextCommutes(
      nextCommutes([], momentMarksFor({ coffee })).map((c) => ({ ...c, phase: 'there' })),
      []
    );
    expect(nextCommutes(home, [])).toEqual(home);
  });

  it('moves somebody who changes mark without going home first', () => {
    const first = nextCommutes([], momentMarksFor({ huddle: { attendees: ['richard'] } }));
    const moved = nextCommutes(first, [{ id: 'richard', tile: HUDDLE_TILES[3], hands: null }]);
    expect(byId(moved, 'richard').to).toEqual(HUDDLE_TILES[3]);
    expect(byId(moved, 'richard').from).toEqual(HUDDLE_TILES[0]);
  });
});

describe('arriveCommute', () => {
  it('settles an outbound walk at its mark', () => {
    const out = nextCommutes([], momentMarksFor({ coffee }));
    const settled = arriveCommute(out, 'intern');
    expect(byId(settled, 'intern').phase).toBe('there');
    expect(byId(settled, 'greybeard').phase).toBe('out');
  });

  it('drops a commute that has got home', () => {
    const home = nextCommutes(
      nextCommutes([], momentMarksFor({ coffee })).map((c) => ({ ...c, phase: 'there' })),
      []
    );
    expect(idsOf(arriveCommute(home, 'intern'))).toEqual(['greybeard']);
  });

  it('returns the same array when there is nothing to change', () => {
    const list = nextCommutes([], momentMarksFor({ coffee }), { seed: true });
    // A settled walker can report arrival again across a remount; that must not
    // churn state and re-render every figure on the floor.
    expect(arriveCommute(list, 'intern')).toBe(list);
    expect(arriveCommute(list, 'nobody')).toBe(list);
  });
});

describe('marksKey', () => {
  it('changes when a mark moves and not when the array is rebuilt', () => {
    expect(marksKey(momentMarksFor({ coffee }))).toBe(marksKey(momentMarksFor({ coffee })));
    expect(marksKey(momentMarksFor({ coffee }))).not.toBe(marksKey(momentMarksFor({ battle })));
  });
});
