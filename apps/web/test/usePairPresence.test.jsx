// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHuddlePlayback } from '../src/hooks/useHuddlePlayback.js';
import {
  endOfficeHuddle,
  getOfficeSnapshot,
  setOfficeHuddleListening
} from '../src/state/officeMomentStore.js';

const OPENING = {
  script: {
    beats: [
      { speakerId: 'gilfoyle', text: 'Auth is doing two jobs.' },
      { speakerId: 'gilfoyle', text: 'Which is why Billing reads it.' }
    ]
  }
};

describe('usePairPresence (through useHuddlePlayback)', () => {
  let source;

  beforeEach(() => {
    vi.useFakeTimers();
    source = 'flowchart TD\n  Auth --> Billing';
    endOfficeHuddle();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => OPENING }))
    );
  });

  afterEach(() => {
    cleanup();
    endOfficeHuddle();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function seat(mode = 'pair') {
    const onCancelNarration = vi.fn();
    const hook = renderHook(() =>
      useHuddlePlayback({
        getContentType: () => 'mermaid',
        getDiagramSource: () => source,
        getSvgRoot: () => null,
        onCancelNarration
      })
    );
    await act(async () => {
      await hook.result.current.startHuddle(
        mode === 'pair' ? ['gilfoyle'] : ['gilfoyle', 'dinesh'],
        { mode }
      );
    });
    return { hook, onCancelNarration };
  }

  async function wait(ms) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('stops talking when you start typing, and forgets the line they never said', async () => {
    const { onCancelNarration } = await seat();
    expect(getOfficeSnapshot().huddle.phase).toBe('speaking');
    expect(getOfficeSnapshot().huddle.turns).toHaveLength(2);

    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });

    const live = getOfficeSnapshot().huddle;
    expect(live.phase).toBe('listening');
    expect(onCancelNarration).toHaveBeenCalled();
    // They were on their first line, so only that one is theirs to have said.
    expect(live.turns.map((t) => t.text)).toEqual(['Auth is doing two jobs.']);
  });

  it('is not cut off by a shortcut or a key outside any field', async () => {
    await seat();
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    });
    expect(getOfficeSnapshot().huddle.phase).toBe('speaking');
  });

  it('stops talking when the diagram changes under them', async () => {
    await seat();
    source = 'flowchart TD\n  Auth --> Billing --> Cache';
    await wait(400);
    expect(getOfficeSnapshot().huddle.phase).toBe('listening');
  });

  it('stops talking when you open a label to type in', async () => {
    await seat();
    const form = document.createElement('form');
    form.className = 'graph-edit-label-inline';
    document.body.append(form);
    await wait(400);
    expect(getOfficeSnapshot().huddle.phase).toBe('listening');
  });

  it('glances at the node you pick up while it is your turn', async () => {
    await seat();
    await act(async () => {
      setOfficeHuddleListening(getOfficeSnapshot().huddle.id);
    });
    const layer = document.createElement('div');
    layer.className = 'diagram-zoom-layer';
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    node.id = 'flowchart-Billing-1';
    layer.append(node);
    document.body.append(layer);
    await wait(400);
    expect(getOfficeSnapshot().huddle.gesture).toBeUndefined();

    node.setAttribute('class', 'node is-diagram-selected');
    await wait(400);
    expect(getOfficeSnapshot().huddle.gesture).toMatchObject({
      kind: 'glance',
      focusId: 'flowchart-Billing-1'
    });
    // Still holding the same node: one glance, not a stare that keeps re-firing.
    await wait(2000);
    expect(getOfficeSnapshot().huddle.gesture.seq).toBe(1);
  });

  it('leaves a mob alone: it is stopped with a raised hand, not a keystroke', async () => {
    await seat('mob');
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    });
    expect(getOfficeSnapshot().huddle.phase).toBe('speaking');
  });
});
