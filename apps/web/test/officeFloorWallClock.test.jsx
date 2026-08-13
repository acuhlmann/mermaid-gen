// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import FloorStage from '../src/components/officeFloor/FloorStage.jsx';
import FloorWallClock from '../src/components/officeFloor/FloorWallClock.jsx';
import { useOfficeWallClock } from '../src/components/officeFloor/useOfficeWallClock.js';
import { resetOfficeFloorTestState } from './helpers/officeFloorTestUtils.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { standUp } from '../src/state/officeViewModeStore.js';
import { OFFICE_WALL_CLOCK_POLL_MS } from '../src/utils/officeCadence.js';
import {
  FLOOR_BOUNDS,
  FLOOR_WALL_CLOCK,
  WALL_H,
  projectIso,
  wallPoint
} from '../src/utils/officeFloorPlan.js';

/**
 * Slice 25 — the wall clock. The pure half (`officeWallClockAt`) is unit-tested
 * beside the phase dial in `officeCadence.test.js`; this file is about the
 * drawing: where it hangs, what the hands say, that the floor mounts it, and
 * that the poll repaints only when the minute rolls over.
 *
 * Every mount here pins the wall clock to **midday** — one of the two phases
 * with no `PHASE_ART` (docs/office-isometric-mode.md § 8's trap): a mounting
 * floor test reads the hour at rung 5, and asserting geometry at an arbitrary
 * instant is how `officeFloorActivity.test.jsx` was red for seven and a half
 * hours a day.
 */

const at = (h, m = 0, s = 0) => new Date(2026, 7, 10, h, m, s, 0);

beforeEach(() => {
  /* Real timers, faked Date — the mount shape `officeFloorActivity.test.jsx`
     uses, so the floor's own wander/poll timers keep running. */
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(at(12));
  resetOfficeFloorTestState();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('where it hangs', () => {
  it('sits on the north-west wall, the one with no windows', () => {
    const centre = wallPoint(FLOOR_WALL_CLOCK.axis, FLOOR_WALL_CLOCK.t, FLOOR_WALL_CLOCK.h);
    const north = projectIso(FLOOR_BOUNDS.minX, FLOOR_BOUNDS.minY);
    // Screen-left of the north corner is the NW wall; all three windows are
    // on the NE wall, so the clock cannot collide a pane.
    expect(centre.left).toBeLessThan(north.left);
  });

  it('fits the whole face inside the wall band at its own spot', () => {
    const { axis, t, h, r } = FLOOR_WALL_CLOCK;
    const centre = wallPoint(axis, t, h);
    // The wall band narrows to a point at the clock's own `t` — measure the
    // bounds there, not at the north corner, because the floor line drops as
    // the wall runs toward the viewer.
    const wallTop = wallPoint(axis, t, WALL_H);
    const floorLine = wallPoint(axis, t, 0);
    expect(centre.top - r).toBeGreaterThan(wallTop.top);
    expect(centre.top + r).toBeLessThan(floorLine.top);
    // …and the dial is high enough that a seated head cannot wear it.
    expect(centre.top + r).toBeLessThan(floorLine.top - 40);
  });
});

describe('what the hands say', () => {
  it('points both hands where a wall clock would', () => {
    vi.setSystemTime(at(3, 0));
    render(<FloorWallClock />);
    const face = screen.getByTestId('office-floor-wall-clock');
    expect(
      face.querySelector('.office-floor-wall-clock-hand--hour').getAttribute('transform')
    ).toBe('rotate(90)');
    expect(
      face.querySelector('.office-floor-wall-clock-hand--minute').getAttribute('transform')
    ).toBe('rotate(0)');
  });

  it('sweeps the hour hand with the minutes', () => {
    vi.setSystemTime(at(15, 30));
    render(<FloorWallClock />);
    const face = screen.getByTestId('office-floor-wall-clock');
    expect(
      face.querySelector('.office-floor-wall-clock-hand--hour').getAttribute('transform')
    ).toBe('rotate(105)');
  });

  it('labels the time HH:MM for the accessible name', () => {
    vi.setSystemTime(at(15, 7));
    render(<FloorWallClock />);
    expect(screen.getByRole('img', { name: '15:07' })).toBeTruthy();
  });
});

describe('the poll is a heartbeat, not a metronome', () => {
  /* The hook's contract wants full control of its interval — the mount
     tests above want the floor's real timers. The inner beforeEach wins. */
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(at(12));
  });

  it('catches up when the minute rolls over', async () => {
    const { result } = renderHook(() => useOfficeWallClock({ pollMs: 1_000 }));
    expect(result.current.minuteDeg).toBe(0);

    vi.setSystemTime(at(12, 1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(result.current.minuteDeg).toBe(6);
  });

  it('does not repaint for a poll that landed mid-minute', async () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useOfficeWallClock({ pollMs: 1_000 });
    });
    const afterMount = renders;

    vi.setSystemTime(at(12, 0, 30));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_500);
    });
    expect(renders).toBe(afterMount);
  });

  it('reads immediately on mount, not after the first tick', () => {
    vi.setSystemTime(at(9, 45));
    const { result } = renderHook(() => useOfficeWallClock({ pollMs: 60_000 }));
    expect(result.current.minuteDeg).toBe(45 * 6);
  });

  it('stops polling once the floor is gone', async () => {
    const now = vi.fn(() => at(12).getTime());
    const { unmount } = renderHook(() => useOfficeWallClock({ now }));
    unmount();
    const callsAtUnmount = now.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFICE_WALL_CLOCK_POLL_MS * 3);
    });
    expect(now.mock.calls.length).toBe(callsAtUnmount);
  });
});

describe('the floor mounts it', () => {
  it('hangs the clock on the standing floor', () => {
    standUp();
    render(<OfficeFloor />);
    expect(screen.getAllByTestId('office-floor-wall-clock').length).toBe(1);
    expect(document.querySelector('.office-floor-wall-clock-hand--hour')).toBeTruthy();
    expect(document.querySelector('.office-floor-wall-clock-hand--minute')).toBeTruthy();
  });

  it('hangs it on the arrival stage too', () => {
    // FloorArrival mounts its own `FloorStage` with `interactive={false}` —
    // the clock belongs to the stage itself, so the reception wall carries it
    // before the user has ever sat down. No standUp() here on purpose.
    render(
      <FloorStage
        scale={1}
        copy={officeChromeCopy().floor}
        selectedId={null}
        onSelect={() => {}}
        interactive={false}
      />
    );
    expect(screen.getAllByTestId('office-floor-wall-clock').length).toBe(1);
  });
});
