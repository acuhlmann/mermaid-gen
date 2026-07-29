// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHuddlePlayback } from '../src/hooks/useHuddlePlayback.js';
import { endOfficeHuddle, getOfficeSnapshot } from '../src/state/officeMomentStore.js';

const TEAM = ['gilfoyle', 'dinesh', 'erlich'];

const SCRIPT = {
  beats: [
    { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
    { speakerId: 'dinesh', text: 'As I said.' },
    { speakerId: 'erlich', text: 'Platform play.' }
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

  it('refuses a huddle of one — that is a walk-by, not a huddle', async () => {
    const fetchMock = stubFetch({ script: SCRIPT });
    const { result } = renderHook(() => useHuddlePlayback(params()));
    await act(async () => {
      await result.current.startHuddle(['gilfoyle']);
    });
    expect(result.current.huddle).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
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
});
