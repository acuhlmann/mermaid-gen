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
import { propHandsFor } from '../src/utils/officeFloorProps.js';
import { interruptSpeech } from '../src/utils/officeFloorInterrupt.js';
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
import {
  _resetOfficeWorkingMemoryForTests,
  getWorkingMemoryWith,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';

/**
 * Ambient floor life (slice 11).
 *
 * Without a WAAPI engine `useWalkAnimation` settles immediately, so a trip's
 * legs land in the tick they start — which makes the whole state machine
 * assertable with nothing but fake timers.
 */

const LEADERSHIP = ['belson', 'cfo', 'ciso', 'barker'];

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
  /*
   * Slice 18's memory outlives the trip on purpose, so it also outlives the
   * test — and every case in this file that mounts the floor can now write to
   * it. Clearing both halves: the module rows, and the day-stamped copy on disk
   * that a fresh read would hydrate from.
   */
  _resetOfficeWorkingMemoryForTests();
  window.localStorage.clear();
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
    expect(wanderingSeatIds()).not.toContain('belson');
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
      'richard',
      'russ',
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

  it('comes back holding what the prop handed over', () => {
    /*
     * § 8's "a held item is drawn, never carried", closed. The trip is the only
     * thing that remembers it, and it remembers it exactly once: empty-handed on
     * the way out, carrying on the way back, forgotten when they sit down.
     */
    const { seen, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.kind).toBe('coffeeMachine');
    expect(seen.wanderer?.carrying).toBeNull();

    arrive();
    // Still at the machine — they are using it, not walking away with it yet.
    expect(seen.wanderer?.phase).toBe('dwell');
    expect(seen.wanderer?.carrying).toBeNull();

    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.phase).toBe('home');
    expect(seen.wanderer?.carrying).toBe('coffee');

    // The errand ends with the trip; nothing outlives it.
    arrive();
    expect(seen.wanderer).toBeNull();
  });

  it('comes back empty-handed when you turn them round before they arrive', () => {
    /*
     * The honest half of the rule. `goHome` has two callers and only one of them
     * means "they used the thing" — claiming their tile mid-stride sends them
     * back from wherever they got to, which was not the coffee machine.
     */
    const { seen, view, Probe } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    const mark = seen.wanderer.to;
    expect(seen.wanderer.phase).toBe('out');

    act(() => view.rerender(<Probe avoidTile={mark} />));
    expect(seen.wanderer.phase).toBe('home');
    expect(seen.wanderer.carrying).toBeNull();
  });

  it('has something to say about it, but only because you are the reason', () => {
    /*
     * Slice 18's whole trigger. `goHome` has two callers and the hook now knows
     * which one rang: an errand that simply ended has nothing to say, and one
     * you walked into does. That distinction is what keeps this on the reactive
     * side of `office-parody.md` § 11 rather than making every ambient trip
     * talkative — nothing here can fire while you are sitting still.
     */
    const { seen, view, Probe } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    const mark = seen.wanderer.to;
    expect(seen.wanderer.interrupted).toBeNull();

    act(() => view.rerender(<Probe avoidTile={mark} />));
    expect(seen.wanderer.interrupted?.reaction).toBe('gaveUp');
  });

  it('stays quiet when the errand just ended on its own', () => {
    const { seen, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    arrive();

    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.phase).toBe('home');
    // They got the coffee and are walking back with it, exactly as in slice 11.
    // Nobody caused that, so nobody is owed a word about it.
    expect(seen.wanderer?.carrying).toBe('coffee');
    expect(seen.wanderer?.interrupted).toBeNull();
  });

  it('says the polite line when they had already used the thing', () => {
    /*
     * The pair, asserted together because they are one fact. `phase === 'dwell'`
     * is what fills the hand *and* what picks the reaction, so somebody
     * apologising for a coffee they are visibly holding is unreachable by
     * construction rather than by review.
     */
    const { seen, view, Probe, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    const mark = seen.wanderer.to;
    arrive();
    expect(seen.wanderer.phase).toBe('dwell');

    act(() => view.rerender(<Probe avoidTile={mark} />));
    expect(seen.wanderer.interrupted?.reaction).toBe('gotIt');
    expect(seen.wanderer.carrying).toBe(propHandsFor(seen.wanderer.kind));
  });

  it('takes the hand from the prop table rather than deciding for itself', () => {
    /*
     * Ties the trip to `FLOOR_PROP_USES` without asserting a literal, so the day
     * somebody gives the whiteboard something to hand over — or takes the
     * printer's away — this test follows rather than fails. Not every errand is
     * a fetch, and which ones are is the table's call, not the hook's.
     */
    const { seen, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    const { kind } = seen.wanderer;

    arrive();
    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.phase).toBe('home');
    expect(seen.wanderer?.carrying).toBe(propHandsFor(kind));
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
    /*
     * Slice 18: an errand *you* ended pauses at the desk before it clears, so
     * the line it is carrying is readable however short the walk back was. An
     * ordinary trip still clears on arrival — see below.
     */
    expect(seen.wanderer?.lingering).toBe(true);
    act(() => vi.advanceTimersByTime(1_800));
    expect(seen.wanderer).toBeNull();
  });

  it('pauses only for a trip that has something to say', () => {
    /*
     * The pause is the delivery, not a new resting state: slice 11's machine is
     * untouched for every errand nobody walked into, which is nearly all of
     * them. A wanderer who lingered after an ordinary trip would just be
     * somebody standing at their own desk for no reason.
     */
    const { seen, arrive } = harness();
    act(() => vi.advanceTimersByTime(9_000));
    arrive();
    act(() => vi.advanceTimersByTime(9_000));
    expect(seen.wanderer?.phase).toBe('home');
    expect(seen.wanderer?.interrupted).toBeNull();

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
 * The afternoon slump (slice 24) — the hour with its thumb on the scale.
 *
 * Driven through the hook with a *real* random rather than a pinned one,
 * because a bias is a distribution: one trip proves nothing either way, and a
 * fixed roll would only prove which entry index the weighting happens to land
 * on. The two arms are the same code at two different clock readings.
 */
describe('where the room drifts at three in the afternoon', () => {
  /** Somebody whose errands include the kitchen *and* somewhere else. */
  const CHOOSY = wanderingSeatIds().find((id) => {
    const kinds = wanderTripsFor(id).map((t) => t.kind);
    return kinds.includes('coffeeMachine') && kinds.length > 1;
  });

  /**
   * A uniform stream that does not inherit whatever the rest of the suite left
   * on `Math.random`, but is still a distribution rather than one pinned roll.
   * Slice 23's lesson stands: we do not consume a different *number* of randoms
   * in the biased arm — only the list we roll against changes with the hour.
   */
  function seededRandomFor(hour) {
    let state = hour * 2_654_435_761;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  function tripsAt(hour, runs = 200) {
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(seededRandomFor(hour));
    const kinds = [];
    try {
      for (let run = 0; run < runs; run += 1) {
        vi.setSystemTime(new Date(2026, 7, 10, hour, 15, 0, 0));
        const { seen } = (() => {
          const box = { wanderer: null };
          function Probe() {
            Object.assign(box, useFloorWander({ busyIds: BUSY_EXCEPT_CHOOSY }));
            return null;
          }
          const view = render(<Probe />);
          act(() => vi.advanceTimersByTime(9_000));
          const result = { seen: box };
          view.unmount();
          return result;
        })();
        if (seen.wanderer?.kind) kinds.push(seen.wanderer.kind);
      }
    } finally {
      randomSpy.mockRestore();
    }
    return kinds;
  }

  /** Everybody except the one person we want picked, so the arm is about the destination. */
  const BUSY_EXCEPT_CHOOSY = wanderingSeatIds().filter((id) => id !== CHOOSY);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('has somebody with a real choice to make, or the rest of this is vacuous', () => {
    expect(CHOOSY, 'nobody has the kitchen plus another errand').toBeTruthy();
    expect(wanderTripsFor(CHOOSY).map((t) => t.kind)).toContain('coffeeMachine');
  });

  it('sends more of them to the kitchen in the slump than at eleven', () => {
    const morning = tripsAt(11);
    const slump = tripsAt(15);
    expect(morning.length, 'no trips started at all').toBeGreaterThan(50);
    expect(slump.length).toBeGreaterThan(50);

    const share = (kinds) => kinds.filter((k) => k === 'coffeeMachine').length / kinds.length;
    // A bias, not a schedule: the morning still sends people for coffee and the
    // afternoon still sends them elsewhere. Only the proportion moves.
    expect(share(slump)).toBeGreaterThan(share(morning));
    expect(share(slump)).toBeLessThan(1);
    expect(share(morning)).toBeGreaterThan(0);
  });

  /**
   * The property that keeps this change invisible to every other floor suite.
   *
   * Slice 23 learned that an unpinned suite shares one `Math.random` stream
   * across a file, so a change that consumes a *different number* of randoms
   * re-seeds who is wandering everywhere else — a red assertion in a test about
   * something else entirely. Weighting by repeating list entries and rolling
   * once keeps the count identical in both arms.
   */
  it('costs the same number of randoms biased or not', () => {
    const rolls = (hour) => {
      const spy = vi.spyOn(Math, 'random');
      vi.setSystemTime(new Date(2026, 7, 10, hour, 15, 0, 0));
      function Probe() {
        useFloorWander({ busyIds: BUSY_EXCEPT_CHOOSY });
        return null;
      }
      const view = render(<Probe />);
      act(() => vi.advanceTimersByTime(9_000));
      const count = spy.mock.calls.length;
      view.unmount();
      spy.mockRestore();
      return count;
    };

    const unbiased = rolls(11);
    expect(unbiased, 'no randoms consumed — the trip never started').toBeGreaterThan(0);
    expect(rolls(15)).toBe(unbiased);
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
    /*
     * The seed alone stopped being enough at slice 24: `wanderBiasAt` gives the
     * wall clock a say in *where* a wanderer goes (3× the coffee machine from
     * two until half four), so an unpinned hour sends Chad to the kitchen for
     * two and a half hours a day and every geometry assertion below is suddenly
     * about the wrong prop. The coverage checks in `floorWithWanderer` do not
     * catch it — he is still Chad and still settled. Midday for
     * `officeFloorActivity.test.jsx`'s reason too: no `PHASE_ART`, so nobody is
     * handed a mug the tests would then have to know about.
     */
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
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
     * the same component — the 34 × 58 box has one definition.
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

  it('actually draws what they are carrying on the walk back', () => {
    /*
     * The same reason the slice 13 suite renders its holds rather than trusting
     * `data-hold`: every assertion above this one would still pass with
     * `HeldItem` drawing nothing, which is what a renamed case looks like from
     * the outside. Chad's row is `typing`, so he carries nothing of his own —
     * anything in his hand here came off the trip.
     */
    const base = { seatId: CHAD, kind: 'coffeeMachine', from: seatFor(CHAD), to: WHITEBOARD };

    const out = render(
      <FloorWanderer
        wanderer={{ ...base, phase: 'out', leg: 1, carrying: null }}
        copy={FLOOR_COPY()}
      />
    );
    expect(out.container.querySelector('.office-floor-person-hold')).toBeNull();
    cleanup();

    const back = render(
      <FloorWanderer
        wanderer={{ ...base, phase: 'home', leg: 2, carrying: 'coffee' }}
        copy={FLOOR_COPY()}
      />
    );
    const figure = back.container.querySelector('.office-floor-person-figure');
    expect(figure.getAttribute('data-hold')).toBe('coffee');
    const layer = figure.querySelector('.office-floor-person-hold');
    expect(layer, 'carrying a coffee with no art').toBeTruthy();
    expect(layer.innerHTML.length, 'the cup is empty').toBeGreaterThan(0);
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
    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/i })).toBeNull();
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

  it('lights their chip within a tile of you, wherever they are settled (slice 15)', () => {
    /*
     * The seat loop in `FloorStage` cannot see them — a wanderer is drawn by
     * `FloorActors` and their desk stands empty — so the reveal has to reach
     * them through `youTile` too. (7, 5) is the standable tile one step from
     * the whiteboard mark; (8, 5) would be nearer but the desk next to it
     * refuses it.
     */
    const { figure } = floorWithWanderer();
    const button = figure.querySelector('button.office-floor-person');
    expect(button.className).not.toContain('is-nearby');

    const { left, top } = projectIso(7, 5);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    expect(
      screen.getByTestId('office-floor-wanderer').querySelector('button.office-floor-person')
        ?.className
    ).toContain('is-nearby');
  });

  it('puts their answer over their head at the prop, not over their desk', () => {
    const imHistory = [
      {
        id: 'a',
        colleagueId: CHAD,
        body: 'Have you tried turning the diagram off and on again?',
        // Answering you where they stand is speech, so it rides the talk
        // channel — the floor only voices what was spoken (medium rule).
        channel: 'talk',
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

/**
 * "Excuse me" — the floor answering back (slice 18).
 *
 * The derivation is unit-tested in `officeFloorInterrupt.test.js`; what is left
 * for here is the part that can only be seen on a stage: the balloon travels
 * with the walker rather than hanging over the tile they left, it clears the
 * signage layer while it is up, and it obeys the same voice-first hide every
 * other line on this floor obeys.
 */
describe('what they say on the way back (slice 18)', () => {
  const CHAD = 'intern';

  /** A trip on its leg home, with or without you having caused it. */
  const goingHome = (interrupted) => ({
    seatId: CHAD,
    kind: 'printer',
    from: propTileFor('printer'),
    to: { x: seatFor(CHAD).x, y: seatFor(CHAD).y },
    phase: 'home',
    leg: 2,
    carrying: null,
    interrupted
  });

  const drawWith = (interrupted) => {
    const trip = goingHome(interrupted);
    return render(
      <FloorWanderer
        wanderer={trip}
        copy={FLOOR_COPY()}
        said={interruptSpeech(trip, FLOOR_COPY())}
        scale={1}
      />
    );
  };

  it('hangs the line on the figure, so it travels home with them', () => {
    /*
     * The reason this is a `FloorBubble` inside the walking anchor rather than a
     * `FloorDeskSpeech` at a tile: every other speaker on this floor is standing
     * still, and this one is walking away from you. A balloon pinned to the tile
     * they were interrupted at points at an empty square by the time it is read.
     */
    const view = drawWith({ reaction: 'gaveUp', roll: 0.25 });
    const anchor = view.container.querySelector('.office-floor-walker-anchor');
    const bubble = anchor.querySelector('.office-floor-bubble');

    expect(bubble, 'no balloon on the walk home').toBeTruthy();
    expect(bubble.textContent).toContain(FLOOR_COPY().props.items.printer.name);
    expect(view.container.querySelector('.office-floor-walker').dataset.said).toBe('gaveUp');
  });

  it('lifts them over the zone signage while the line is up, and not after', () => {
    // § 6 rule 6: a bubble that keeps its depth ordering ends up behind the word
    // POD. Every other floor balloon takes the same lift.
    const speaking = drawWith({ reaction: 'gotIt', roll: 0 });
    expect(
      Number(speaking.container.querySelector('.office-floor-walker').style.zIndex)
    ).toBeGreaterThan(9000);
    cleanup();

    const quiet = drawWith(null);
    const wrapper = quiet.container.querySelector('.office-floor-walker');
    expect(wrapper.querySelector('.office-floor-bubble')).toBeNull();
    expect(wrapper.dataset.said).toBeUndefined();
    expect(Number(wrapper.style.zIndex)).toBeLessThan(9000);
  });
});

describe('walking into somebody else s errand, on a real floor', () => {
  /**
   * 0.75 puts Chad at the whiteboard, as the slice 12 suite above relies on —
   * and only once the hour is pinned as well, for the reason recorded there.
   */
  const CHAD = 'intern';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
    stubRandom(0.75);
  });

  it('takes the square, and gets a word about it', () => {
    /*
     * The whole slice, end to end and through the real wiring: Chad is stood at
     * the whiteboard, you click the tile he is on, and the room does what it has
     * always done — turns him round and walks him back — except that now he says
     * something on the way. Nothing here is new physics; `inYourWay` has sent
     * people home since slice 11.
     */
    renderFloor();
    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByTestId('office-floor-wanderer').dataset.settled).toBe('true');

    const mark = propTileFor('whiteboard');
    const { left, top } = projectIso(mark.x, mark.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    const figure = screen.getByTestId('office-floor-wanderer');
    // He had already reached the board, so this is the polite line and not the
    // sorry one — the same `phase === 'dwell'` that decides what is in his hand.
    expect(figure.dataset.said).toBe('gotIt');
    expect(figure.querySelector('.office-floor-bubble')).toBeTruthy();
    expect(figure.dataset.wanderer).toBe(CHAD);
  });

  it('speaks it, and drops the balloon when the voice took the line', async () => {
    /*
     * Voice-first (slice 10), through the wiring rather than at a prop: captions
     * off and TTS succeeded means the line was heard, so drawing it as well says
     * it twice. Two things this pins that a direct render cannot — that the
     * narrator is handed the *same* line the balloon would have drawn (one
     * `interruptSpeech`, two consumers), and that the signage lift goes with the
     * balloon rather than stranding the figure on top of the zone signs.
     */
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    renderFloor({ sceneHandlers: { narrateLine } });
    act(() => vi.advanceTimersByTime(9_000));

    const mark = propTileFor('whiteboard');
    const { left, top } = projectIso(mark.x, mark.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    // Derived the same way the stage derives it, so this asserts the wiring and
    // not the contents of the bank.
    const expected = interruptSpeech(
      { seatId: CHAD, kind: 'whiteboard', interrupted: { reaction: 'gotIt', roll: 0.75 } },
      FLOOR_COPY()
    );
    expect(narrateLine).toHaveBeenCalledWith({ speakerId: CHAD, text: expected.text });

    // Flush the optimistic-hide promise the narration hook is waiting on.
    await act(async () => {});
    const figure = screen.getByTestId('office-floor-wanderer');
    expect(figure.querySelector('.office-floor-bubble')).toBeNull();
    expect(figure.dataset.said).toBeUndefined();
    expect(Number(figure.style.zIndex)).toBeLessThan(9000);
  });

  it('hands the chair back exactly once, after the line has been read', () => {
    /*
     * § 6 rule 5 across the new pause: while somebody is delivering the line
     * they are drawn by the walker and their chair is empty, and when the trip
     * finally clears the chair fills and the walker goes. Two of anybody — or a
     * seat that refills while the figure is still standing in front of it — is
     * what this rule exists to prevent, and the linger is the first thing on
     * this floor to hold that handover open long enough to assert.
     */
    renderFloor();
    act(() => vi.advanceTimersByTime(9_000));

    const mark = propTileFor('whiteboard');
    const { left, top } = projectIso(mark.x, mark.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    const seat = () => document.querySelector(`[data-seat="${CHAD}"]`);
    expect(screen.getByTestId('office-floor-wanderer').dataset.said).toBe('gotIt');
    expect(seat().dataset.vacant).toBe('true');
    expect(seat().querySelectorAll('.office-floor-person-figure')).toHaveLength(0);

    act(() => vi.advanceTimersByTime(1_800));
    expect(screen.queryByTestId('office-floor-wanderer')).toBeNull();
    expect(seat().dataset.vacant).toBeUndefined();
    expect(seat().querySelectorAll('.office-floor-person-figure')).toHaveLength(1);
  });

  it('keeps the line out of the live region, because a line is not a location', () => {
    /*
     * Slice 11's rule survives slice 18 intact, and the distinction is the one
     * `floor.narration` was written around: the region reports where *bodies*
     * are, and what anybody says stays in their balloon. Narrating both is how
     * every line on this floor gets read out twice.
     *
     * Asserted as "the region never quotes the balloon" rather than as "the
     * region does not change", because it does change and should: you just
     * walked across the room, and where you are standing is exactly what this
     * region is for.
     */
    renderFloor();
    act(() => vi.advanceTimersByTime(9_000));

    const mark = propTileFor('whiteboard');
    const { left, top } = projectIso(mark.x, mark.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    const figure = screen.getByTestId('office-floor-wanderer');
    const said = figure.querySelector('.office-floor-bubble-body').textContent;
    const region = screen.getByTestId('office-floor-narration').textContent;

    expect(said.length).toBeGreaterThan(4);
    expect(region).not.toContain(said);
    expect(region.toLowerCase()).not.toContain('chad');
  });

  /**
   * …and afterwards (`docs/automations/office-life.md` queue 2).
   *
   * Everything above asserts the beat you can see. These assert the one you
   * cannot: whether the colleague still knows about it once the balloon is
   * gone. Before this slice the answer was no, so `useFloorDwell`'s "ask the
   * model only when they have a fact about you" gate stayed shut for the one
   * person in the room with the most reason to mention you.
   */
  const interruptChad = () => {
    renderFloor();
    act(() => vi.advanceTimersByTime(9_000));
    const mark = propTileFor('whiteboard');
    const { left, top } = projectIso(mark.x, mark.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });
  };

  it('leaves a mark the colleague still has when the trip is over', () => {
    expect(hasWorkingMemoryFact(CHAD)).toBe(false);
    interruptChad();
    // Read after the linger has expired and the figure has gone: a fact that
    // dies with the trip is the `carrying` field, not a memory.
    act(() => vi.advanceTimersByTime(1_800));
    expect(screen.queryByTestId('office-floor-wanderer')).toBeNull();

    expect(hasWorkingMemoryFact(CHAD)).toBe(true);
    const lines = workingMemoryPromptLines(CHAD);
    // The circumstance, and then the line the room actually drew — asserted
    // against `interruptSpeech` rather than against the bank, so this follows
    // the copy instead of pinning it.
    const drawn = interruptSpeech(
      { seatId: CHAD, kind: 'whiteboard', interrupted: { reaction: 'gotIt', roll: 0.75 } },
      FLOOR_COPY()
    );
    expect(lines[0]).toMatch(/^you took the spot/);
    expect(lines).toContain(`they said: ${drawn.text}`);
  });

  it('records it once, not once per render of the same interruption', () => {
    /*
     * `interrupted` is set on the tick the trip turns round and survives into
     * the `lingering` update that follows, so a writer keyed on the trip object
     * would file the same collision twice — and a beat cap of four would then
     * hold two facts instead of four.
     */
    interruptChad();
    act(() => vi.advanceTimersByTime(1_800));
    expect(getWorkingMemoryWith(CHAD).beats).toHaveLength(1);
  });

  it('writes nothing when the errand simply ended', () => {
    /*
     * The `byYou` gate, seen from the memory side. An errand that ran its course
     * is a clock finishing, and `office-parody.md` § 11 puts that on the ambient
     * side of the line — nobody is owed a memory of it, and giving them one
     * would open the dwell gate for every colleague who ever fetched a coffee.
     */
    renderFloor();
    act(() => vi.advanceTimersByTime(9_000));
    const wanderer = screen.getByTestId('office-floor-wanderer').dataset.wanderer;
    act(() => vi.advanceTimersByTime(9_000));
    act(() => vi.advanceTimersByTime(9_000));

    expect(wanderer).toBeTruthy();
    expect(hasWorkingMemoryFact(wanderer)).toBe(false);
  });
});
