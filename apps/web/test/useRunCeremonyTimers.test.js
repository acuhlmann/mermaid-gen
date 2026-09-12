// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunCeremony } from '../src/features/ceremony/useRunCeremony.js';

/*
 * #653: every HUD dismissal is a timer that outlives the thing it dismisses — a
 * toast clears itself after 1800ms, an achievement 3200ms, a level-up 5200ms.
 * Unmounting inside that window used to leave the callback scheduled, and it
 * then called a setter on a dead component: React asks `resolveUpdatePriority`
 * for the update lane, that reads `window`, and under a torn-down jsdom
 * environment `window` is gone. The run fails with `ReferenceError: window is
 * not defined` while every test still passes, which is how it went unnoticed.
 *
 * These assert the cancellation directly (no timer survives unmount) rather
 * than "does not throw" — a hook that scheduled nothing at all would satisfy
 * the weaker shape, so the first test pins that a timer WAS pending before the
 * unmount that must cancel it.
 */

function setup(props = {}) {
  const celebrationTimerRef = { current: null };
  return renderHook(
    ({ prompt, promptEasterEggs }) =>
      useRunCeremony({
        prompt,
        promptEasterEggs,
        konamiAchievement: null,
        tryAgentSound: () => {},
        russStreak: null,
        setGamification: () => {},
        setOfficeRunSignal: () => {},
        celebrationTimerRef
      }),
    {
      initialProps: {
        prompt: props.prompt ?? '',
        promptEasterEggs: props.promptEasterEggs ?? []
      }
    }
  );
}

// The prompt easter-egg effect is the one HUD-toast path drivable entirely from
// props: the emission paths route through a `setGamification` updater a stub
// never invokes. It schedules through the same `scheduleHudTimer`, so it
// exercises the cancellation this fix is about.
const EGG = [{ match: /rosebud/i, toast: 'Rosebud' }];

describe('useRunCeremony HUD timers (#653)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cancels a pending toast dismissal when the hook unmounts', () => {
    const { result, unmount } = setup({ prompt: 'rosebud', promptEasterEggs: EGG });

    // The dismissal is pending: without it there is nothing for unmount to
    // cancel and this test would pass vacuously.
    expect(result.current.streakHudToasts).toHaveLength(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still dismisses on time while mounted', () => {
    const { result } = setup({ prompt: 'rosebud', promptEasterEggs: EGG });
    expect(result.current.streakHudToasts).toHaveLength(1);

    // Advancing in its own act block, not the one that scheduled: the effect
    // flushes when the act scope closes, so advancing inside it would move the
    // clock before the timer exists and the callback would never fire.
    act(() => {
      vi.advanceTimersByTime(1801);
    });
    expect(result.current.streakHudToasts).toHaveLength(0);
  });
});
