// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { projectIso, seatFor } from '../src/utils/officeFloorPlan.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';

/**
 * Free roam (slice 7). Without a WAAPI engine, `useWalkAnimation` places the
 * figure at its destination and settles immediately — the same behaviour
 * reduced-motion gets — so a click lands you on the tile in one tick and the
 * element's inline transform is exactly where the walk ended.
 *
 * The stage is unscaled here (`useStageScale` keeps its default 1 when jsdom
 * reports a zero-sized viewport) and `getBoundingClientRect` is all zeros, so
 * client coordinates *are* stage coordinates.
 */
function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

function clickTile(x, y) {
  const { left, top } = projectIso(x, y);
  fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });
}

/** Where the walking figure actually ended up, read off its transform. */
function playerAt(testId = 'office-floor-player') {
  return screen.getByTestId(testId).style.transform;
}

function transformOf(x, y) {
  const { left, top } = projectIso(x, y);
  return `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
}

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
});

describe('free roam (slice 7)', () => {
  it('walks you to the tile you clicked and leaves your desk empty', () => {
    const view = renderFloor();
    expect(screen.queryByTestId('office-floor-player')).toBeNull();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();

    clickTile(4, 3);

    expect(playerAt()).toBe(transformOf(4, 3));
    // § 6 rule 5: the furniture stays, the person doesn't — and it is you.
    expect(view.container.querySelector('[data-seat="you"]')).toBeTruthy();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBe('true');
  });

  it('takes a second destination without snapping you back', () => {
    renderFloor();
    clickTile(4, 3);
    clickTile(6, 2);

    // The new walk starts from where you were, not from your desk — the whole
    // reason `from` is computed rather than hard-coded to your seat.
    expect(playerAt()).toBe(transformOf(6, 2));
  });

  it('does nothing when you click somewhere you cannot stand', () => {
    renderFloor();
    // Inside the leadership glass: every tile within reach is a director's
    // chair or on the far side of the partition (§ 6 rule 17).
    clickTile(8, 0);
    expect(screen.queryByTestId('office-floor-player')).toBeNull();
  });

  it('offers a labelled way back to your screen while you are up', () => {
    const view = renderFloor();
    // The "Back to your screen" button is always present in the top bar
    expect(screen.getByRole('button', { name: /Back to your screen/i })).toBeTruthy();

    clickTile(4, 3);
    fireEvent.click(screen.getByRole('button', { name: /Back to your screen/i }));

    expect(screen.queryByTestId('office-floor-player')).toBeNull();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();
    // Back at your screen (desk view), not just your desk tile.
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('walks you home on Escape before it sits you down', () => {
    renderFloor();
    clickTile(4, 3);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('office-floor-player')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('steps one tile per arrow key, along the room’s own grid', () => {
    const you = seatFor('you');
    renderFloor();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(playerAt()).toBe(transformOf(you.x - 1, you.y));
  });

  it('ignores arrow keys aimed at somewhere unwalkable', () => {
    renderFloor();
    // +x from your desk is the visitor tile, which belongs to whoever walks
    // over to bother you. A step has no snapping, so this is simply refused.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.queryByTestId('office-floor-player')).toBeNull();
  });

  it('leaves the keyboard alone while you are typing', () => {
    renderFloor();
    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(screen.queryByTestId('office-floor-player')).toBeNull();

    input.remove();
  });

  it('renders one of you, whatever your reason for being up', () => {
    renderFloor();
    clickTile(4, 3);
    // A peek is a destination with a reason attached, not a second actor.
    fireEvent.click(screen.getByRole('button', { name: /Ulrich/ }));
    fireEvent.click(screen.getByRole('button', { name: /Their screen/i }));

    expect(screen.queryByTestId('office-floor-player')).toBeNull();
    expect(screen.getAllByTestId('office-floor-peek-player')).toHaveLength(1);
  });

  it('does not offer the floor while a meeting has you in a chair', () => {
    const meeting = {
      state: 'playing',
      title: 'Architecture Review Board',
      attendees: ['scrumMaster', 'gilfoyle'],
      facilitatorId: 'scrumMaster',
      transcript: [],
      interjectionsLeft: 2
    };
    const view = renderFloor();
    expect(screen.getByTestId('office-floor-roam')).toBeTruthy();

    view.rerender(<OfficeFloor meeting={meeting} />);

    expect(screen.queryByTestId('office-floor-roam')).toBeNull();
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
  });
});

describe('name-chip proximity (slice 15)', () => {
  const personOf = (container, id) =>
    container.querySelector(`[data-seat="${id}"] button.office-floor-person`);

  it('shows nobody at your desk — the room waits until you actually move', () => {
    const view = renderFloor();

    // Every colleague sits further than a tile away from your chair.
    for (const id of ['gilfoyle', 'dinesh', 'jared', 'russ', 'richard', 'erlich']) {
      expect(personOf(view.container, id)?.className).not.toContain('is-nearby');
    }
    // Your own chip never comes from proximity — you follow yourself around,
    // so a self-chip would light up wherever you wandered. It is `.is-you`
    // that keeps your name visible at your desk.
    const you = personOf(view.container, 'you');
    expect(you?.className).toContain('is-you');
    expect(you?.className).not.toContain('is-nearby');
  });

  it('lights whoever stands within a tile of you, and only them', () => {
    const view = renderFloor();

    // One tile into the pod: Russ at (9, 6) is now within the ring, Gilfoyle
    // at (6, 4) is not. The reveal follows you, not the room's memory of it.
    // (8, 7) would be the obvious step, but that is the visitor tile a walk-by
    // owns — the room refuses it, and so the test stands one tile to the left.
    clickTile(8, 6);
    expect(playerAt()).toBe(transformOf(8, 6));
    expect(personOf(view.container, 'russ')?.className).toContain('is-nearby');
    expect(personOf(view.container, 'gilfoyle')?.className).not.toContain('is-nearby');
  });

  it('takes the reveal back when you walk away', () => {
    const view = renderFloor();

    clickTile(8, 6);
    expect(personOf(view.container, 'russ')?.className).toContain('is-nearby');

    clickTile(4, 3);
    expect(personOf(view.container, 'russ')?.className).not.toContain('is-nearby');
  });
});
