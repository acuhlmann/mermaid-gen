// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
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
      attendees: ['scrumMaster', 'refine'],
      facilitatorId: 'scrumMaster',
      transcript: [{ speakerId: 'refine', kind: 'substantive', text: 'The gateway is fine.' }],
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
    // The person card has no testid of its own; its Message verb identifies it.
    expect(screen.getByRole('button', { name: /Message/ })).toBeTruthy();

    fireEvent.click(machine());

    expect(await screen.findByTestId('office-floor-prop-card')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();
  });
});
