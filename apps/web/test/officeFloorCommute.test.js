import { describe, expect, it } from 'vitest';
import {
  arriveCommute,
  marksKey,
  momentMarksFor,
  nextCommutes
} from '../src/utils/officeFloorCommute.js';
import {
  COFFEE_TILES,
  HUDDLE_TILES,
  MEETING_SEATS,
  MEETING_THRESHOLD_TILES,
  YOU_SEAT_ID,
  isStandableTile,
  pathCrossesGlass,
  seatFor,
  walkPathBetween
} from '../src/utils/officeFloorPlan.js';

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

  /*
   * Slice 27 replaces slice 17's "the glass room is deliberately absent". The
   * room is still sealed — nothing about the geometry moved — but attendees now
   * walk to a threshold *outside* it and get cut into their chairs on arrival.
   */
  it('walks a meeting attendee to a threshold outside the sealed room', () => {
    const marks = momentMarksFor({
      meeting: { attendees: ['jared'], modality: 'physical' }
    });
    expect(idsOf(marks)).toEqual(['jared']);
    const { tile } = marks[0];
    expect(MEETING_THRESHOLD_TILES).toContainEqual(tile);
    // Outside the room's rect [9.4, 5.7, 11.5, 8.5], and reachable without
    // walking through a wall — the two claims the threshold exists to make.
    expect(tile.x >= 9.4 && tile.x <= 11.5 && tile.y >= 5.7 && tile.y <= 8.5).toBe(false);
    const seat = seatFor('jared');
    expect(pathCrossesGlass(walkPathBetween({ x: seat.x, y: seat.y }, tile, 'jared'))).toBe(false);
  });

  it('stays out of a remote sync, where nobody leaves their desk', () => {
    expect(momentMarksFor({ meeting: { attendees: ['jared'], modality: 'remote' } })).toEqual([]);
  });

  /*
   * The finding that shaped the slice. Leadership sit inside their *own*
   * fishbowl along the back wall, so every route out of it crosses glass and no
   * threshold can help them — they keep slice 5's behaviour and appear in their
   * chair. This is what forces `FloorMeeting` to ask "who is still walking"
   * rather than "who has arrived": gating on arrival would erase them.
   */
  it('cannot walk somebody sealed in the leadership glass, and says so by omission', () => {
    const marks = momentMarksFor({
      meeting: { attendees: ['belson', 'cfo', 'jared'], modality: 'physical' }
    });
    expect(idsOf(marks)).toEqual(['jared']);
  });

  it('never puts two attendees on one threshold tile', () => {
    const attendees = ['scrumMaster', 'gilfoyle', 'dinesh', 'hr', 'greybeard', 'russ', 'jared'];
    const marks = momentMarksFor({ meeting: { attendees, modality: 'physical' } });
    // The coverage claim: a queue that allocated nothing would pass the
    // uniqueness assertion below while examining an empty list.
    expect(marks.length).toBe(attendees.length);
    const keys = marks.map((mark) => `${mark.tile.x},${mark.tile.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lets a scene keep somebody a meeting also wants (§ 6 rule 5)', () => {
    const marks = momentMarksFor({
      coffee,
      meeting: { attendees: ['intern'], modality: 'physical' }
    });
    expect(idsOf(marks)).toEqual(['intern', 'greybeard']);
    expect(byId(marks, 'intern').tile).toEqual(COFFEE_TILES[0]);
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

/**
 * The threshold's geometry (§ 5 slice 27).
 *
 * Asserted over the whole fan rather than a sample, because what breaks these
 * is a layout change — a desk moving, a panel resizing — and a spot check would
 * keep passing while the door drifted inside the room it is meant to be outside.
 */
describe('the way into the glass room', () => {
  /** The meeting-room zone rect from `FLOOR_ZONES`. */
  const ROOM = { x1: 9.4, y1: 5.7, x2: 11.5, y2: 8.5 };
  const insideRoom = (t) => t.x >= ROOM.x1 && t.x <= ROOM.x2 && t.y >= ROOM.y1 && t.y <= ROOM.y2;

  it('has a tile for every chair, or the last attendees share one', () => {
    // The pile-up § 8 predicted: they set off together, so the fan has to be at
    // least as long as the roster it serves.
    expect(MEETING_THRESHOLD_TILES.length).toBeGreaterThanOrEqual(MEETING_SEATS.length);
  });

  it('stands every tile outside the sealed room, and somewhere a person fits', () => {
    expect(MEETING_THRESHOLD_TILES.length).toBeGreaterThan(0);
    for (const tile of MEETING_THRESHOLD_TILES) {
      expect(insideRoom(tile), `(${tile.x},${tile.y}) is inside the room`).toBe(false);
      expect(isStandableTile(tile), `(${tile.x},${tile.y}) is not standable`).toBe(true);
    }
  });

  /*
   * The claim the whole design rests on: nothing about the glass changed. If a
   * threshold were reachable only by walking through a wall it would be a door
   * with extra steps, which is the option § 8 explicitly did not take.
   */
  it('is reachable from somewhere without crossing glass, for every tile', () => {
    for (const tile of MEETING_THRESHOLD_TILES) {
      const reachable = ['gilfoyle', 'dinesh', 'jared', 'hr', 'greybeard', 'russ'].some(
        (id) => !pathCrossesGlass(walkPathBetween({ x: seatFor(id).x, y: seatFor(id).y }, tile, id))
      );
      expect(reachable, `nobody can reach (${tile.x},${tile.y})`).toBe(true);
    }
  });

  it('never routes an attendee through the glass to get there', () => {
    const attendees = ['scrumMaster', 'gilfoyle', 'dinesh', 'hr', 'greybeard', 'russ', 'jared'];
    const marks = momentMarksFor({ meeting: { attendees, modality: 'physical' } });
    expect(marks.length).toBe(attendees.length);
    for (const mark of marks) {
      const seat = seatFor(mark.id);
      const path = walkPathBetween({ x: seat.x, y: seat.y }, mark.tile, mark.id);
      expect(pathCrossesGlass(path), `${mark.id} walks through glass`).toBe(false);
    }
  });
});

/**
 * Slice 27's one change to the seed, and the reason it exists: calling a
 * physical meeting from your desk stands you up, so the floor mounts on a room
 * that has not started. Seeding that teleports everybody into the chairs the
 * slice exists to walk them into.
 */
describe('a meeting you stood up for still walks in', () => {
  const convening = { attendees: ['jared', 'gilfoyle'], modality: 'physical', transcript: [] };
  const underway = { ...convening, transcript: [{ speakerId: 'jared', text: 'right.' }] };

  it('sets off on the seeded first pass while the room is still filling', () => {
    const list = nextCommutes([], momentMarksFor({ meeting: convening }), { seed: true });
    expect(list.length).toBe(2);
    for (const commute of list) expect(commute.phase).toBe('out');
  });

  it('seats them straight away when you stand up into one already talking', () => {
    const list = nextCommutes([], momentMarksFor({ meeting: underway }), { seed: true });
    expect(list.length).toBe(2);
    for (const commute of list) expect(commute.phase).toBe('there');
  });

  /*
   * The half the threshold gets for free, and the beat that was worst before:
   * a meeting *ending* used to blink sixteen people out of sealed chairs.
   * `nextCommutes` starts the home leg from wherever the out leg was heading,
   * so they reappear at the door and walk back to their desks.
   */
  it('disperses from the door rather than vanishing from the chairs', () => {
    const walking = nextCommutes([], momentMarksFor({ meeting: convening }));
    const arrived = walking.reduce((list, commute) => arriveCommute(list, commute.id), walking);
    const home = nextCommutes(arrived, []);

    expect(home.length).toBe(2);
    for (const commute of home) {
      expect(commute.phase).toBe('home');
      expect(MEETING_THRESHOLD_TILES).toContainEqual(commute.from);
      expect(commute.to).toEqual({ x: seatFor(commute.id).x, y: seatFor(commute.id).y });
    }
  });
});
