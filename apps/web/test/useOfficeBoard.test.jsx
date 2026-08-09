// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOfficeBoard } from '../src/hooks/useOfficeBoard.js';

/**
 * The board is a **sample**, not a subscription (§ 5 slice 16).
 *
 * This is the slice's load-bearing design call and the one most likely to be
 * "fixed" by a later agent into a live subscription, because a live board looks
 * more correct in isolation. It is not: `OfficeLayer` takes the diagram as
 * getters precisely so the office does not re-render while you type, and a
 * subscribed board would repaint sixteen animated figures, a walk animation and
 * a directed camera on every keystroke.
 */

const FIRST = 'flowchart LR\n  a[One] --> b[Two]';
const SECOND = 'flowchart LR\n  a[One] --> b[Two]\n  b --> c[Three]\n  c --> d[Four]';

function setup(initial = {}) {
  let source = FIRST;
  const getDiagramSource = vi.fn(() => source);
  const view = renderHook((props) => useOfficeBoard(props), {
    initialProps: {
      getDiagramSource,
      getContentType: () => 'mermaid',
      runSignal: null,
      onFloor: false,
      meetingOpen: false,
      ...initial
    }
  });
  return {
    ...view,
    getDiagramSource,
    setSource: (next) => {
      source = next;
    },
    props: {
      getDiagramSource,
      getContentType: () => 'mermaid',
      runSignal: null,
      onFloor: false,
      meetingOpen: false,
      ...initial
    }
  };
}

describe('useOfficeBoard', () => {
  it('samples once on mount', () => {
    const { result } = setup();
    expect(result.current.nodes).toBe(2);
  });

  it('does not re-sample when the source changes underneath it', () => {
    const { result, rerender, setSource, props } = setup();
    setSource(SECOND);
    // A re-render for any unrelated reason must not pick the new source up.
    rerender({ ...props });
    expect(result.current.nodes).toBe(2);
  });

  it('re-samples on a completed run', () => {
    const { result, rerender, setSource, props } = setup();
    setSource(SECOND);
    rerender({ ...props, runSignal: { id: 1 } });
    expect(result.current.nodes).toBe(4);
  });

  it('re-samples when you stand up', () => {
    const { result, rerender, setSource, props } = setup();
    setSource(SECOND);
    rerender({ ...props, onFloor: true });
    expect(result.current.nodes).toBe(4);
  });

  it('re-samples when a meeting opens', () => {
    const { result, rerender, setSource, props } = setup();
    setSource(SECOND);
    rerender({ ...props, meetingOpen: true });
    expect(result.current.nodes).toBe(4);
  });

  it('survives a fresh getter identity every render', () => {
    // The app shell passes inline arrows, so a hook that read them from a
    // dependency array would re-sample on every single render — which is the
    // subscription this hook exists to avoid, arrived at by accident.
    const { rerender, getDiagramSource, props } = setup();
    const afterMount = getDiagramSource.mock.calls.length;
    rerender({ ...props, getDiagramSource: (...args) => getDiagramSource(...args) });
    rerender({ ...props, getDiagramSource: (...args) => getDiagramSource(...args) });
    expect(getDiagramSource.mock.calls.length).toBe(afterMount);
  });

  it('reports an empty slot as no board at all', () => {
    const { result } = setup({ getDiagramSource: () => '' });
    expect(result.current).toBeNull();
  });
});
