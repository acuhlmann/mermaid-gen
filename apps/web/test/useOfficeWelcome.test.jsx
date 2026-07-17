// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import {
  useOfficeWelcome,
  WELCOME_AFTER_INTERACTION_MS,
  WELCOME_FALLBACK_MS,
  WELCOME_IM_DELAY_MS
} from '../src/hooks/useOfficeWelcome.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  setOfficeFocusTime
} from '../src/state/officeMomentStore.js';
import {
  readOfficeWelcomeSeen,
  writeOfficeWelcomeSeen
} from '../src/utils/officeAmbienceStorage.js';

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  _resetForTests();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useOfficeWelcome', () => {
  it("delivers Linda's welcome email right after the first interaction, then Chad's IM", async () => {
    renderHook(() => useOfficeWelcome({ getUserTitle: () => 'Associate Slopitect' }));
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(WELCOME_AFTER_INTERACTION_MS + 10);
    const afterEmail = getOfficeSnapshot();
    expect(afterEmail.emails).toHaveLength(1);
    expect(afterEmail.emails[0].colleagueId).toBe('hr');
    expect(afterEmail.emails[0].subject).toContain('Associate Slopitect');
    expect(afterEmail.unreadCount).toBe(1);
    expect(readOfficeWelcomeSeen()).toBe(true);
    await vi.advanceTimersByTimeAsync(WELCOME_IM_DELAY_MS);
    const afterIm = getOfficeSnapshot();
    expect(afterIm.imPings).toHaveLength(1);
    expect(afterIm.imPings[0].colleagueId).toBe('intern');
  });

  it('falls back to a plain timer when the user never interacts', async () => {
    renderHook(() => useOfficeWelcome({}));
    await vi.advanceTimersByTimeAsync(WELCOME_FALLBACK_MS - 1000);
    expect(getOfficeSnapshot().emails).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(getOfficeSnapshot().emails).toHaveLength(1);
  });

  it('never re-onboards once welcomed', async () => {
    writeOfficeWelcomeSeen();
    renderHook(() => useOfficeWelcome({}));
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(WELCOME_FALLBACK_MS * 2);
    expect(getOfficeSnapshot().emails).toHaveLength(0);
  });

  it('honors Focus Time — skips the sequence but still marks it done', async () => {
    setOfficeFocusTime(true);
    renderHook(() => useOfficeWelcome({}));
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(WELCOME_FALLBACK_MS * 2);
    expect(getOfficeSnapshot().emails).toHaveLength(0);
    expect(getOfficeSnapshot().imPings).toHaveLength(0);
    expect(readOfficeWelcomeSeen()).toBe(true);
  });

  it('cancels pending delivery on unmount so it can retry next session', async () => {
    const { unmount } = renderHook(() => useOfficeWelcome({}));
    unmount();
    await vi.advanceTimersByTimeAsync(WELCOME_FALLBACK_MS * 2);
    expect(getOfficeSnapshot().emails).toHaveLength(0);
    expect(readOfficeWelcomeSeen()).toBe(false);
  });
});
