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

const KONAMI_SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a'
];
const TINT_CLASS = 'slopitect-rainbow-tint';

describe('useRunCeremony HUD timers (#653)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.classList.remove(TINT_CLASS);
  });

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

/*
 * The same fix, one timer further: the Konami handler adds a body class
 * *outside* React and schedules its removal 5200ms later. Cancelling a timer
 * whose callback is a setter is the whole point of #653 — cancelling this one
 * strands a DOM mutation with no owner, because that callback is the only code
 * in the repo that removes the class. It is invisible for most users (the
 * animation ends at `opacity: 0`), but `App.css`'s
 * `@media (prefers-reduced-motion: reduce)` block replaces the animation with a
 * flat `opacity: 0.4`, so a reduced-motion user keeps a full-viewport
 * `z-index: 9999` rainbow wash for the rest of the session.
 */
describe('useRunCeremony Konami body tint (#653 follow-on)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.classList.remove(TINT_CLASS);
  });

  it('removes the body tint when the hook unmounts inside the 5.2s window', () => {
    const { unmount } = setup();

    act(() => {
      for (const key of KONAMI_SEQUENCE) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
    });

    // Both halves of the premise, so the assertion after unmount cannot pass
    // vacuously: the class is on, and its removal is still only pending.
    expect(document.body.classList.contains(TINT_CLASS)).toBe(true);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(document.body.classList.contains(TINT_CLASS)).toBe(false);
  });

  it('still removes the body tint on time while mounted', () => {
    setup();

    act(() => {
      for (const key of KONAMI_SEQUENCE) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
    });
    expect(document.body.classList.contains(TINT_CLASS)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5201);
    });
    expect(document.body.classList.contains(TINT_CLASS)).toBe(false);
  });
});
