// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useOfficeAmbience, OFFICE_TICK_MS } from '../src/hooks/useOfficeAmbience.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeEmail,
  pushOfficeMeetingInvite,
  setOfficeFocusTime
} from '../src/state/officeMomentStore.js';
import { OFFICE_FIRST_MOMENT_MIN_MS } from '../src/utils/officeCadence.js';

function countSurfaces(snapshot) {
  return (
    snapshot.emails.length +
    snapshot.imPings.length +
    (snapshot.walkBy ? 1 : 0) +
    (snapshot.coffee ? 1 : 0) +
    (snapshot.meetingInvite ? 1 : 0)
  );
}

const BASE_PARAMS = {
  pause: false,
  advisorBusy: false,
  meetingActive: false,
  getDiagramSource: () => 'flowchart TD\n A[Bake]-->B[Slice]',
  getContentType: () => 'mermaid',
  getSessionId: () => 'test-session',
  getUserTitle: () => 'Associate Slopitect',
  // random 0.5 → deterministic canned IM pick in the cadence weights.
  random: () => 0.5
};

// Ticks land every OFFICE_TICK_MS from mount; the first eligible one is at the
// first-stretch boundary. Stop just after it so TTL surfaces are still visible.
const FIRST_FIRE_MS = OFFICE_FIRST_MOMENT_MIN_MS + 1000;

beforeEach(() => {
  vi.useFakeTimers();
  _resetForTests();
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline')))
  );
});

afterEach(() => {
  cleanup();
  _resetForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('useOfficeAmbience', () => {
  it('fires a canned moment after the quiet first stretch, even offline', async () => {
    renderHook(() => useOfficeAmbience(BASE_PARAMS));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    const snapshot = getOfficeSnapshot();
    // random 0.5 lands on the IM lane in the cadence weights, canned variant.
    expect(snapshot.imPings.length).toBe(1);
    expect(snapshot.imPings[0].body.length).toBeGreaterThan(0);
    expect(countSurfaces(snapshot)).toBe(1);
  });

  it('stays silent during Focus Time', async () => {
    setOfficeFocusTime(true);
    renderHook(() => useOfficeAmbience(BASE_PARAMS));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    expect(countSurfaces(getOfficeSnapshot())).toBe(0);
  });

  it('stays silent while an agent run streams or the advisor is speaking', async () => {
    const { rerender } = renderHook((props) => useOfficeAmbience(props), {
      initialProps: { ...BASE_PARAMS, pause: true }
    });
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS);
    expect(countSurfaces(getOfficeSnapshot())).toBe(0);
    rerender({ ...BASE_PARAMS, pause: false, advisorBusy: true });
    await vi.advanceTimersByTimeAsync(OFFICE_TICK_MS * 4);
    expect(countSurfaces(getOfficeSnapshot())).toBe(0);
  });

  it('holds fire while another office surface is on screen', async () => {
    renderHook(() => useOfficeAmbience(BASE_PARAMS));
    // A meeting invite (no TTL) parks on screen before the first tick window.
    pushOfficeMeetingInvite({
      colleagueId: 'scrumMaster',
      title: 'WG',
      body: 'sync',
      attendees: ['scrumMaster', 'barker', 'intern']
    });
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS + OFFICE_TICK_MS * 4);
    const snapshot = getOfficeSnapshot();
    expect(snapshot.emails.length).toBe(0);
    expect(snapshot.imPings.length).toBe(0);
    expect(countSurfaces(snapshot)).toBe(1);
  });

  it('holds fire while the inbox still has unread mail', async () => {
    pushOfficeEmail({
      colleagueId: 'hr',
      subject: 'FYI',
      body: 'read me'
    });
    renderHook(() => useOfficeAmbience(BASE_PARAMS));
    await vi.advanceTimersByTimeAsync(FIRST_FIRE_MS + OFFICE_TICK_MS * 4);
    expect(getOfficeSnapshot().imPings.length).toBe(0);
  });
});
