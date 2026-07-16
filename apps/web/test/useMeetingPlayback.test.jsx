// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  beatDelayMs,
  meetingMinutes,
  useMeetingPlayback
} from '../src/hooks/useMeetingPlayback.js';

const ATTENDEES = ['scrumMaster', 'exec', 'greybeard'];

const SCRIPT = {
  scriptVersion: 1,
  title: 'WG: Diagram Governance Sync (recurring)',
  beats: [
    { speakerId: 'scrumMaster', kind: 'procedural', text: 'Welcome! Time-boxed to 15.' },
    { speakerId: 'greybeard', kind: 'offRails', text: 'We had this diagram in 2009.' },
    {
      speakerId: 'exec',
      kind: 'substantive',
      text: 'Merge Discovery and Research.',
      actionPrompt: 'Merge the Discovery and Research nodes'
    },
    { speakerId: 'scrumMaster', kind: 'procedural', text: 'Parking-lotted. Great energy!' }
  ]
};

const PARAMS = {
  getSessionId: () => 'test-session',
  getContentType: () => 'mermaid',
  getDiagramSource: () => 'flowchart TD\n A[Discovery]-->B[Research]',
  onUsage: vi.fn()
};

function mockFetchWith(payload, ok = true) {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(payload)
    })
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('useMeetingPlayback', () => {
  it('plays the script beat by beat, then ends completed with minutes', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchWith({ script: SCRIPT, usage: { inputTokens: 5, outputTokens: 9 } })
    );
    const onUsage = vi.fn();
    const { result } = renderHook(() => useMeetingPlayback({ ...PARAMS, onUsage }));

    await act(async () => {
      await result.current.startMeeting({ attendees: ATTENDEES });
    });
    expect(result.current.meeting.state).toBe('playing');
    expect(result.current.meeting.title).toBe(SCRIPT.title);
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 5, outputTokens: 9, model: null });

    for (const beat of SCRIPT.beats) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(beatDelayMs(beat) + 5);
      });
    }
    expect(result.current.meeting.state).toBe('ended');
    expect(result.current.meeting.completed).toBe(true);
    expect(result.current.meeting.transcript).toHaveLength(SCRIPT.beats.length);
    const minutes = meetingMinutes(result.current.meeting);
    expect(minutes).toHaveLength(1);
    expect(minutes[0].actionPrompt).toBe('Merge the Discovery and Research nodes');
  });

  it('cancels in-fiction when the script fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    const { result } = renderHook(() => useMeetingPlayback(PARAMS));
    await act(async () => {
      await result.current.startMeeting({ attendees: ATTENDEES });
    });
    expect(result.current.meeting.state).toBe('cancelled');
  });

  it('records the user line, spends an interjection, and splices revised beats', async () => {
    const fetchMock = vi.fn((url) => {
      if (String(url).endsWith('/interject')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              beats: [
                { speakerId: 'exec', kind: 'smalltalk', text: 'Great point. Hard stop in four.' }
              ]
            })
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ script: SCRIPT }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useMeetingPlayback(PARAMS));
    await act(async () => {
      await result.current.startMeeting({ attendees: ATTENDEES });
    });
    await act(async () => {
      await result.current.interject('What about the budget?');
    });
    expect(result.current.meeting.interjectionsLeft).toBe(1);
    const userLines = result.current.meeting.transcript.filter((b) => b.speakerId === 'you');
    expect(userLines).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    const lastBeat = result.current.meeting.transcript.at(-1);
    expect(lastBeat.text).toBe('Great point. Hard stop in four.');
  });

  it('leaving early ends the meeting incomplete; closing resets to null', async () => {
    vi.stubGlobal('fetch', mockFetchWith({ script: SCRIPT }));
    const { result } = renderHook(() => useMeetingPlayback(PARAMS));
    await act(async () => {
      await result.current.startMeeting({ attendees: ATTENDEES });
    });
    act(() => {
      result.current.leaveMeeting();
    });
    expect(result.current.meeting.state).toBe('ended');
    expect(result.current.meeting.completed).toBe(false);
    act(() => {
      result.current.closeMeeting();
    });
    expect(result.current.meeting).toBeNull();
  });
});
