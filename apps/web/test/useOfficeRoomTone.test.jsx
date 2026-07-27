// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { startRoomTone, stopRoomTone } = vi.hoisted(() => ({
  startRoomTone: vi.fn(),
  stopRoomTone: vi.fn()
}));

vi.mock('../src/utils/officeRoomTone.js', () => ({ startRoomTone, stopRoomTone }));

const { ROOM_TONE_TICK_MS, useOfficeRoomTone } = await import('../src/hooks/useOfficeRoomTone.js');
const { _resetForTests, setOfficeFocusTime, setOfficeSoundscape } =
  await import('../src/state/officeMomentStore.js');

/** The sound gate as App implements it: runs the fn and reports it let it through. */
const openGate = () =>
  vi.fn((playFn) => {
    playFn({ current: null });
    return true;
  });
/** Gate shut — global sound off, or no user gesture yet. */
const closedGate = () => vi.fn(() => false);

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  _resetForTests();
  startRoomTone.mockClear();
  stopRoomTone.mockClear();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useOfficeRoomTone', () => {
  it('starts the bed through the sound gate as soon as it mounts', () => {
    const playChime = openGate();
    renderHook(() => useOfficeRoomTone({ playChime }));
    expect(startRoomTone).toHaveBeenCalled();
  });

  it('never starts the bed while the gate is shut, and stops one already playing', () => {
    const playChime = closedGate();
    renderHook(() => useOfficeRoomTone({ playChime }));
    expect(startRoomTone).not.toHaveBeenCalled();
    expect(stopRoomTone).toHaveBeenCalled();
  });

  it('stops the bed the moment Focus Time comes on, without waiting for a tick', () => {
    const playChime = openGate();
    renderHook(() => useOfficeRoomTone({ playChime }));
    stopRoomTone.mockClear();

    act(() => setOfficeFocusTime(true));

    expect(stopRoomTone).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBeGreaterThan(0); // no tick was needed
  });

  it('stops the bed the moment the soundscape toggle goes off', () => {
    const playChime = openGate();
    renderHook(() => useOfficeRoomTone({ playChime }));
    stopRoomTone.mockClear();

    act(() => setOfficeSoundscape(false));

    expect(stopRoomTone).toHaveBeenCalled();
  });

  it('brings the bed back when Focus Time is lifted', () => {
    const playChime = openGate();
    setOfficeFocusTime(true);
    renderHook(() => useOfficeRoomTone({ playChime }));
    expect(startRoomTone).not.toHaveBeenCalled();

    act(() => setOfficeFocusTime(false));

    expect(startRoomTone).toHaveBeenCalled();
  });

  it('self-heals on the tick once the sound gate opens', async () => {
    let gateOpen = false;
    const playChime = vi.fn((playFn) => {
      if (!gateOpen) return false;
      playFn({ current: null });
      return true;
    });
    renderHook(() => useOfficeRoomTone({ playChime }));
    expect(startRoomTone).not.toHaveBeenCalled();

    // Nothing notifies us that the user finally clicked something — the tick is
    // the only thing that closes this gap.
    gateOpen = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROOM_TONE_TICK_MS);
    });

    expect(startRoomTone).toHaveBeenCalled();
  });

  it('stops the bed on unmount so a remount does not stack loops', () => {
    const playChime = openGate();
    const { unmount } = renderHook(() => useOfficeRoomTone({ playChime }));
    stopRoomTone.mockClear();

    unmount();

    expect(stopRoomTone).toHaveBeenCalled();
  });
});
