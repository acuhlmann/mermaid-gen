// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { FloorPropCard } from '../src/components/officeFloor/FloorProps.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { usablePropKinds } from '../src/utils/officeFloorMovement.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';

/**
 * Props you can use (slice 9) — ADR-0011 rule 2's first worked example on the
 * floor: the coffee machine pours the same break the desk dock's labelled
 * *Get coffee* pours, through the same verb.
 *
 * As in the peek and talk suites, jsdom has no WAAPI engine so `useWalkAnimation`
 * settles immediately — clicking the machine lands you at it in one tick, which
 * is also exactly the reduced-motion behaviour.
 */
function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

const machine = () => screen.getByRole('button', { name: /Coffee machine/i });

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
});

describe('usable props (slice 9)', () => {
  it('pours the same coffee break the desk verb pours', async () => {
    const onGetCoffee = vi.fn().mockResolvedValue(true);
    renderFloor({ onGetCoffee });

    fireEvent.click(machine());

    // Rule 2: the machine *duplicates* the labelled control, so what it fires
    // has to be that control and not a floor-only copy of it.
    await waitFor(() => expect(onGetCoffee).toHaveBeenCalledTimes(1));
  });

  it('fires the printer cue sequence when you walk up to the printer', async () => {
    const onPropCue = vi.fn();
    renderFloor({ onPropCue, onGetCoffee: vi.fn().mockResolvedValue(true) });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));

    await waitFor(() => expect(onPropCue).toHaveBeenCalledWith('printer'));
  });

  it('walks you there and empties your own desk on the way', () => {
    const view = renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();

    fireEvent.click(machine());

    expect(screen.getByTestId('office-floor-player')).toBeTruthy();
    // § 6 rule 5 once more: the furniture stays, the person doesn't.
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBe('true');
  });

  it('says what happened in the card slot, not over the machine', async () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    fireEvent.click(machine());

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/it grinds, it hisses/i));
    // § 6 rule 12: chrome goes in the slot. Nothing is pinned to the room, and
    // nobody is speaking — a printer with a speech bubble is a different game.
    expect(screen.queryByTestId('office-floor-panel')).toBeNull();
    expect(screen.queryByTestId('office-floor-peek-line')).toBeNull();
  });

  it('says so instead of failing silently when the verb is blocked', async () => {
    // `getCoffee` returns false when the desk is busy or a surface is already
    // up. A machine that quietly does nothing reads as a broken machine.
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(false) });
    fireEvent.click(machine());

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/already making one/i));
  });

  it('pours exactly one coffee however often it re-renders', async () => {
    const onGetCoffee = vi.fn().mockResolvedValue(true);
    const view = renderFloor({ onGetCoffee });
    fireEvent.click(machine());
    await waitFor(() => expect(onGetCoffee).toHaveBeenCalledTimes(1));

    view.rerender(<OfficeFloor onGetCoffee={onGetCoffee} />);
    view.rerender(<OfficeFloor onGetCoffee={vi.fn()} />);

    expect(onGetCoffee).toHaveBeenCalledTimes(1);
  });

  it('produces nothing at all at the props that produce nothing', async () => {
    // ADR-0010: the office generates no artifacts. Three of the four props are
    // a line and a walk, and that is the whole feature.
    const onGetCoffee = vi.fn();
    renderFloor({ onGetCoffee });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/PC LOAD LETTER/i));
    expect(onGetCoffee).not.toHaveBeenCalled();
  });

  it('walks you home again, and Escape does the same before it sits you down', () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    fireEvent.click(machine());

    fireEvent.click(screen.getByRole('button', { name: /Back to my desk/i }));
    expect(screen.queryByTestId('office-floor-prop-card')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.click(machine());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('office-floor-prop-card')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('offers a button only for the props the room can give you a mark for', () => {
    const view = renderFloor({ onGetCoffee: vi.fn() });

    // Sorted because the DOM order is the paint order (`FLOOR_PROPS`, back to
    // front) while the roster's is `FLOOR_PROP_USES` — the same set either way.
    const buttons = view.container.querySelectorAll('.office-floor-prop--usable');
    expect([...buttons].map((el) => el.dataset.prop).sort()).toEqual([...usablePropKinds()].sort());
    // The cooler and the plants stay scenery: no dead click, and no disabled
    // control explaining why it is disabled (§ 6 rule 21).
    expect(view.container.querySelector('[data-prop="waterCooler"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /cooler/i })).toBeNull();
  });

  it('draws three plants and offers one of nothing', () => {
    // Only the first prop of a kind is the usable one, or the kitchen would
    // grow three identically-named buttons.
    const view = renderFloor({ onGetCoffee: vi.fn() });
    const plants = view.container.querySelectorAll('.office-floor-prop');
    expect(plants.length).toBeGreaterThan(10);
    expect(view.container.querySelectorAll('[data-prop="coffeeMachine"]')).toHaveLength(1);
  });

  it('takes the machine away while a meeting has you in a chair', () => {
    const meeting = {
      state: 'playing',
      title: 'Architecture Review Board',
      attendees: ['scrumMaster', 'gilfoyle'],
      facilitatorId: 'scrumMaster',
      transcript: [{ speakerId: 'gilfoyle', kind: 'substantive', text: 'The gateway is fine.' }],
      interjectionsLeft: 2
    };
    const view = renderFloor({ onGetCoffee: vi.fn() });
    view.rerender(<OfficeFloor meeting={meeting} onGetCoffee={vi.fn()} />);

    expect(view.container.querySelector('.office-floor-prop--usable')).toBeNull();
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
  });

  it('replaces the person card, because you have one body', async () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true), onMessage: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();

    fireEvent.click(machine());

    expect(await screen.findByTestId('office-floor-prop-card')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();
  });
});

/**
 * Looking closer (§ 8 "examine / look at").
 *
 * § 8's own examples name the fridge and its sticky notes, but no unclaimed
 * kitchen prop is reachable — `propTileFor('fridge')` and `propTileFor(
 * 'waterCooler')` are both null — so the idea lands on what § 8 actually
 * describes: "a few props that today only have a line", given somewhere for
 * that line to go.
 */
describe('looking closer at a prop', () => {
  const propCopy = () => officeChromeCopy().floor.props;

  const renderCard = (propKind, phase = 'idle') =>
    render(
      <FloorPropCard
        prop={{ propKind, phase: 'using' }}
        phase={phase}
        copy={officeChromeCopy().floor}
        onBack={vi.fn()}
      />
    );

  it('shows the main line first, and the detail only once you look', () => {
    const item = propCopy().items.whiteboard;
    renderCard('whiteboard');
    expect(screen.getByText(item.line)).toBeTruthy();

    fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.queryByText(item.line)).toBeNull();
    expect(screen.getByText(item.details[0])).toBeTruthy();
  });

  it('cycles and wraps, so a prop never runs out of things to notice', () => {
    const item = propCopy().items.printer;
    renderCard('printer');
    for (let i = 0; i < item.details.length; i += 1) {
      fireEvent.click(screen.getByTestId('office-floor-prop-look'));
      expect(screen.getByText(item.details[i])).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.getByText(item.details[0])).toBeTruthy();
  });

  it('every usable prop has something to find', () => {
    for (const kind of usablePropKinds()) {
      expect(propCopy().items[kind]?.details?.length ?? 0).toBeGreaterThan(0);
    }
  });

  /** Mid-pour there is nothing to read — the card is reporting a verb. */
  it('does not offer a look while the prop is working or blocked', () => {
    renderCard('coffeeMachine', 'working');
    expect(screen.queryByTestId('office-floor-prop-look')).toBeNull();
    cleanup();
    renderCard('coffeeMachine', 'blocked');
    expect(screen.queryByTestId('office-floor-prop-look')).toBeNull();
  });
});

