// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useOfficeDayPhase } from '../src/components/officeFloor/useOfficeDayPhase.js';
import { OFFICE_DAY_PHASE_POLL_MS } from '../src/utils/officeCadence.js';

/**
 * The impure half of the office day (slice 20).
 *
 * `officeDayPhaseAt` is unit-tested on plain instants in `officeCadence.test.js`;
 * everything here is about the part that has to touch a clock — that the room
 * catches up when the hour turns over, and that it does not repaint when it
 * has not.
 */

const at = (h, m = 0) => new Date(2026, 7, 10, h, m, 0, 0).getTime();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useOfficeDayPhase', () => {
  it('reports the hour it was mounted in', () => {
    const { result } = renderHook(() => useOfficeDayPhase({ now: () => at(11) }));
    expect(result.current).toBe('midday');
  });

  it('catches up when the day turns over underneath it', async () => {
    let clock = at(16, 29);
    const { result } = renderHook(() => useOfficeDayPhase({ now: () => clock }));
    expect(result.current).toBe('midday');

    clock = at(16, 31);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFICE_DAY_PHASE_POLL_MS + 10);
    });
    expect(result.current).toBe('windDown');
  });

  it('does not re-render the floor for a poll that changed nothing', async () => {
    // This is the whole licence for polling at all on a surface that draws
    // sixteen animated figures, a walk animation and a directed camera.
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useOfficeDayPhase({ now: () => at(11) });
    });
    const afterMount = renders;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFICE_DAY_PHASE_POLL_MS * 5);
    });
    expect(renders).toBe(afterMount);
    expect(result.current).toBe('midday');
  });

  it('stops polling once the floor is gone', async () => {
    const now = vi.fn(() => at(11));
    const { unmount } = renderHook(() => useOfficeDayPhase({ now }));
    unmount();
    const callsAtUnmount = now.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(OFFICE_DAY_PHASE_POLL_MS * 3);
    });
    expect(now.mock.calls.length).toBe(callsAtUnmount);
  });
});
