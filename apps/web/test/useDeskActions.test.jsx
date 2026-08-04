// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DESK_LLM_CAP, useDeskActions } from '../src/hooks/useDeskActions.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeWalkBy,
  setOfficeFocusTime
} from '../src/state/officeMomentStore.js';

const BASE_PARAMS = {
  pause: false,
  meetingActive: false,
  getDiagramSource: () => 'flowchart TD\n A[Bake]-->B[Slice]',
  getContentType: () => 'mermaid',
  getSessionId: () => 'test-session',
  getUserTitle: () => 'Associate Slopitect',
  random: () => 0.5,
  // Zero out the reply-thinking pause (docs/office-parody.md § Desk verbs) so
  // these tests stay fast and deterministic; production computes it for real.
  replyDelayMs: () => 0
};

/** Offline by default: every verb must still land via the canned banks. */
function goOffline() {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline')))
  );
}

beforeEach(() => {
  _resetForTests();
  window.localStorage.clear();
  goOffline();
});

afterEach(() => {
  cleanup();
  _resetForTests();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('useDeskActions', () => {
  it('walks you straight into the coffee scene, skipping the invite pill', async () => {
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    await act(async () => {
      await result.current.getCoffee();
    });
    const coffee = getOfficeSnapshot().coffee;
    expect(coffee).toBeTruthy();
    // You walked over yourself — no "Take 5 / Deadline" invite to accept.
    expect(coffee.accepted).toBe(true);
  });

  it('falls back to a canned walk-by when the LLM is unavailable', async () => {
    const onOfficeEvent = vi.fn();
    const { result } = renderHook(() => useDeskActions({ ...BASE_PARAMS, onOfficeEvent }));
    await act(async () => {
      await result.current.walkTheFloor();
    });
    expect(getOfficeSnapshot().walkBy).toBeTruthy();
    expect(onOfficeEvent).toHaveBeenCalledWith('walkedFloor');
  });

  it('overhears a scene instead of a walk-by when the canvas is empty', async () => {
    const { result } = renderHook(() =>
      useDeskActions({ ...BASE_PARAMS, getDiagramSource: () => '' })
    );
    await act(async () => {
      await result.current.walkTheFloor();
    });
    const snapshot = getOfficeSnapshot();
    // Nothing to comment on, so you just overhear the floor.
    expect(snapshot.walkBy).toBeNull();
    expect(Boolean(snapshot.coffee || snapshot.battle)).toBe(true);
  });

  it('delivers a canned IM when the reply request fails', async () => {
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    await act(async () => {
      await result.current.imSomeone('intern');
    });
    expect(getOfficeSnapshot().deskArrivals.length).toBe(1);
  });

  it('delivers a contextual canned IM reply when the user messages someone', async () => {
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    await act(async () => {
      await result.current.imSomeone('intern', {
        userMessage: 'is this diagram too spicy?',
        threadTranscript: [{ from: 'user', body: 'is this diagram too spicy?' }]
      });
    });
    const arrival = getOfficeSnapshot().deskArrivals[0];
    expect(arrival).toBeTruthy();
    expect(arrival.kind).toBe('im');
    const message = getOfficeSnapshot().imHistory.find((m) => !m.outbound);
    expect(message.body.toLowerCase()).toContain('spicy');
  });

  it('delivers a contextual canned email reply when the user composes mail', async () => {
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    await act(async () => {
      await result.current.emailSomeone('intern', {
        subject: 'quick question',
        body: 'is this diagram too spicy?'
      });
    });
    const email = getOfficeSnapshot().emails[0];
    expect(email).toBeTruthy();
    expect(email.body.toLowerCase()).toContain('spicy');
  });

  it('stops spending LLM calls once the desk budget is gone', async () => {
    // Server answers, so each verb spends one desk LLM call.
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ moment: { body: 'nice boxes', colleagueId: 'intern', kind: 'im' } })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    for (let i = 0; i < DESK_LLM_CAP + 2; i += 1) {
      await act(async () => {
        await result.current.imSomeone('intern');
        // Each ping is its own surface; clear so the next verb isn't blocked.
        _resetForTests();
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(DESK_LLM_CAP);
  });

  it('runs during Focus Time — muting the office does not ground you', async () => {
    setOfficeFocusTime(true);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    expect(result.current.blockedReason).toBeNull();
    await act(async () => {
      await result.current.getCoffee();
    });
    expect(getOfficeSnapshot().coffee).toBeTruthy();
  });

  it('runs coffee and walk while a deliverable streams', async () => {
    const { result } = renderHook(() => useDeskActions({ ...BASE_PARAMS, pause: true }));
    expect(result.current.blockedReason).toBe('busy');
    expect(result.current.ambientBlockedReason).toBeNull();
    await act(async () => {
      await result.current.getCoffee();
    });
    expect(getOfficeSnapshot().coffee).toBeTruthy();
    _resetForTests();
    const walk = renderHook(() => useDeskActions({ ...BASE_PARAMS, pause: true }));
    await act(async () => {
      await walk.result.current.walkTheFloor();
    });
    expect(Boolean(getOfficeSnapshot().walkBy || getOfficeSnapshot().coffee)).toBe(true);
  });

  it('refuses to stack a second surface, and reports why', async () => {
    pushOfficeWalkBy({ colleagueId: 'intern', body: 'nice boxes' });
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    expect(result.current.blockedReason).toBe('surface');
    await act(async () => {
      await result.current.getCoffee();
    });
    expect(getOfficeSnapshot().coffee).toBeNull();
  });

  it('reports the meeting and streaming-run blocks', () => {
    const meeting = renderHook(() => useDeskActions({ ...BASE_PARAMS, meetingActive: true }));
    expect(meeting.result.current.blockedReason).toBe('meeting');
    const busy = renderHook(() => useDeskActions({ ...BASE_PARAMS, pause: true }));
    expect(busy.result.current.blockedReason).toBe('busy');
  });

  it('delegates the pass-through verbs to their owners', () => {
    const onCallMeeting = vi.fn();
    const onCheckInbox = vi.fn();
    const onTalkToTeam = vi.fn();
    const { result } = renderHook(() =>
      useDeskActions({ ...BASE_PARAMS, onCallMeeting, onCheckInbox, onTalkToTeam })
    );
    act(() => {
      result.current.checkInbox();
      result.current.callMeeting();
      result.current.talkToTeam();
    });
    expect(onCheckInbox).toHaveBeenCalledTimes(1);
    expect(onCallMeeting).toHaveBeenCalledTimes(1);
    expect(onTalkToTeam).toHaveBeenCalledTimes(1);
  });
});