/**
 * The board on the whiteboard (slice 16).
 *
 * The card is where the *readable* half of that slice lives — 62 px of panel
 * can carry the shape of your diagram and not its labels — so these pin the
 * pair of copy states rather than the drawing.
 */
describe('the whiteboard carries your diagram', () => {
  const propCopy = () => officeChromeCopy().floor.props;

  const renderCard = (board) =>
    render(
      <FloorPropCard
        prop={{ propKind: 'whiteboard', phase: 'using' }}
        phase="idle"
        copy={officeChromeCopy().floor}
        board={board}
        onBack={vi.fn()}
      />
    );

  const board = {
    kind: 'mermaid',
    shape: 'graph',
    nodes: 4,
    edges: 3,
    labels: ['Client', 'API Gateway', 'Auth Service', 'Orders'],
    bars: [],
    mini: { nodes: [], edges: [] }
  };

  it('keeps the architecture from two re-orgs ago as the empty state', () => {
    renderCard(null);
    expect(screen.getByText(propCopy().items.whiteboard.line)).toBeTruthy();
  });

  it('names what is on the board once you have drawn something', () => {
    renderCard(board);
    expect(screen.queryByText(propCopy().items.whiteboard.line)).toBeNull();
    // The node count is interpolated, so the empty-state line cannot pass by
    // accident — this asserts the *filled* line specifically.
    expect(screen.getByText(/4 boxes/)).toBeTruthy();
  });

  it('reads the real labels out on Look closer', () => {
    renderCard(board);
    fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.getByText(/Client, API Gateway, Auth Service/)).toBeTruthy();
  });

  it('leaves a prop with no board variant on its own copy', () => {
    render(
      <FloorPropCard
        prop={{ propKind: 'printer', phase: 'using' }}
        phase="idle"
        copy={officeChromeCopy().floor}
        board={board}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(propCopy().items.printer.line)).toBeTruthy();
  });
});

