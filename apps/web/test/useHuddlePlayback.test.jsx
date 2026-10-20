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

  describe('pairing as a conversation', () => {
    /** The canvas the pair is looking at, with rects jsdom can actually measure. */
    function renderCanvas() {
      document.body.innerHTML = `
        <div class="diagram-viewport">
          <div class="diagram-zoom-layer">
            <svg>
              <g class="node" id="flowchart-Auth-0"><text>Auth</text></g>
              <g class="node" id="flowchart-Billing-1"><text>Billing</text></g>
            </svg>
          </div>
        </div>`;
      // The label walk drops anything with a zero rect, and jsdom reports zero.
      document.querySelectorAll('g.node').forEach((node, index) => {
        node.getBoundingClientRect = () => ({
          left: 10 + index * 100,
          top: 10,
          right: 90 + index * 100,
          bottom: 50,
          width: 80,
          height: 40,
          x: 10 + index * 100,
          y: 10
        });
      });
    }

    /** A reply turn: one beat, whatever you said answered. */
    const REPLY_SCRIPT = {
      script: {
        beats: [{ speakerId: 'gilfoyle', text: 'Because Billing already reads it.' }]
      }
    };

    function stubPairFetch() {
      const fetchMock = vi.fn(async (_url, init) => {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => (body.turns?.length ? REPLY_SCRIPT : { script: PAIR_SCRIPT })
        };
      });
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    beforeEach(() => {
      renderCanvas();
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('ships the pointable node ids on a mermaid canvas', async () => {
      const fetchMock = stubPairFetch();
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // The ids the model is allowed to point at are exactly the ones the walk
      // resolved — a beat naming anything else is stripped server-side.
      expect(body.visibleIds).toEqual(['flowchart-Auth-0', 'flowchart-Billing-1']);
      expect(body.visibleLabels).toEqual(['Auth', 'Billing']);
      expect(body.mode).toBe('pair');
    });

    it('ships no ids for a content type whose nodes cannot be resolved', async () => {
      const fetchMock = stubPairFetch();
      const { result } = renderHook(() =>
        useHuddlePlayback(
          params({
            getContentType: () => 'chart',
            getDiagramSource: () =>
              JSON.stringify({ spec: { title: 'Revenue', data: { values: [] } } })
          })
        )
      );
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // A chart's "ids" are copies of its labels; pointing at one resolves to
      // nothing, so asking for it would only invite a hand over empty canvas.
      expect(body.visibleIds).toEqual([]);
      expect(body.visibleLabels.length).toBeGreaterThan(0);
    });

    it('records the opening script as the partner side of the transcript', async () => {
      stubPairFetch();
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      expect(result.current.huddle.turns.map((t) => t.role)).toEqual([
        'partner',
        'partner',
        'partner'
      ]);
      expect(result.current.huddle.turnIndex).toBe(0);
    });

    it('answers what you said: one beat replaces the turn, history stays out of it', async () => {
      const fetchMock = stubPairFetch();
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      expect(result.current.huddle.beats).toHaveLength(3);

      let beat;
      await act(async () => {
        beat = await result.current.continuePairing('Why does Billing read it?');
      });

      expect(beat?.text).toBe('Because Billing already reads it.');
      // REPLACES, not appends: a growing beats array changes the pacing loop's
      // line count and re-speaks lines already heard.
      expect(result.current.huddle.beats).toHaveLength(1);
      expect(result.current.huddle.beats[0].text).toBe('Because Billing already reads it.');
      expect(result.current.huddle.turnIndex).toBe(1);
      expect(result.current.huddle.phase).toBe('speaking');
      expect(result.current.huddle.awaitingReply).toBe(false);

      const body = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(body.mode).toBe('pair');
      expect(body.turns.at(-1)).toEqual({ role: 'you', text: 'Why does Billing read it?' });
      // The partner's own opening is in the transcript, so the reply can pick up
      // the thread rather than restarting the tour.
      expect(body.turns.filter((t) => t.role === 'partner')).toHaveLength(3);
    });

    it('ignores a blank reply and a second one while the first is in flight', async () => {
      const fetchMock = stubPairFetch();
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      const callsAfterOpen = fetchMock.mock.calls.length;

      await act(async () => {
        expect(await result.current.continuePairing('   ')).toBeNull();
      });
      expect(fetchMock.mock.calls).toHaveLength(callsAfterOpen);

      let pending;
      await act(async () => {
        pending = result.current.continuePairing('Why?');
        // awaitingReply is the gate that stops a second question queueing over
        // the first — the strip is disabled on it, and so is the hook. Read from
        // the store, not the hook: `result.current` is a render snapshot and
        // React has not flushed one yet mid-act.
        expect(getOfficeSnapshot().huddle.awaitingReply).toBe(true);
        expect(await result.current.continuePairing('And also?')).toBeNull();
      });
      await act(async () => {
        await pending;
      });
      expect(fetchMock.mock.calls).toHaveLength(callsAfterOpen + 1);
    });

    it('keeps them seated when the answer never lands', async () => {
      let calls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) => {
          calls += 1;
          const body = JSON.parse(init.body);
          if (body.turns?.length) return { ok: false, json: async () => ({}) };
          return { ok: true, json: async () => ({ script: PAIR_SCRIPT }) };
        })
      );
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
      });
      const huddleId = result.current.huddle.id;

      await act(async () => {
        expect(await result.current.continuePairing('Why?')).toBeNull();
      });

      // A failed reply is not a dismissal: they are still next to you, they just
      // did not answer, and the strip is still there to try again.
      expect(calls).toBe(2);
      expect(result.current.huddle).not.toBeNull();
      expect(result.current.huddle.id).toBe(huddleId);
      expect(result.current.huddle.awaitingReply).toBe(false);
      expect(result.current.huddle.beats).toHaveLength(3);
    });

    it('is not a conversation for a mob', async () => {
      const fetchMock = stubFetch({ script: SCRIPT });
      const { result } = renderHook(() => useHuddlePlayback(params()));
      await act(async () => {
        await result.current.startHuddle(TEAM);
      });
      const callsAfterOpen = fetchMock.mock.calls.length;

      await act(async () => {
        expect(await result.current.continuePairing('Why?')).toBeNull();
      });
      expect(fetchMock.mock.calls).toHaveLength(callsAfterOpen);
      // A mob keeps no transcript — its refresh is driven by the canvas, not by
      // anybody replying.
      expect(result.current.huddle.turns).toEqual([]);
    });
  });
});
