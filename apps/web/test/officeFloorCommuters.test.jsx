// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FloorScene from '../src/components/officeFloor/FloorScene.jsx';
import FloorHuddle from '../src/components/officeFloor/FloorHuddle.jsx';
import FloorCommuters from '../src/components/officeFloor/FloorCommuters.jsx';
import { FloorMeeting } from '../src/components/officeFloor/FloorMeeting.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { seatFor, COFFEE_TILES } from '../src/utils/officeFloorPlan.js';

/**
 * Slice 17 — getting there and getting back.
 *
 * jsdom has no WAAPI engine, so `useWalkAnimation` settles every walk in one
 * tick: the *motion* is not observable here and is verified in a browser
 * instead. What is deterministic — and what actually protects the slice — is the
 * hand-off contract: exactly one surface may draw a given person at a time
 * (§ 6 rule 5), and which one depends on whether they have arrived.
 */

const coffee = {
  id: 'c1',
  accepted: true,
  lines: [
    { speakerId: 'intern', text: 'so anyway' },
    { speakerId: 'greybeard', text: 'mm' }
  ]
};

const huddle = {
  attendees: ['richard', 'jared'],
  phase: 'watching',
  beats: []
};

afterEach(cleanup);

describe('a scene only draws whoever has arrived', () => {
  const renderScene = (settledIds) =>
    render(
      <FloorScene
        kind="coffee"
        scene={coffee}
        scale={1}
        visibleLines={1}
        lineSpoken={false}
        settledIds={settledIds}
      />
    );

  it('draws nobody at the machine while both are still walking', () => {
    renderScene(new Set());
    expect(screen.queryByTestId('office-floor-scene-actor-intern')).toBeNull();
    expect(screen.queryByTestId('office-floor-scene-actor-greybeard')).toBeNull();
  });

  it('draws each one as they get there, not all at once', () => {
    renderScene(new Set(['intern']));
    expect(screen.getByTestId('office-floor-scene-actor-intern')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-scene-actor-greybeard')).toBeNull();
  });

  it('stages the whole cast when nobody is asking — a standalone mount', () => {
    // `null` is "don't ask": a `FloorScene` rendered on its own has no commute
    // wiring behind it and must not come up empty.
    renderScene(null);
    expect(screen.getByTestId('office-floor-scene-actor-intern')).toBeTruthy();
    expect(screen.getByTestId('office-floor-scene-actor-greybeard')).toBeTruthy();
  });

  it('keeps the invite panel up while its asker is still on the way', () => {
    render(
      <FloorScene
        kind="coffee"
        scene={{ ...coffee, accepted: false }}
        scale={1}
        settledIds={new Set()}
      />
    );
    // The ask is the moment, not the person: the panel stays, the figure waits.
    expect(screen.getByTestId('office-floor-coffee-invite')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-scene-actor-intern')).toBeNull();
  });
});

describe('a huddle ring only draws whoever has arrived', () => {
  it('holds a teammate’s slot until they get to it', () => {
    render(<FloorHuddle huddle={huddle} scale={1} settledIds={new Set(['richard'])} />);
    expect(screen.queryByTestId('office-floor-huddle-seat-richard')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-huddle-seat-jared')).toBeNull();
  });

  it('stages the whole ring on a standalone mount', () => {
    render(<FloorHuddle huddle={huddle} scale={1} />);
    expect(screen.queryByTestId('office-floor-huddle-seat-richard')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-huddle-seat-jared')).toBeTruthy();
  });
});

describe('FloorCommuters', () => {
  const commute = (overrides) => ({
    id: 'intern',
    from: { x: seatFor('intern').x, y: seatFor('intern').y },
    to: COFFEE_TILES[0],
    phase: 'out',
    hands: 'coffee',
    trip: 1,
    ...overrides
  });

  it('draws one travelling figure per commute, tagged with its phase', () => {
    render(
      <FloorCommuters
        commuters={[commute({}), commute({ id: 'greybeard', phase: 'home', trip: 2 })]}
        onArrive={vi.fn()}
      />
    );
    const figures = screen.getAllByTestId('office-floor-commuter');
    expect(figures).toHaveLength(2);
    expect(figures[0].dataset.commutePhase).toBe('out');
    expect(figures[1].dataset.commutePhase).toBe('home');
  });

  it('reports arrival by id, which is what advances the phase', () => {
    const onArrive = vi.fn();
    // No animation engine in jsdom, so the walk settles on mount — which is
    // also exactly the reduced-motion path, and both must still report.
    render(<FloorCommuters commuters={[commute({})]} onArrive={onArrive} />);
    expect(onArrive).toHaveBeenCalledWith('intern');
  });

  it('renders nothing when nobody is on the move', () => {
    const { container } = render(<FloorCommuters commuters={[]} onArrive={vi.fn()} />);
    expect(container.querySelector('[data-testid="office-floor-commuter"]')).toBeNull();
  });
});

/**
 * The glass room asks the opposite question (§ 5 slice 27).
 *
 * `FloorScene` and `FloorHuddle` gate on `settledIds` — absent means still
 * walking — and that works because their whole cast commutes. The meeting's
 * does not: the leadership tier is sealed in its own fishbowl with no glass-free
 * route to a threshold, so it never sets off. Gating on arrival would delete
 * every executive from the meeting, which is why this surface takes
 * `walkingIds` instead. Both halves are asserted, because the version that only
 * checks the walker passes while the room is quietly empty.
 */
describe('the glass room draws whoever is not still walking', () => {
  const meeting = {
    state: 'playing',
    title: 'Architecture Review Board',
    attendees: ['scrumMaster', 'cfo'],
    facilitatorId: 'scrumMaster',
    transcript: [],
    completed: false,
    interjectionsLeft: 2
  };

  const renderMeeting = (walkingIds) =>
    render(
      <FloorMeeting
        meeting={meeting}
        copy={officeChromeCopy().floor}
        scale={1}
        walkingIds={walkingIds}
      />
    );

  it('holds a chair empty while its owner is crossing the floor', () => {
    renderMeeting(new Set(['scrumMaster']));
    expect(screen.queryByTestId('office-floor-meeting-seat-scrumMaster')).toBeNull();
    // The half that matters more: somebody who never commuted is still in the
    // room. This is the assertion that fails if the surface is switched to the
    // `settledIds` test its siblings use.
    expect(screen.getByTestId('office-floor-meeting-seat-cfo')).toBeTruthy();
  });

  it('seats them the moment they arrive', () => {
    renderMeeting(new Set());
    expect(screen.getByTestId('office-floor-meeting-seat-scrumMaster')).toBeTruthy();
    expect(screen.getByTestId('office-floor-meeting-seat-cfo')).toBeTruthy();
  });

  it('seats the whole roster for a standalone mount that has no commute hook', () => {
    renderMeeting(null);
    expect(screen.getByTestId('office-floor-meeting-seat-scrumMaster')).toBeTruthy();
    expect(screen.getByTestId('office-floor-meeting-seat-cfo')).toBeTruthy();
  });
});
