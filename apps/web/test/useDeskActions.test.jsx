// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  DESK_LLM_CAP,
  DWELL_LLM_CAP,
  DWELL_STRANGER_LLM_CAP,
  useDeskActions
} from '../src/hooks/useDeskActions.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeImPing,
  pushOfficeWalkBy,
  setOfficeFocusTime
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  stampWorkingMemoryBoard,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import { isSpokenLine } from '../src/utils/officeImThreads.js';

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
  _resetOfficeWorkingMemoryForTests();
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

  it('tags a spoken floor answer as a talk line so a balloon can draw it (#552)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          moment: { body: 'it reads fine to me', colleagueId: 'intern', kind: 'im' }
        })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    // The Slop Chat path stays untagged: a typed IM must never be voiced or
    // balloon — the mirror image of this bug, pinned by officeVoiceMedium.
    await act(async () => {
      await result.current.imSomeone('intern', { userMessage: 'does this make sense?' });
    });
    const typed = getOfficeSnapshot().imHistory.find((m) => !m.outbound);
    expect(isSpokenLine(typed)).toBe(false);

    // The untagged ping raised a desk arrival. That used to block the next
    // verb, and this test cleared the surface to get past it; the workaround
    // was the bug wearing a test's clothes — see the `'answering'` gate.
    expect(getOfficeSnapshot().deskArrivals.some((a) => a.kind === 'im')).toBe(true);

    // The floor's talk composer passes the medium explicitly, and the answer
    // must be a line `latestTalkLine`/`FloorTalk` will actually read.
    await act(async () => {
      await result.current.imSomeone('intern', { userMessage: 'does this make sense?' }, 'talk');
    });
    const spoken = getOfficeSnapshot()
      .imHistory.filter((m) => !m.outbound)
      .at(-1);
    expect(spoken?.body).toBe('it reads fine to me');
    expect(isSpokenLine(spoken)).toBe(true);
  });

  /*
   * The `'answering'` gate (`blockedReasonFor`). Measured in the scripted visit
   * before these existed: the composer sentence — the single most reactive thing
   * the office can be handed — provoked **zero** `/api/office/moment` calls on
   * twelve runs across four nights, and no bank line either, because a colleague
   * in an unrelated chat had left a nine-second toast on screen.
   */
  it('answers a sentence you typed while an unrelated IM toast is on screen', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          moment: { body: 'it reads fine to me', colleagueId: 'gilfoyle', kind: 'im' }
        })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    // Chad's welcome IM, which nobody asked for and which owns the corner of the
    // screen for nine seconds.
    pushOfficeImPing({ colleagueId: 'intern', body: 'welcome to the sloppiest team in tech!!' });
    expect(hasActiveOfficeSurface()).toBe(true);

    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    await act(async () => {
      await result.current.imSomeone(
        'gilfoyle',
        { userMessage: 'Does this diagram make sense to you?' },
        'talk'
      );
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const spoken = getOfficeSnapshot()
      .imHistory.filter((m) => !m.outbound && m.colleagueId === 'gilfoyle')
      .at(-1);
    expect(spoken?.body).toBe('it reads fine to me');
  });

  it('answers the second turn of a chat — the old block was the first reply’s own toast', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ moment: { body: 'sure', colleagueId: 'intern', kind: 'im' } })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    await act(async () => {
      await result.current.imSomeone('intern', { userMessage: 'morning' });
    });
    // Slop Chat™ replies raise a toast (`pushOfficeImPing`; `talk` skips it), so
    // the verb was arming the gate that then refused its own next turn.
    expect(getOfficeSnapshot().deskArrivals.some((a) => a.kind === 'im')).toBe(true);

    await act(async () => {
      await result.current.imSomeone('intern', { userMessage: 'and the auth box?' });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getOfficeSnapshot().imHistory.filter((m) => !m.outbound)).toHaveLength(2);
  });

  it('answers something you typed while a deliverable streams, but not mid-meeting', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ moment: { body: 'looks ok', colleagueId: 'intern', kind: 'im' } })
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    // Typing at somebody while a run streams is exactly when you would.
    const streaming = renderHook(() => useDeskActions({ ...BASE_PARAMS, pause: true }));
    await act(async () => {
      await streaming.result.current.imSomeone('intern', { userMessage: 'still going?' });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The one rung `'answering'` keeps: you are in a meeting, in front of people.
    _resetForTests();
    fetchMock.mockClear();
    const meeting = renderHook(() => useDeskActions({ ...BASE_PARAMS, meetingActive: true }));
    await act(async () => {
      await meeting.result.current.imSomeone('intern', { userMessage: 'anyone?' });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getOfficeSnapshot().imHistory.filter((m) => !m.outbound)).toHaveLength(0);
  });

  it('leaves the ambient verbs behind the surface gate', async () => {
    // The guard against reading the fix as "the gate was wrong", rather than
    // "one verb was on the wrong rung of it": an ambient verb is still refused
    // by exactly the toast a typed answer now walks past.
    pushOfficeImPing({ colleagueId: 'intern', body: 'standup in 5' });
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    expect(result.current.ambientBlockedReason).toBe('surface');
    await act(async () => {
      await result.current.getCoffee();
    });
    expect(getOfficeSnapshot().coffee).toBeNull();
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

  it('remembers the exchange, so emailing somebody is not being a stranger to them', async () => {
    /*
     * The end of the chain, and the reason it is asserted at the hook and not
     * only at the delivery seam: `emailSomeone` was the one verb that hands a
     * named colleague a sentence the user typed and did not pass
     * `recordWorkingMemory`, so both rungs of its ladder wrote the beat and
     * neither was ever asked to. You could write somebody three paragraphs,
     * read their reply, walk to their desk and be nobody.
     */
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));
    expect(hasWorkingMemoryFact('intern')).toBe(false);

    await act(async () => {
      await result.current.emailSomeone('intern', {
        subject: 'quick question',
        body: 'is this diagram too spicy?'
      });
    });

    // The gate `remarkTo` picks a dwell ceiling with — false here is what put
    // the deck in front of somebody you had just been corresponding with.
    expect(hasWorkingMemoryFact('intern')).toBe(true);
    const lines = workingMemoryPromptLines('intern');
    expect(lines.some((line) => line.includes('is this diagram too spicy?'))).toBe(true);
    // Written, not said: the office voices no email, so memory must not put one
    // in anybody's mouth.
    expect(lines.some((line) => line.startsWith('you emailed them:'))).toBe(true);
    expect(String(lines)).not.toContain('you said:');
  });

  it('tells the model why a dwell remark is happening, and only that verb', async () => {
    // Slice 19 shipped this line with no situational context at all, so a
    // colleague noticing you loitering was prompted exactly like a colleague
    // pinging you out of nowhere — right voice, right diagram, no idea anybody
    // was stood there. The wire field is the whole fix, so it is what is pinned.
    // An invariance guard since the dwell reserve landed, and meant to be: a
    // colleague with a board of yours in their head asked the model before and
    // asks it now. Kept stamped so this case pins the *wire field* and never
    // doubles as evidence about who is allowed to spend.
    stampWorkingMemoryBoard('intern', 'mermaid:Bake:20');
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          moment: { body: 'can I help you', colleagueId: 'intern', kind: 'im' }
        })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    await act(async () => {
      await result.current.remarkTo('intern');
    });
    const dwell = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(dwell.situation).toBe('dwell');
    // Still nothing typed: the two are mutually exclusive on the server, and a
    // dwell remark that arrived as a reply would lose its whole premise.
    expect(dwell.userMessage).toBeUndefined();

    // An ordinary desk ping is not a situation — you clicked a verb, which the
    // cold-open framing already describes.
    _resetForTests();
    await act(async () => {
      await result.current.imSomeone('intern');
    });
    const ping = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect('situation' in ping).toBe(false);
  });

  it('asks the model when you loiter next to somebody who has never met you', async () => {
    /*
     * The inversion. Until the reserve, `remarkTo` was handed a cap of `0` for
     * anybody with no beat and no board, so the most provoked line in the room
     * — you crossed the floor and stood there for five seconds — was dealt off
     * the deck every single time, which is the one thing
     * `officeFloorDwell.js`'s own header says this line must never be. The
     * gate's premise died in #624 and #654: `officeDeskWork` and `officeLog`
     * ride every request, so a stranger has something to speak from.
     */
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          moment: { body: 'can I help you', colleagueId: 'intern', kind: 'im' }
        })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    await act(async () => {
      await result.current.remarkTo('intern');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const asked = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(asked.situation).toBe('dwell');
    /* The blocks that made the old gate obsolete. Asserted here rather than
       taken on trust: if either stops riding the request, this slice is back
       to asking the model to improvise with nothing. */
    expect(Array.isArray(asked.officeDeskWork) && asked.officeDeskWork.length > 0).toBe(true);
    expect('officeLog' in asked).toBe(true);
    const line = getOfficeSnapshot().imHistory.find((m) => !m.outbound);
    expect(line?.body).toBe('can I help you');
  });

  it('keeps the last dwell call for somebody who remembers you', async () => {
    /*
     * The reserve, which is the whole reason this is not simply the gate
     * deleted. One counter, two ceilings: three strangers in a row must not be
     * able to leave the colleague who has a fact about you dealing from the
     * deck. `DWELL_STRANGER_LLM_CAP` (2) of `DWELL_LLM_CAP` (3) — total spend
     * on loitering is unchanged, only the order it goes out in.
     */
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ moment: { body: 'mm', colleagueId: 'intern', kind: 'im' } })
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useDeskActions(BASE_PARAMS));

    /* Three strangers. The first two spend; the third is over the stranger
       share and falls back in character. */
    for (const id of ['intern', 'jared', 'helpdesk']) {
      await act(async () => {
        await result.current.remarkTo(id);
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(DWELL_STRANGER_LLM_CAP);

    /* The reserved one. Same counter, higher ceiling, because they have a
       board of yours in their head. */
    stampWorkingMemoryBoard('greybeard', 'mermaid:Bake:20');
    await act(async () => {
      await result.current.remarkTo('greybeard');
    });
    expect(fetchMock).toHaveBeenCalledTimes(DWELL_LLM_CAP);

    /* And the total is still the total — a fifth loiter is canned whoever it
       is aimed at, which is the cap doing the job the gate was standing in
       for. */
    stampWorkingMemoryBoard('russ', 'mermaid:Bake:20');
    await act(async () => {
      await result.current.remarkTo('russ');
    });
    expect(fetchMock).toHaveBeenCalledTimes(DWELL_LLM_CAP);
    const russ = getOfficeSnapshot().imHistory.filter(
      (m) => !m.outbound && m.colleagueId === 'russ'
    );
    expect(russ.length).toBe(1);
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
