// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import FloorWanderer from '../src/components/officeFloor/FloorWanderer.jsx';
import { useFloorWander } from '../src/components/officeFloor/useFloorWander.js';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { renderFloor } from './helpers/officeFloorTestUtils.jsx';
import { wanderTripsFor, wanderingSeatIds } from '../src/utils/officeFloorWander.js';
import { approachTileFor, propTileFor } from '../src/utils/officeFloorMovement.js';
import {
  FLOOR_SEATS,
  boxesOverlap,
  figureBox,
  headBox,
  isStandableTile,
  projectIso,
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

/** The floor's copy bundle, for the two tests that render an actor directly. */
const FLOOR_COPY = () => officeChromeCopy().floor;

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
      'gilfoyle',
      'dinesh',
      'erlich',
      'jared',
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
    expect(seen.wanderer?.seatId).toBe('gilfoyle');
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
    expect(seen.wanderer?.seatId).toBe('gilfoyle');

    // A coffee scene starts and wants Refine: two of him is what § 6 rule 5
    // exists to prevent, and the scene is already drawing one.
    act(() => view.rerender(<Probe busyIds={['gilfoyle']} />));
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
    expect(seen.wanderer.to).toEqual({ x: seatFor('gilfoyle').x, y: seatFor('gilfoyle').y });

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
    const seat = () => view.container.querySelector('[data-seat="gilfoyle"]');

    expect(seat()?.dataset.vacant).toBeUndefined();

    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByTestId('office-floor-wanderer').dataset.wanderer).toBe('gilfoyle');
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

    const desk = seatFor('gilfoyle');
    const trip = wanderTripsFor('gilfoyle')[0];
    expect(view.container.querySelector('[data-wanderer="gilfoyle"]')).toBeTruthy();
    // Started at the desk they vacated, ended at a real prop mark.
    expect(trip.mark).toEqual(propTileFor(trip.kind));
    expect(desk.desk).toBe(true);
  });
});

/**
 * Reaching them while they are up (slice 12).
 *
 * Without a WAAPI engine a walk settles in the tick it starts, so `handleArrive`
 * has already fired by the time the timers are flushed — which is why a single
 * `advanceTimersByTime` lands a wanderer in `dwell` rather than in `out`.
 */
