// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHuddlePlayback } from '../src/hooks/useHuddlePlayback.js';
import {
  endOfficeHuddle,
  getOfficeSnapshot,
  pauseOfficeHuddleForWatching,
  resumeOfficeHuddleSpeaking,
  setOfficeHuddleListening
} from '../src/state/officeMomentStore.js';
import {
  PAIR_EDIT_SETTLE_MS,
  PAIR_INITIATIVE_GAP_MS,
  PAIR_LULL_BASE_MS,
  PAIR_LULLS_MAX,
  PAIR_NODS_BEFORE_WORDS
} from '../src/utils/officePairEdits.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Render the boxes the label walk reads. jsdom has no layout, so each node
 * reports a rect by hand — the walk skips anything without one as off-screen.
 */
function drawBoxes(labels) {
  document.querySelector('svg')?.remove();
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const label of labels) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'node');
    group.id = `flowchart-${label}-0`;
    const text = document.createElementNS(SVG_NS, 'text');
    text.textContent = label;
    group.append(text);
    group.getBoundingClientRect = () => ({
      left: 10,
      top: 10,
      right: 50,
      bottom: 30,
      width: 40,
      height: 20
    });
    svg.append(group);
  }
  document.body.append(svg);
}

const OPENING = {
  script: {
    beats: [
      { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
      { speakerId: 'gilfoyle', text: 'Which is why Billing reads it.' }
    ]
  }
};
const ONE_LINE = { script: { beats: [{ speakerId: 'gilfoyle', text: 'Huh. Fine.' }] } };

function stubPairFetch() {
  const fetchMock = vi.fn(async (_url, init) => {
    const body = JSON.parse(init.body);
    return { ok: true, json: async () => (body.cue ? ONE_LINE : OPENING) };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Bodies of every call after the opening one. */
function laterBodies(fetchMock) {
  return fetchMock.mock.calls.slice(1).map(([, init]) => JSON.parse(init.body));
}

describe('usePairInitiative (through useHuddlePlayback)', () => {
  let source;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    source = 'flowchart TD\n  Auth --> Billing';
    drawBoxes(['Auth', 'Billing']);
    endOfficeHuddle();
  });

  afterEach(() => {
    cleanup();
    endOfficeHuddle();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function seatPair() {
    const fetchMock = stubPairFetch();
    const hook = renderHook(() =>
      useHuddlePlayback({
        getSessionId: () => 'sess-1',
        getContentType: () => 'mermaid',
        getDiagramSource: () => source,
        getSvgRoot: () => null
      })
    );
    await act(async () => {
      await hook.result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
    });
    return { fetchMock, hook };
  }

  async function listen() {
    await act(async () => {
      setOfficeHuddleListening(getOfficeSnapshot().huddle.id);
    });
  }

  async function wait(ms) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('reacts to your edit once the canvas sits still, naming what changed', async () => {
    const { fetchMock } = await seatPair();
    await listen();

    source = 'flowchart TD\n  Auth --> Billing\n  Billing --> Cache';
    drawBoxes(['Auth', 'Billing', 'Cache']);
    await wait(400);
    expect(laterBodies(fetchMock)).toHaveLength(0);
    await wait(PAIR_EDIT_SETTLE_MS);

    const [body] = laterBodies(fetchMock);
    expect(body.cue).toBe('edit');
    expect(body.turns.at(-1)).toEqual({
      role: 'edit',
      text: 'added a box "Cache" (id flowchart-Cache-0)'
    });
    // The reaction is a turn of its own, and the edit joins the transcript.
    expect(getOfficeSnapshot().huddle.turnIndex).toBe(1);
    expect(
      getOfficeSnapshot()
        .huddle.turns.slice(-2)
        .map((t) => t.role)
    ).toEqual(['edit', 'partner']);
  });

  it('waits until you have named a new box before reacting to it', async () => {
    const { fetchMock } = await seatPair();
    await listen();
    // A new box lands under its placeholder id with its name field open.
    source = 'flowchart TD\n  Auth --> Billing\n  Billing --> n1[n1]';
    drawBoxes(['Auth', 'Billing', 'n1']);
    const form = document.createElement('form');
    form.className = 'graph-edit-label-inline';
    document.body.append(form);
    await wait(PAIR_EDIT_SETTLE_MS * 3);
    expect(laterBodies(fetchMock)).toHaveLength(0);

    source = 'flowchart TD\n  Auth --> Billing\n  Billing --> n1[Cache]';
    drawBoxes(['Auth', 'Billing', 'Cache']);
    form.remove();
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    const [body] = laterBodies(fetchMock);
    expect(body.turns.at(-1).text).toBe('added a box "Cache" (id flowchart-Cache-0)');
  });

  it('reads the change a Do-it run made as their suggestion landing', async () => {
    const { fetchMock } = await seatPair();
    await listen();
    await act(async () => {
      pauseOfficeHuddleForWatching(getOfficeSnapshot().huddle.id);
    });
    source = 'flowchart TD\n  Auth --> Billing\n  Auth --> Tokens';
    await wait(400);
    await act(async () => {
      resumeOfficeHuddleSpeaking(getOfficeSnapshot().huddle.id);
    });
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    const [body] = laterBodies(fetchMock);
    expect(body.cue).toBe('edit');
    expect(body.turns.at(-1).text).toBe(
      'ran your suggestion, which edited the diagram: `Auth --> Tokens`'
    );
  });

  it('waits for them to finish talking before reacting to an edit', async () => {
    const { fetchMock } = await seatPair();
    source = 'flowchart TD\n  Auth --> Billing --> Cache';
    drawBoxes(['Auth', 'Billing', 'Cache']);
    await wait(PAIR_EDIT_SETTLE_MS * 3);
    expect(laterBodies(fetchMock)).toHaveLength(0);

    await listen();
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    expect(laterBodies(fetchMock).map((b) => b.cue)).toEqual(['edit']);
  });

  it('does not narrate an edit streak: one reaction per gap', async () => {
    const { fetchMock } = await seatPair();
    await listen();
    source = 'flowchart TD\n  Auth --> Billing --> Cache';
    drawBoxes(['Auth', 'Billing', 'Cache']);
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    await listen();
    source = 'flowchart TD\n  Auth --> Billing --> Cache --> Queue';
    drawBoxes(['Auth', 'Billing', 'Cache', 'Queue']);
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    expect(laterBodies(fetchMock)).toHaveLength(1);
    await wait(PAIR_INITIATIVE_GAP_MS);
    expect(laterBodies(fetchMock).map((b) => b.cue)).toEqual(['edit', 'edit']);
  });

  it('nods at a small edit instead of talking, and speaks again after a few nods', async () => {
    const { fetchMock } = await seatPair();
    await listen();
    for (let i = 1; i <= PAIR_NODS_BEFORE_WORDS; i += 1) {
      // An arrow each time, and no box comes or goes: a tweak.
      source = `${source}\n  Auth -.->|${i}| Billing`;
      await wait(PAIR_EDIT_SETTLE_MS + 400);
      expect(laterBodies(fetchMock)).toHaveLength(0);
      expect(getOfficeSnapshot().huddle.gesture).toMatchObject({ kind: 'nod', seq: i });
    }
    source = `${source}\n  Billing --> Auth`;
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    expect(laterBodies(fetchMock).map((b) => b.cue)).toEqual(['edit']);
    expect(laterBodies(fetchMock)[0].turns.at(-1).text).toBe(
      'edited the diagram: `Billing --> Auth`'
    );
  });

  it('tells them what they had suggested, so they can see if you took it', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      const opening = {
        script: {
          beats: [
            {
              speakerId: 'gilfoyle',
              text: 'Put a cache in front of Billing.',
              actionPrompt: 'Add a Cache node in front of Billing'
            }
          ]
        }
      };
      return { ok: true, json: async () => (body.cue ? ONE_LINE : opening) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useHuddlePlayback({
        getContentType: () => 'mermaid',
        getDiagramSource: () => source,
        getSvgRoot: () => null
      })
    );
    await act(async () => {
      await result.current.startHuddle(['gilfoyle'], { mode: 'pair' });
    });
    await listen();
    source = 'flowchart TD\n  Auth --> Billing --> Queue';
    drawBoxes(['Auth', 'Billing', 'Queue']);
    await wait(PAIR_EDIT_SETTLE_MS + 400);
    const [body] = laterBodies(fetchMock);
    expect(body.turns.at(-1).text).toBe(
      'added a box "Queue" (id flowchart-Queue-0). You had suggested: "Add a Cache node in front of Billing"'
    );
  });

  it('speaks up after a quiet stretch, with no line of yours in the transcript', async () => {
    const { fetchMock } = await seatPair();
    await listen();
    await wait(PAIR_LULL_BASE_MS - 1000);
    expect(laterBodies(fetchMock)).toHaveLength(0);
    await wait(1000);

    const [body] = laterBodies(fetchMock);
    expect(body.cue).toBe('lull');
    expect(body.turns.every((t) => t.role === 'partner')).toBe(true);
  });

  it('holds a lull while you are typing', async () => {
    const { fetchMock } = await seatPair();
    const input = document.createElement('input');
    document.body.append(input);
    input.value = 'so what about';
    input.focus();
    await listen();
    await wait(PAIR_LULL_BASE_MS + 1000);
    expect(laterBodies(fetchMock)).toHaveLength(0);

    input.value = '';
    await wait(15_000);
    expect(laterBodies(fetchMock).map((b) => b.cue)).toEqual(['lull']);
  });

  it('speaks up only a few times per pairing', async () => {
    const { fetchMock } = await seatPair();
    for (let i = 0; i < PAIR_LULLS_MAX + 2; i += 1) {
      await listen();
      await wait(PAIR_LULL_BASE_MS * 2 ** i + 1000);
    }
    expect(laterBodies(fetchMock).filter((b) => b.cue === 'lull')).toHaveLength(PAIR_LULLS_MAX);
  });

  it('never speaks up in a mob', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        script: {
          beats: [
            { speakerId: 'gilfoyle', text: 'One.' },
            { speakerId: 'dinesh', text: 'Two.' }
          ]
        }
      })
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useHuddlePlayback({ getContentType: () => 'mermaid', getDiagramSource: () => source })
    );
    await act(async () => {
      await result.current.startHuddle(['gilfoyle', 'dinesh']);
    });
    await wait(PAIR_LULL_BASE_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