/**
 * The drawing half of slice 16. Structural rather than pixel assertions —
 * jsdom has no layout engine, so what these can honestly pin is *which
 * surfaces gained marks*; the § 6 verify recipe is what says they are legible.
 */
describe('the room draws what you are working on', () => {
  const board = {
    kind: 'mermaid',
    shape: 'graph',
    nodes: 4,
    edges: 3,
    labels: ['Client', 'API Gateway'],
    bars: [
      { x: 0.08, y: 0.12, w: 0.3, h: 0.24, c: '#dbeafe' },
      { x: 0.62, y: 0.12, w: 0.3, h: 0.24, c: '#dbeafe' }
    ],
    mini: {
      nodes: [
        { x: 0.12, y: 0.16, w: 0.2, h: 0.26 },
        { x: 0.44, y: 0.16, w: 0.2, h: 0.26 }
      ],
      edges: [[0, 1]]
    }
  };

  const yourScreen = (container) => container.querySelector('.floor-screen--you');
  const whiteboard = (container) => container.querySelector('[data-prop="whiteboard"]');

  it('puts bars on your monitor and leaves it alone when the slot is empty', () => {
    const { container: empty } = renderFloor();
    const bare = yourScreen(empty).querySelectorAll('polygon').length;
    cleanup();

    const { container: full } = renderFloor({ board });
    expect(yourScreen(full).querySelectorAll('polygon').length).toBeGreaterThan(bare);
  });

  it('never puts your work on a colleague’s screen (ADR-0010)', () => {
    const { container } = renderFloor({ board });
    // Gilfoyle's monitor is his own fiction whatever you are working on.
    const theirs = container.querySelector('[data-seat="gilfoyle"] .floor-screen');
    expect(theirs.classList.contains('floor-screen--you')).toBe(false);
    cleanup();

    const { container: bare } = renderFloor();
    expect(
      bare.querySelector('[data-seat="gilfoyle"] .floor-screen').querySelectorAll('polygon').length
    ).toBe(theirs.querySelectorAll('polygon').length);
  });

  it('inks the whiteboard, connectors and all', () => {
    const { container: empty } = renderFloor();
    // `IsoPanel` draws a `polyline` frame; a bare `line` only ever comes from
    // the board's connectors, so this cannot pass on the empty state.
    expect(whiteboard(empty).querySelectorAll('line').length).toBe(0);
    cleanup();

    const { container: full } = renderFloor({ board });
    expect(whiteboard(full).querySelectorAll('line').length).toBe(1);
  });
});
