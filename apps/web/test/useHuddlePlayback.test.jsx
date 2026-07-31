// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHuddlePlayback, huddleDiagramFingerprint } from '../src/hooks/useHuddlePlayback.js';
import {
  endOfficeHuddle,
  getOfficeSnapshot,
  setOfficeHuddleActiveLineIndex
} from '../src/state/officeMomentStore.js';

const TEAM = ['gilfoyle', 'dinesh', 'erlich'];

const SCRIPT = {
  beats: [
    { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
    { speakerId: 'dinesh', text: 'As I said.' },
    { speakerId: 'erlich', text: 'Platform play.' }
  ]
};

/** A pair is several beats from ONE voice — the shape a mob script cannot take. */
const PAIR_SCRIPT = {
  beats: [
    { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
    { speakerId: 'gilfoyle', text: 'The second one is authorization.' },
    { speakerId: 'gilfoyle', text: 'Which is why Billing reads it.', actionPrompt: 'Split Auth' }
  ]
};

function params(overrides = {}) {
  return {
    getSessionId: () => 'sess-1',
    getContentType: () => 'mermaid',
    getDiagramSource: () => 'flowchart TD\n  Auth[Auth]',
    getSvgRoot: () => null,
    ...overrides
  };
}

function stubFetch(payload, { ok = true } = {}) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => payload }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useHuddlePlayback', () => {
  beforeEach(() => {
    endOfficeHuddle();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    endOfficeHuddle();
  });

  it('seats the ring before the request and hands it lines when the script lands', async () => {
    let resolveFetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = () => resolve({ ok: true, json: async () => ({ script: SCRIPT }) });
          })
      )
    );
    const { result } = renderHook(() => useHuddlePlayback(params()));

    let pending;
    await act(async () => {
      pending = result.current.startHuddle(TEAM);
    });
    // The crowd arrives first — that is the feedback that the click landed.
    expect(result.current.huddle.phase).toBe('gathering');
    expect(result.current.huddle.attendees).toEqual(TEAM);
    expect(result.current.huddle.beats).toEqual([]);

    await act(async () => {
      resolveFetch();
      await pending;
    });
    expect(result.current.huddle.phase).toBe('speaking');
    expect(result.current.huddle.beats).toHaveLength(3);
  });

  it('posts the diagram context to /api/office/huddle', async () => {
    const fetchMock = stubFetch({ script: SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/office/huddle');
    const body = JSON.parse(init.body);
    expect(body.attendees).toEqual(TEAM);
    expect(body.contentType).toBe('mermaid');
    expect(body.diagramSource).toContain('Auth');
  });

  it('dissolves the ring when nobody had anything to say', async () => {
    stubFetch({ script: { beats: [] } });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    // No error toast — an empty huddle is everyone wandering off, same doctrine
    // as a cancelled meeting.
    expect(result.current.huddle).toBeNull();
  });

  it('dissolves the ring when the request fails', async () => {
    stubFetch({}, { ok: false });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    expect(result.current.huddle).toBeNull();
  });

  it('does not let a late response re-seat a huddle that was hard-stopped', async () => {
    let resolveFetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = () => resolve({ ok: true, json: async () => ({ script: SCRIPT }) });
          })
      )
    );
    const { result } = renderHook(() => useHuddlePlayback(params()));

    let pending;
    await act(async () => {
      pending = result.current.startHuddle(TEAM);
    });
    await act(async () => {
      result.current.endHuddle();
    });
    expect(getOfficeSnapshot().huddle).toBeNull();

    await act(async () => {
      resolveFetch();
      await pending;
    });
    expect(getOfficeSnapshot().huddle).toBeNull();
  });

  it('reports token usage to the cost sink', async () => {
    stubFetch({
      script: SCRIPT,
      usage: { inputTokens: 120, outputTokens: 45 },
      model: 'some-model'
    });
    const onUsage = vi.fn();
    const { result } = renderHook(() => useHuddlePlayback(params({ onUsage })));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 120,
      outputTokens: 45,
      model: 'some-model'
    });
  });

  it('refuses a mob of one — that is a walk-by, not a huddle', async () => {
    const fetchMock = stubFetch({ script: SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(['gilfoyle']);
    });
    expect(result.current.huddle).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The seat floor was never "two people"; it was "enough people to script a
  // scene for". Pairing brings its own script, so it brings its own floor.
  it('seats a pair of one, and refuses a pair of several', async () => {
    const fetchMock = stubFetch({ script: PAIR_SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
    });
    expect(result.current.huddle.mode).toBe('pair');
    expect(result.current.huddle.attendees).toEqual(['gilfoyle']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe('pair');

    endOfficeHuddle();
    fetchMock.mockClear();
    await act(async () => {
      await result.current.startHuddle(TEAM, { mode: 'pair' });
    });
    expect(result.current.huddle).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('defaults to a mob so every existing caller keeps mobbing', async () => {
    const fetchMock = stubFetch({ script: SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    expect(result.current.huddle.mode).toBe('mob');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe('mob');
  });

  // A mob is re-scripted mid-scene because the replacement is the same size as
  // what it replaces. One voice has no such invariant, so a pair holds the
  // script it sat down with rather than restarting its own pacing.
  it('never re-scripts a pair when the canvas changes underneath it', async () => {
    let watchKey = 'mermaid::one';
    const fetchMock = stubFetch({ script: PAIR_SCRIPT });
    const { result } = renderHook(() =>
      useHuddlePlayback(params({ getDiagramWatchKey: () => watchKey }))
    );
    await act(async () => {
      await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
    });
    const callsAfterStart = fetchMock.mock.calls.length;

    watchKey = 'mermaid::two';
    await act(async () => {
      setOfficeHuddleActiveLineIndex(getOfficeSnapshot().huddle.id, 0);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterStart);
    expect(result.current.huddle.beats).toEqual(PAIR_SCRIPT.beats);
  });

  it('cancels narration when the huddle ends', async () => {
    stubFetch({ script: SCRIPT });
    const onCancelNarration = vi.fn();
    const { result } = renderHook(() => useHuddlePlayback(params({ onCancelNarration })));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    await act(async () => {
      result.current.endHuddle();
    });
    expect(onCancelNarration).toHaveBeenCalled();
  });

  it('fetches an on-spot suggestion for a silent teammate without growing the spoken queue', async () => {
    const seats = [...TEAM, 'russ'];
    const suggestPayload = {
      suggestion: 'Make Auth a platform.',
      kind: 'suggestion'
    };
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/api/advisor/suggest')) {
        return { ok: true, json: async () => suggestPayload };
      }
      return { ok: true, json: async () => ({ script: SCRIPT }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(seats);
    });
    // SCRIPT covers gilfoyle/dinesh/erlich — russ is seated but silent.
    let beat;
    await act(async () => {
      beat = await result.current.requestSpeakerSuggestion('russ');
    });
    expect(beat?.text).toBe('Make Auth a platform.');
    expect(result.current.huddle.beats).toHaveLength(3);
    expect(result.current.huddle.suggestions.russ.text).toBe('Make Auth a platform.');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/advisor/suggest'))).toBe(
      true
    );
  });

  it('pauses for watching and resumes speaking', async () => {
    stubFetch({ script: SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    await act(async () => {
      result.current.pauseForWatching();
    });
    expect(result.current.huddle.phase).toBe('watching');
    await act(async () => {
      result.current.resumeSpeaking();
    });
    expect(result.current.huddle.phase).toBe('speaking');
  });

  it('re-scripts unspoken remarks when the diagram changes mid-huddle', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.priorBeats?.length) {
        return {
          ok: true,
          json: async () => ({
            script: {
              beats: [
                { speakerId: 'dinesh', text: 'Auth finally showed up.' },
                { speakerId: 'erlich', text: 'Platform play, now with boxes.' }
              ]
            }
          })
        };
      }
      return {
        ok: true,
        json: async () => ({ script: SCRIPT })
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    let diagramSource = '';
    const { result } = renderHook(() =>
      useHuddlePlayback(
        params({
          getDiagramSource: () => diagramSource,
          getDiagramWatchKey: () => huddleDiagramFingerprint('mermaid', diagramSource)
        })
      )
    );
    await act(async () => {
      await result.current.startHuddle(TEAM);
    });
    const huddleId = result.current.huddle.id;
    await act(async () => {
      setOfficeHuddleActiveLineIndex(huddleId, 1);
    });

    diagramSource = 'flowchart TD\n  Auth[Auth]';
    await waitFor(
      () => {
        expect(
          fetchMock.mock.calls.some(([, init]) => JSON.parse(init.body).priorBeats?.length === 1)
        ).toBe(true);
      },
      { timeout: 3000 }
    );

    expect(result.current.huddle.beats[0].text).toBe(SCRIPT.beats[0].text);
    expect(result.current.huddle.beats[1].text).toBe('Auth finally showed up.');
  });
});
