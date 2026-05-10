// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiagramCanvas from '../src/components/DiagramCanvas.jsx';

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(async (_id, source) => ({
    svg: `<svg><text>${source}</text></svg>`
  }))
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock
  }
}));

const editorHarness = vi.hoisted(() => ({
  revealRangeInCenter: vi.fn(),
  setSelection: vi.fn(),
  deltaDecorations: vi.fn(() => ['dec-1'])
}));

vi.mock('../src/utils/registerMermaidMonacoOnce.js', () => ({
  default: vi.fn()
}));

vi.mock('@monaco-editor/react', () => ({
  default: function EditorMock({ value, onChange, beforeMount, onMount }) {
    useLayoutEffect(() => {
      const monaco = {
        Range: class Range {
          constructor(sl, sc, el, ec) {
            this.startLineNumber = sl;
            this.startColumn = sc;
            this.endLineNumber = el;
            this.endColumn = ec;
          }
        }
      };
      beforeMount?.(monaco);
      const editor = {
        deltaDecorations: editorHarness.deltaDecorations,
        revealRangeInCenter: editorHarness.revealRangeInCenter,
        setSelection: editorHarness.setSelection
      };
      onMount?.(editor, monaco);
    }, []);
    return (
      <textarea
        aria-label="Mermaid DSL"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
}));

describe('DiagramCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initializeMock.mockClear();
    renderMock.mockClear();
    editorHarness.revealRangeInCenter.mockClear();
    editorHarness.setSelection.mockClear();
    editorHarness.deltaDecorations.mockClear();
    editorHarness.deltaDecorations.mockImplementation(() => ['dec-1']);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders svg from initial source and updates when user edits', async () => {
    const onManualEdit = vi.fn();
    render(
      <DiagramCanvas
        mermaidSource={'flowchart TD\nA --> B'}
        revisionId={1}
        onManualEdit={onManualEdit}
        editorOpen
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^diagram-/), 'flowchart TD\nA --> B');

    fireEvent.change(screen.getByLabelText('Mermaid DSL'), {
      target: { value: 'flowchart TD\nA --> C' }
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onManualEdit).toHaveBeenCalledWith('flowchart TD\nA --> C');
    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^diagram-/), 'flowchart TD\nA --> C');
  });

  it('re-syncs editor and renderer when a new agent source arrives', async () => {
    const { rerender } = render(
      <DiagramCanvas mermaidSource={'flowchart TD\nStart --> Mid'} revisionId={2} onManualEdit={vi.fn()} />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    rerender(
      <DiagramCanvas mermaidSource={'flowchart TD\nStart --> End'} revisionId={3} onManualEdit={vi.fn()} editorOpen />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByLabelText('Mermaid DSL').value).toBe('flowchart TD\nStart --> End');
    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^diagram-/), 'flowchart TD\nStart --> End');
  });

  it('renders source containing a Mermaid init directive with per-render style config', async () => {
    const source =
      '%%{init: {"theme":"dark","look":"neo","themeVariables":{},"flowchart":{"curve":"rounded"}}}%%\nflowchart TD\nA --> B';

    render(
      <DiagramCanvas
        mermaidSource={source}
        revisionId={1}
        onManualEdit={vi.fn()}
        editorOpen
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(initializeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        deterministicIds: true
      })
    );
    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^diagram-/), source);
  });

  it('zooms the renderer with touch pointer gestures', async () => {
    const { container } = render(<DiagramCanvas mermaidSource={'flowchart TD\nA --> B'} revisionId={1} />);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    const renderer = screen.getByLabelText(/Mermaid renderer/i);
    fireEvent.pointerDown(renderer, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
    fireEvent.pointerDown(renderer, { pointerId: 2, pointerType: 'touch', clientX: 100, clientY: 0 });
    fireEvent.pointerMove(renderer, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 0 });

    expect(container.querySelector('.diagram-viewport').style.transform).toContain('scale(2)');
  });

  it('reveals and selects editor range when a flowchart node is selected', async () => {
    const source = 'flowchart TD\n  B[Beta label]\n  A --> B';
    render(
      <DiagramCanvas
        mermaidSource={source}
        revisionId={1}
        editorOpen
        selectedNode={{ id: 'flowchart-B-0', label: 'Beta', dataId: 'B' }}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await act(async () => {});

    expect(editorHarness.revealRangeInCenter).toHaveBeenCalled();
    expect(editorHarness.setSelection).toHaveBeenCalled();
    expect(editorHarness.deltaDecorations).toHaveBeenCalled();
  });
});