describe('somebody who is not at their desk', () => {
  /**
   * 0.7 picks Chad (`intern`) out of the ten-strong roster, which matters: the
   * five advisors are the *team* tier and have no Slop Chat™, so the default
   * 0-pick lands on somebody with no social verbs at all and none of this is
   * observable. 0.7 also fixes every delay at the same fraction — a 7.5 s first
   * trip and a 7.5 s dwell.
   */
  const CHAD = 'intern';
  const WHITEBOARD = { x: 8, y: 4 };

  beforeEach(() => {
    vi.useFakeTimers();
    stubRandom(0.75);
  });

  /** The floor with Chad stood at the prop his ladder picks. */
  function floorWithWanderer(props = {}) {
    const view = renderFloor(props);
    act(() => vi.advanceTimersByTime(9_000));
    const figure = screen.getByTestId('office-floor-wanderer');
    expect(figure.dataset.wanderer).toBe(CHAD);
    expect(figure.dataset.settled).toBe('true');
    return { view, figure, mark: WHITEBOARD };
  }

  it('goes to the prop mark the geometry picked, so the rest of this is pinned', () => {
    const { mark } = floorWithWanderer();
    expect(propTileFor('whiteboard')).toEqual(mark);
    expect(wanderTripsFor(CHAD).map((t) => t.kind)).toContain('whiteboard');
  });

  it('makes the settled figure the button, and leaves nothing on their chair', () => {
    const { view, figure } = floorWithWanderer();

    /*
     * One person, one hit target: it travels with them rather than being copied
     * onto the chair, which is what keeps them out of the tab order twice and out
     * of § 6 rule 23's way. Same class as a seated figure because it is literally
     * the same component — the 34 × 48 box has one definition.
     */
    const button = figure.querySelector('button.office-floor-person');
    expect(button).toBeTruthy();
    expect(button.className).not.toContain('is-seated');
    expect(button.querySelector('.office-floor-person-name')?.textContent).toContain('Chad');
    expect(
      view.container.querySelector(`[data-seat="${CHAD}"] button.office-floor-person`)
    ).toBeNull();
  });

  it('says where they are in the label, which is where the room answers it', () => {
    const { figure } = floorWithWanderer();
    const label = figure.querySelector('button.office-floor-person').getAttribute('aria-label');

    /*
     * Slice 11 decided ambient traffic is not narrated and slice 12 does not
     * reopen that — a live region reading out every trip to the printer is one
     * people turn off, and then it is not there for the walk-by that mattered.
     * What changed is that a *target* has to say what it is, so the place rides
     * on the button instead of on the region.
     */
    expect(label).toContain('Chad');
    expect(label.toLowerCase()).toContain('whiteboard');
  });

  it('renders no button at all while they are crossing the room', () => {
    /*
     * The mid-walk case, which the whole-floor harness cannot show: without a
     * WAAPI engine a walk settles in the tick it starts, so `out` and `home` are
     * never on screen there. A moving hit target is a coin flip and a mark
     * derived from a tile they have not reached is a mark they will not be at, so
     * both legs render the plain slice 11 figure.
     */
    const base = { seatId: CHAD, kind: 'whiteboard', from: seatFor(CHAD), to: WHITEBOARD, leg: 1 };
    for (const phase of ['out', 'home']) {
      const view = render(
        <FloorWanderer wanderer={{ ...base, phase }} copy={FLOOR_COPY()} onSelect={() => {}} />
      );
      expect(view.container.querySelector('button.office-floor-person'), phase).toBeNull();
      expect(view.container.querySelector('.office-floor-walker-anchor'), phase).toBeTruthy();
      cleanup();
    }

    const settled = render(
      <FloorWanderer
        wanderer={{ ...base, phase: 'dwell' }}
        copy={FLOOR_COPY()}
        onSelect={() => {}}
      />
    );
    expect(settled.container.querySelector('button.office-floor-person')).toBeTruthy();
  });

  it('opens a card that says where they are, with no shoulder to look over', () => {
    const { figure } = floorWithWanderer();
    fireEvent.click(figure.querySelector('button.office-floor-person'));

    // The card explains the verb that is missing rather than disabling it
    // (slice 9's rule), and a peek needs a shoulder that is still at the desk.
    expect(screen.getByText(/Away from their desk/i).textContent.toLowerCase()).toContain(
      'whiteboard'
    );
    expect(screen.queryByRole('button', { name: /Their screen/i })).toBeNull();
    // Slop Chat™ reaches them wherever they are: rule 2's labelled conventional
    // path outliving the diegetic one is the rule working, not a gap.
    expect(screen.getByRole('button', { name: /Message/i })).toBeTruthy();
  });

  it('aims Go and talk at where they are standing, not at the chair they left', () => {
    const { mark } = floorWithWanderer({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByTestId('office-floor-wanderer').querySelector('button'));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    const stand = approachTileFor(CHAD, { at: mark });
    const { left, top } = projectIso(stand.x, stand.y);
    expect(screen.getByTestId('office-floor-player').style.transform).toBe(
      `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
    );
    // Emphatically not the seat mark — that is the bug the slice exists to fix.
    expect(stand).not.toEqual(approachTileFor(CHAD));
  });

  it('holds them while you have their card open, and lets them go when you close it', () => {
    const { figure } = floorWithWanderer();
    fireEvent.click(figure.querySelector('button.office-floor-person'));

    /*
     * The dwell clock is 4–9 s and reading a card takes longer than that. Without
     * the hold, whoever you crossed the room for wanders off mid-sentence and the
     * card you are reading describes somebody who has gone. Ambience still loses
     * — it loses by waiting.
     */
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByTestId('office-floor-wanderer').dataset.settled).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /Close/i }));
    // Released, and the clock starts fresh rather than having run down while held.
    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.queryByTestId('office-floor-wanderer')).toBeNull();
  });

  it('puts their answer over their head at the prop, not over their desk', () => {
    const imHistory = [
      {
        id: 'a',
        colleagueId: CHAD,
        body: 'Have you tried turning the diagram off and on again?',
        createdAt: Date.now()
      }
    ];
    const { mark } = floorWithWanderer({ imHistory, onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByTestId('office-floor-wanderer').querySelector('button'));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    const bubble = screen.getByTestId('office-floor-talk-line');
    const { left, top } = projectIso(mark.x, mark.y);
    expect(bubble.style.left).toBe(`${left}px`);
    expect(bubble.style.top).toBe(`${top}px`);
    // § 6 rule 20 generalized: away from their desk there is no seat lift to
    // clear, whatever their desk would imply.
    expect(bubble.querySelector('.office-floor-walker-anchor--over-standing')).toBeTruthy();
    expect(bubble.querySelector('.office-floor-walker-anchor--over-seat')).toBeNull();
  });
});
