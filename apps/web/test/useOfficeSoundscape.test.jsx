// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { SOUNDSCAPE_TICK_MS, useOfficeSoundscape } from '../src/hooks/useOfficeSoundscape.js';
import {
  _resetForTests,
  setOfficeFocusTime,
  setOfficeSoundscape
} from '../src/state/officeMomentStore.js';
import { SOUNDSCAPE_FIRST_CUE_MIN_MS } from '../src/utils/officeSoundscape.js';

const FIRST_FIRE_MS = SOUNDSCAPE_FIRST_CUE_MIN_MS + 6_000;

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

describe('useOfficeSoundscape', () => {
  it('plays a cue through the sound gate after the quiet opening stretch', async () => {
    const playChime = vi.fn();
    renderHook(() => useOfficeSoundscape({ playChime, random: () => 0.5 }));
    await vi.advanceTimersByTimeAsync(SOUNDSCAPE_FIRST_CUE_MIN_MS - 2_000);
    expect(playChime).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SOUNDSCAPE_FIRST_CUE_MIN_MS + 6_000);
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(typeof playChime.mock.calls[0][0]).toBe('function');
  });

  it('stays silent during Focus Time', async () => {
    const playChime = vi.fn();
    setOfficeFocusTime(true);
    renderHook(() => useOfficeSoundscape({ playChime, random: () => 0.5 }));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    expect(playChime).not.toHaveBeenCalled();
  });

  it('stays silent when the soundscape toggle is off', async () => {
    const playChime = vi.fn();
    setOfficeSoundscape(false);
    renderHook(() => useOfficeSoundscape({ playChime, random: () => 0.5 }));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    expect(playChime).not.toHaveBeenCalled();
  });

  it('holds while a colleague is speaking, then pays the cue back', async () => {
    // The bed ducks under narration; a cue cannot, so the director waits. Note
    // what is being asserted after the line ends: not merely that cues resume,
    // but that the wait cost nothing — `lastPlayedAt` is untouched while
    // holding, so the very next tick is eligible rather than owing another
    // full cruise gap.
    const playChime = vi.fn();
    vi.stubGlobal('speechSynthesis', { speaking: true, pending: false });
    renderHook(() => useOfficeSoundscape({ playChime, random: () => 0.5 }));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    expect(playChime).not.toHaveBeenCalled();

    vi.stubGlobal('speechSynthesis', { speaking: false, pending: false });
    await vi.advanceTimersByTimeAsync(SOUNDSCAPE_TICK_MS);
    expect(playChime).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
