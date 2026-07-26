// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { useFloorWander } from '../src/components/officeFloor/useFloorWander.js';
import { wanderTripsFor, wanderingSeatIds } from '../src/utils/officeFloorWander.js';
import { propTileFor } from '../src/utils/officeFloorMovement.js';
import {
  FLOOR_SEATS,
  boxesOverlap,
  figureBox,
  headBox,
  isStandableTile,
  seatFor
} from '../src/utils/officeFloorPlan.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';

/**
 * Ambient floor life (slice 11).
 *
 * Without a WAAPI engine `useWalkAnimation` settles immediately, so a trip's
 * legs land in the tick they start — which makes the whole state machine
 * assertable with nothing but fake timers.
 */

const LEADERSHIP = ['cto', 'cfo', 'ciso', 'barker'];

/** Deterministic picks: index 0 everywhere, and the low end of every delay. */
function stubRandom(value = 0) {
  vi.spyOn(Math, 'random').mockReturnValue(value);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  _resetOfficeViewModeForTests();
});

describe('who wanders is an answer the room gives', () => {
  it('seals leadership in as well as out', () => {
    /*
     * § 6 rule 17's pay-off, running backwards. Nobody wrote down that
     * executives do not fetch their own coffee: there is no route out of the
     * fishbowl that does not cross glass, so `wanderTripsFor` finds nowhere for
     * them to go. If a layout change ever opens the glass, this fails — which
     * is the same regression the peek-mark roster is pinned against.
     */
    for (const id of LEADERSHIP) {
      expect(wanderTripsFor(id), `${id} escaped the fishbowl`).toEqual([]);
    }
    expect(wanderingSeatIds()).not.toContain('cto');
  });

  it('leaves out anybody with no desk to leave, and you', () => {
    // Gary lives at the fridge; he is already where he wants to be.
    expect(wanderTripsFor('facilities')).toEqual([]);
    expect(wanderTripsFor('you')).toEqual([]);
  });

  it('pins the roster, so a layout change cannot quietly grow it', () => {
    expect(wanderingSeatIds()).toEqual([
      'refine',
      'innovate',
      'critique',
      'explain',
      'goMad',
      'helpdesk',
      'scrumMaster',
      'intern',
      'greybeard',
      'hr'
    ]);
  });

  it('sends people to prop marks rather than to new geometry', () => {
    for (const id of wanderingSeatIds()) {
      for (const trip of wanderTripsFor(id)) {
        // The same tile you stand on to use the thing — one definition of
        // "somebody could stand here and be seen", not a second one.
        expect(trip.mark).toEqual(propTileFor(trip.kind));
        expect(isStandableTile(trip.mark, { excludeSeatId: id })).toBe(true);
      }
    }
  });

  it('clears your head too, which standability does not check', () => {
    /*
     * `isStandableTile` skips `you` in its face test, on the reasonable
     * assumption that you are the one doing the walking — every mark family
     * before this one was a tile *you* stand on, and you are not at your desk
     * while you stand on it. A wanderer inherits that assumption and breaks it:
     * they stand there while you are still sitting down. The three marks happen
     * to be clear today; this is what notices if a layout change makes one of
     * them park a colleague's shoulders across your face.
     */
    const standing = { seated: false };
    const marks = new Map();
    for (const id of wanderingSeatIds()) {
      for (const trip of wanderTripsFor(id)) marks.set(trip.kind, trip.mark);
    }
    expect(marks.size).toBeGreaterThan(0);

    for (const [kind, mark] of marks) {
      for (const seat of FLOOR_SEATS) {
        const theirs = { x: seat.x, y: seat.y };
        expect(
          boxesOverlap(figureBox(mark, standing), headBox(theirs)),
          `a wanderer at the ${kind} covers ${seat.id}'s head`
        ).toBe(false);
        expect(
          boxesOverlap(figureBox(theirs), headBox(mark, standing)),
          `${seat.id} hides a wanderer at the ${kind}`
        ).toBe(false);
      }
    }
  });
});

