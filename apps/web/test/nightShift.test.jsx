// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloorNightShiftBoard from '../src/components/officeFloor/FloorNightShiftBoard.jsx';
import FloorNightShiftInvite from '../src/components/officeFloor/FloorNightShiftInvite.jsx';
import NightShiftHost from '../src/features/nightShift/NightShiftHost.jsx';
import { setNightShiftManifestForTests } from '../src/features/nightShift/nightShiftManifest.js';
import {
  closeNightShift,
  getNightShiftSnapshot,
  openNightShiftBoard,
  resetNightShiftForTests
} from '../src/features/nightShift/nightShiftStore.js';
import {
  FLOOR_NIGHT_SHIFT_BOARD,
  FLOOR_WALL_CLOCK,
  WALL_H,
  wallPoint
} from '../src/utils/officeFloorPlan.js';
import { NIGHT_FIXTURE } from './helpers/nightShiftFixture.js';

const SEEN_KEY = 'archislop:night-shift-seen';

/*
 * The two globals every mounting floor test inherits (office.md): the wall
 * clock and Math.random. Pin both even though nothing here reads randomness
 * today — the floor modules these components sit beside do.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-25T09:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.75);
  window.localStorage.clear();
  setNightShiftManifestForTests(NIGHT_FIXTURE);
  resetNightShiftForTests();
});

afterEach(() => {
  act(() => closeNightShift());
  cleanup();
  setNightShiftManifestForTests(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderFloorBits({ suppressed = false } = {}) {
  return render(
    <>
      <FloorNightShiftInvite suppressed={suppressed} />
      <FloorNightShiftBoard interactive />
      <NightShiftHost />
    </>
  );
}

describe('the morning invite', () => {
  it('offers the standup for a shift you have not caught up on', () => {
    renderFloorBits();
    const invite = screen.getByTestId('night-shift-invite');
    expect(invite.textContent).toContain('2 things shipped last night');
  });

  it('is muted by Focus Time and by a glass-room chair', () => {
    renderFloorBits({ suppressed: true });
    expect(screen.queryByTestId('night-shift-invite')).toBeNull();
  });

  it('is answered by skipping, and stays answered across a reload', () => {
    const first = renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-dismiss'));
    expect(screen.queryByTestId('night-shift-invite')).toBeNull();
    expect(window.localStorage.getItem(SEEN_KEY)).toBe('2026-11-24');
    first.unmount();

    resetNightShiftForTests();
    renderFloorBits();
    expect(screen.queryByTestId('night-shift-invite')).toBeNull();
  });

  it('comes back for the next shift, and only then', () => {
    window.localStorage.setItem(SEEN_KEY, '2026-11-23');
    resetNightShiftForTests();
    renderFloorBits();
    expect(screen.getByTestId('night-shift-invite')).toBeTruthy();
  });
});

describe('the standup', () => {
  it('runs beat by beat, then hands over to the board', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));

    const window_ = screen.getByTestId('night-shift-window');
    expect(window_.dataset.view).toBe('standup');
    expect(getNightShiftSnapshot().seenShiftDate).toBe('2026-11-24');
    expect(within(window_).getAllByRole('listitem')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('night-shift-next'));
    const reported = within(window_).getAllByRole('listitem');
    expect(reported).toHaveLength(2);
    expect(reported[1]?.textContent).toContain('Merged #958');

    while (screen.queryByTestId('night-shift-next')) {
      fireEvent.click(screen.getByTestId('night-shift-next'));
    }
    fireEvent.click(screen.getByTestId('night-shift-to-board'));
    expect(screen.getByTestId('night-shift-window').dataset.view).toBe('board');
  });

  it('closes on Escape', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('night-shift-window')).toBeNull();
  });
});

describe('the window as a modal', () => {
  it('keeps the arrow keys from walking the floor behind it', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    fireEvent.keyDown(screen.getByTestId('night-shift-next'), { key: 'ArrowLeft' });
    window.removeEventListener('keydown', onWindowKey);
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    const close = screen.getByTestId('night-shift-close');
    const next = screen.getByTestId('night-shift-next');
    next.focus();
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(next);
  });

  it('moves focus into the board when the standup hands over', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    fireEvent.click(screen.getByText('Skip to the board'));
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('keeps Escape from the floor behind it', () => {
    // The floor's own listener (`useFloorKeyboard`) is registered first and
    // skips a prevented event; stand-in for it here.
    const floorSawEscape = vi.fn();
    const onFloorKey = (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) floorSawEscape();
    };
    window.addEventListener('keydown', onFloorKey);
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    fireEvent.keyDown(screen.getByTestId('night-shift-next'), { key: 'Escape' });
    window.removeEventListener('keydown', onFloorKey);
    expect(screen.queryByTestId('night-shift-window')).toBeNull();
    expect(floorSawEscape).not.toHaveBeenCalled();
  });

  it('hands focus to the wall board when the invite that opened it is gone', () => {
    renderFloorBits();
    const join = screen.getByTestId('night-shift-invite-join');
    join.focus();
    fireEvent.click(join);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByTestId('office-floor-night-shift-open'));
  });

  it('does not Tab into links a closed "Earlier" fold is hiding', () => {
    const [officeLife, ...rest] = NIGHT_FIXTURE.crew;
    const last = rest[rest.length - 1];
    setNightShiftManifestForTests({
      ...NIGHT_FIXTURE,
      crew: [...rest.slice(0, -1), { ...last, earlier: officeLife.earlier }, officeLife]
    });
    renderFloorBits();
    fireEvent.click(screen.getByTestId('office-floor-night-shift-open'));
    const close = screen.getByTestId('night-shift-close');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement?.tagName).toBe('SUMMARY');
  });

  it('reads a fresh clock each time it opens, and holds it while open', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('night-shift-invite-join'));
    const firstOpen = getNightShiftSnapshot().openedAt;
    act(() => openNightShiftBoard('2026-11-24'));
    expect(getNightShiftSnapshot().openedAt).toBe(firstOpen);
    act(() => closeNightShift());
    vi.setSystemTime(new Date('2026-11-28T09:00:00Z'));
    act(() => openNightShiftBoard('2026-11-24'));
    expect(screen.getByText('What the night crew did on 24 Nov')).toBeTruthy();
  });
});

describe('the board on the wall', () => {
  it('draws one note per crew member, with on-leave folded into the last column', () => {
    renderFloorBits();
    const art = screen.getByTestId('office-floor-night-shift-board');
    const count = (id) => art.querySelector(`[data-column="${id}"]`)?.getAttribute('data-count');
    expect([count('shipped'), count('checked'), count('noShow')]).toEqual(['2', '1', '2']);
    expect(art.dataset.unseen).toBe('true');
  });

  it('opens the kanban card, which keeps the summary for anyone who missed the standup', () => {
    renderFloorBits();
    fireEvent.click(screen.getByTestId('office-floor-night-shift-open'));
    const board = screen.getByTestId('night-shift-board');
    const shipped = within(board).getByRole('region', { name: 'Shipped' });
    expect(within(shipped).getByText('Office Life')).toBeTruthy();
    expect(within(shipped).getByRole('link', { name: /958/ }).getAttribute('href')).toBe(
      'https://github.com/acuhlmann/mermaid-gen/pull/958'
    );
    const noShow = within(board).getByRole('region', { name: 'Didn’t clock in' });
    expect(noShow.textContent).toContain('Last ledger entry 19 Sep');
    // Reading the board is catching up, so the invite stands down.
    expect(screen.queryByTestId('night-shift-invite')).toBeNull();
  });

  it('is scenery when the floor is not interactive', () => {
    render(<FloorNightShiftBoard />);
    expect(screen.getByTestId('office-floor-night-shift-board')).toBeTruthy();
    expect(screen.queryByTestId('office-floor-night-shift-open')).toBeNull();
  });
});

describe('where it hangs', () => {
  it('sits inside the wall band, clear of the clock', () => {
    const { axis, t0, t1, h0, h1 } = FLOOR_NIGHT_SHIFT_BOARD;
    expect(axis).toBe(FLOOR_WALL_CLOCK.axis);
    expect(h0).toBeGreaterThan(30);
    expect(h1).toBeLessThan(WALL_H);
    // The clock's face spans ±r px around its centre; along the wall that is
    // r / (TILE_W / 2) tiles — under half a tile either way.
    expect(t0).toBeGreaterThan(FLOOR_WALL_CLOCK.t + 0.5);
    expect(t1).toBeLessThan(9);
    const top = wallPoint(axis, t1, h1);
    expect(top.top).toBeGreaterThan(wallPoint(axis, t1, WALL_H).top);
  });
});
