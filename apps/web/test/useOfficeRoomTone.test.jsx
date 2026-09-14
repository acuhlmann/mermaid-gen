// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const { startRoomTone, stopRoomTone, setRoomToneOccupancy } = vi.hoisted(() => ({
  startRoomTone: vi.fn(),
  stopRoomTone: vi.fn(),
  setRoomToneOccupancy: vi.fn()
}));

vi.mock('../src/utils/officeRoomTone.js', () => ({
  startRoomTone,
  stopRoomTone,
  setRoomToneOccupancy,
  setRoomToneViewMode: vi.fn()
}));

const { ROOM_TONE_TICK_MS, useOfficeRoomTone, _resetRoomToneDirectorsForTests } =
  await import('../src/hooks/useOfficeRoomTone.js');
const { _resetForTests, setOfficeFocusTime, setOfficeSoundscape, startOfficeHuddle } =
  await import('../src/state/officeMomentStore.js');
const { PHASE_OCCUPANCY, OCCUPANCY_PER_PERSON_UP } = await import('../src/utils/officeCadence.js');

/** The sound gate as App implements it: runs the fn and reports it let it through. */
const openGate = () =>
  vi.fn((playFn) => {
    playFn({ current: null });
    return true;
  });
/** Gate shut — global sound off, or no user gesture yet. */
const closedGate = () => vi.fn(() => false);

beforeEach(() => {
  /* Any test that mounts inherits the wall clock whether it names it or not,
     and this suite now reads the hour through `roomOccupancyAt` — unpinned, it
     would pass for part of the day and fail for the rest, blaming the bed. */
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
  window.localStorage.clear();
  _resetForTests();
  _resetRoomToneDirectorsForTests();
  startRoomTone.mockClear();
  stopRoomTone.mockClear();
  setRoomToneOccupancy.mockClear();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  _resetRoomToneDirectorsForTests();
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

  /*
   * Queue 8. The bed is a level and nothing else — it has no clock and no store,
   * so if the director does not carry the room's occupancy into it, the loop
   * murmurs a full open-plan floor at ten at night and nothing anywhere notices.
   */
  it('carries the hour into the bed as soon as it mounts', () => {
    vi.setSystemTime(new Date(2026, 7, 11, 22, 0, 0));
    renderHook(() => useOfficeRoomTone({ playChime: openGate() }));

    expect(setRoomToneOccupancy).toHaveBeenCalledWith(PHASE_OCCUPANCY.afterHours);
  });

  it('wakes the room up when a set piece puts people on their feet', () => {
    vi.setSystemTime(new Date(2026, 7, 11, 22, 0, 0));
    renderHook(() => useOfficeRoomTone({ playChime: openGate() }));
    setRoomToneOccupancy.mockClear();

    act(() => startOfficeHuddle(['dinesh', 'gilfoyle']));

    // Immediately, on the store subscription — a coffee break that only reached
    // the bed on the next 5 s tick would land after the scene it belongs to.
    expect(setRoomToneOccupancy).toHaveBeenLastCalledWith(
      PHASE_OCCUPANCY.afterHours + 2 * OCCUPANCY_PER_PERSON_UP
    );
  });

  it('keeps the level current while the bed is stopped', () => {
    // Occupancy is pushed before the audibility check on purpose: Focus Time
    // stops the loop, and when it lifts the bed must fade back in at the level
    // the room is at now, not the one it was at when the user went quiet.
    vi.setSystemTime(new Date(2026, 7, 11, 22, 0, 0));
    setOfficeFocusTime(true);
    renderHook(() => useOfficeRoomTone({ playChime: openGate() }));

    expect(startRoomTone).not.toHaveBeenCalled();
    expect(setRoomToneOccupancy).toHaveBeenCalledWith(PHASE_OCCUPANCY.afterHours);
  });

  it('does not stop the bed when another director is still mounted', () => {
    const playChime = openGate();
    const first = renderHook(() => useOfficeRoomTone({ playChime }));
    const second = renderHook(() => useOfficeRoomTone({ playChime }));
    stopRoomTone.mockClear();

    first.unmount();

    expect(stopRoomTone).not.toHaveBeenCalled();

    second.unmount();
    expect(stopRoomTone).toHaveBeenCalled();
  });
});