describe('the trip machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubRandom();
  });

  /**
   * A bare harness renders no figure, so nothing calls `handleArrive` — the
   * walk is what advances a trip, and the hook only owns departing and
   * yielding. That split is worth seeing: `arrive()` below stands in for the
   * animation, and the whole-floor suite further down does it for real.
   */
  function harness(props = {}) {
    const seen = { wanderer: null, handleArrive: () => {} };
    function Probe(inner) {
      Object.assign(seen, useFloorWander(inner));
      return null;
    }
    const view = render(<Probe {...props} />);
    return { seen, view, Probe, arrive: () => act(() => seen.handleArrive()) };
  }

  it('sends somebody out, lets them dwell, and brings them back', () => {
    const { seen, arrive } = harness();
    expect(seen.wanderer).toBeNull();

    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.seatId).toBe('refine');
    expect(seen.wanderer?.phase).toBe('out');

    arrive();
    expect(seen.wanderer?.phase).toBe('dwell');

    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.phase).toBe('home');
    // A second leg, so the walk restarts rather than the figure teleporting.
    expect(seen.wanderer?.leg).toBe(2);

    arrive();
    expect(seen.wanderer).toBeNull();
  });

  it('never picks somebody a real moment already has', () => {
    const busy = wanderingSeatIds();
    const { seen } = harness({ busyIds: busy });

    act(() => vi.advanceTimersByTime(30_000));
    expect(seen.wanderer).toBeNull();
  });

  it('clears whoever a scene claims mid-trip, rather than walking them back', () => {
    const { seen, view, Probe } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.seatId).toBe('refine');

    // A coffee scene starts and wants Refine: two of him is what § 6 rule 5
    // exists to prevent, and the scene is already drawing one.
    act(() => view.rerender(<Probe busyIds={['refine']} />));
    expect(seen.wanderer).toBeNull();
  });

  it('gives up the square when you head for it, mid-walk or standing', () => {
    const { seen, view, Probe, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    const mark = seen.wanderer.to;

    // Still walking to it — you can claim a tile before they get there, which
    // is what makes the turn-round-in-place handling reachable (§ 6 rule 19).
    expect(seen.wanderer.phase).toBe('out');
    act(() => view.rerender(<Probe avoidTile={mark} />));
    expect(seen.wanderer.phase).toBe('home');
    expect(seen.wanderer.to).toEqual({ x: seatFor('refine').x, y: seatFor('refine').y });

    // Walked home rather than cleared: nothing else is drawing them, so they
    // have to actually leave rather than vanish.
    arrive();
    expect(seen.wanderer).toBeNull();
  });

  it('does not send anybody to the tile you are already on', () => {
    const { seen } = harness({ avoidTile: propTileFor('coffeeMachine') });

    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.to).not.toEqual(propTileFor('coffeeMachine'));
  });

  it('stays put entirely under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {}
    }));
    const { seen } = harness();

    // A walk with no engine is a teleport, and somebody blinking between their
    // desk and the kitchen is not calmer than somebody walking there.
    act(() => vi.advanceTimersByTime(60_000));
    expect(seen.wanderer).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('the floor with somebody up and about', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubRandom();
  });

  it('empties their desk while they are out and fills it again after', () => {
    standUp();
    const view = render(<OfficeFloor />);
    const seat = () => view.container.querySelector('[data-seat="refine"]');

    expect(seat()?.dataset.vacant).toBeUndefined();

    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByTestId('office-floor-wanderer').dataset.wanderer).toBe('refine');
    // § 6 rule 5: the furniture stays, the person doesn't.
    expect(seat()).toBeTruthy();
    expect(seat()?.dataset.vacant).toBe('true');

    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.queryByTestId('office-floor-wanderer')).toBeNull();
    expect(seat()?.dataset.vacant).toBeUndefined();
  });

  it('says nothing about it', () => {
    standUp();
    render(<OfficeFloor />);
    const region = screen.getByTestId('office-floor-narration');
    const before = region.textContent;

    act(() => vi.advanceTimersByTime(9_000));

    /*
     * Ambient traffic is the one class of event on this floor with nothing to
     * say. A live region that reads out every trip to the printer is a live
     * region people turn off, and then it is not there for the walk-by that
     * mattered.
     */
    expect(screen.getByTestId('office-floor-wanderer')).toBeTruthy();
    expect(region.textContent).toBe(before);
  });

  it('walks them from their own desk', () => {
    standUp();
    const view = render(<OfficeFloor />);
    act(() => vi.advanceTimersByTime(9_000));

    const desk = seatFor('refine');
    const trip = wanderTripsFor('refine')[0];
    expect(view.container.querySelector('[data-wanderer="refine"]')).toBeTruthy();
    // Started at the desk they vacated, ended at a real prop mark.
    expect(trip.mark).toEqual(propTileFor(trip.kind));
    expect(desk.desk).toBe(true);
  });
});
