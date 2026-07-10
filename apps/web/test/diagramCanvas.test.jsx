// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiagramCanvas from '../src/components/DiagramCanvas.jsx';

const { renderMermaidSvgMock } = vi.hoisted(() => ({
  renderMermaidSvgMock: vi.fn(async (_id, source) => ({
    svg: `<svg viewBox="0 0 100 50"><text>${source}</text></svg>`,
    sanitizerApplied: []
  }))
}));

vi.mock('../src/utils/renderMermaidPreview.js', () => ({
  renderMermaidSvg: renderMermaidSvgMock,
  renderMermaidPreviewSvg: vi.fn()
}));

vi.mock('../src/utils/diagramViewportFit.js', () => ({
  measureViewportForDiagram: () => ({ x: 0, y: 0, scale: 1 }),
  computeFitViewport: vi.fn(),
  computeCenteredViewport: vi.fn(),
  readSvgLayoutSize: vi.fn(),
  readViewportInnerSize: vi.fn()
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
  default: function EditorMock({ value, onChange, beforeMount, onMount, language }) {
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
        data-language={language}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
}));

describe('DiagramCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    renderMermaidSvgMock.mockClear();
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
        diagramSource={'flowchart TD\nA --> B'}
        revisionId={1}
        onManualEdit={onManualEdit}
        editorOpen
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(renderMermaidSvgMock).toHaveBeenCalledWith(
      expect.stringMatching(/^diagram-/),
      'flowchart TD\nA --> B',
      expect.objectContaining({ htmlLabels: false })
    );

    fireEvent.change(screen.getByLabelText('Mermaid DSL'), {
      target: { value: 'flowchart TD\nA --> C' }
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onManualEdit).toHaveBeenCalledWith('flowchart TD\nA --> C');
    expect(renderMermaidSvgMock).toHaveBeenCalledWith(
      expect.stringMatching(/^diagram-/),
      'flowchart TD\nA --> C',
      expect.any(Object)
    );
  });

  it('re-syncs editor and renderer when a new agent source arrives', async () => {
    const { rerender } = render(
      <DiagramCanvas
        diagramSource={'flowchart TD\nStart --> Mid'}
        revisionId={2}
        onManualEdit={vi.fn()}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    rerender(
      <DiagramCanvas
        diagramSource={'flowchart TD\nStart --> End'}
        revisionId={3}
        onManualEdit={vi.fn()}
        editorOpen
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByLabelText('Mermaid DSL').value).toBe('flowchart TD\nStart --> End');
    expect(renderMermaidSvgMock).toHaveBeenCalledWith(
      expect.stringMatching(/^diagram-/),
      'flowchart TD\nStart --> End',
      expect.any(Object)
    );
  });

  it('renders source containing a Mermaid init directive with per-render style config', async () => {
    const source =
      '%%{init: {"theme":"dark","look":"neo","themeVariables":{},"flowchart":{"curve":"rounded"}}}%%\nflowchart TD\nA --> B';

    render(
      <DiagramCanvas diagramSource={source} revisionId={1} onManualEdit={vi.fn()} editorOpen />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(renderMermaidSvgMock).toHaveBeenCalledWith(
      expect.stringMatching(/^diagram-/),
      source,
      expect.objectContaining({
        deterministicIds: true,
        htmlLabels: false
      })
    );
  });

  it('renders mermaid while streamingPreview is active', async () => {
    render(
      <DiagramCanvas diagramSource={'flowchart TD\nA --> B'} revisionId={1} streamingPreview />
    );

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(renderMermaidSvgMock).toHaveBeenCalled();
    expect(document.querySelector('.diagram-zoom-layer svg')).toBeTruthy();
  });

  it('zooms the renderer with touch pointer gestures', async () => {
    const { container } = render(
      <DiagramCanvas diagramSource={'flowchart TD\nA --> B'} revisionId={1} />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    const renderer = screen.getByLabelText(/Mermaid renderer/i);
    fireEvent.pointerDown(renderer, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
    fireEvent.pointerDown(renderer, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 0
    });
    fireEvent.pointerMove(renderer, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 200,
      clientY: 0
    });

    expect(container.querySelector('.diagram-zoom-layer').style.transform).toContain('scale(2)');
  });

  it('calls onPanGestureStart when drag exceeds tap threshold', async () => {
    const onPanGestureStart = vi.fn();
    render(
      <DiagramCanvas
        diagramSource={'flowchart TD\nA --> B'}
        revisionId={1}
        onPanGestureStart={onPanGestureStart}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    const renderer = screen.getByLabelText(/Mermaid renderer/i);
    fireEvent.pointerDown(renderer, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10
    });
    fireEvent.pointerMove(renderer, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 40,
      clientY: 40
    });

    expect(onPanGestureStart).toHaveBeenCalledTimes(1);
  });

  it('selects timeline diagram nodes on tap', async () => {
    const timelineSvg = `
<svg viewBox="0 0 400 200">
  <g class="timeline-node section-0">
    <g>
      <path id="diagram-1-node-0" class="node-bkg" d="M0 0 h150 v40 H0 Z" />
    </g>
    <g>
      <text><tspan x="75" y="20">Dev Types</tspan></text>
    </g>
  </g>
</svg>`;
    renderMermaidSvgMock.mockResolvedValueOnce({ svg: timelineSvg, sanitizerApplied: [] });

    const onSelectedNodeChange = vi.fn();
    render(
      <DiagramCanvas
        diagramSource={'timeline\n  title T\n  section S\n    Dev : Monolith : DB'}
        revisionId={1}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await act(async () => {});

    const renderer = screen.getByLabelText(/Mermaid renderer/i);
    const path = renderer.querySelector('path.node-bkg');
    expect(path).toBeTruthy();
    const pointerInit = {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 40,
      clientY: 20,
      bubbles: true
    };
    path.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
    path.dispatchEvent(new PointerEvent('pointerup', pointerInit));

    expect(onSelectedNodeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'diagram-1-node-0',
        partKind: 'timeline',
        partName: 'Dev Types'
      })
    );
  });

  it('selects sequence diagram participants on tap', async () => {
    const sequenceSvg = `
<svg viewBox="0 0 200 100">
  <g>
    <line data-et="life-line" data-id="Ingestion" class="actor-line" />
    <g data-et="participant" data-type="participant" data-id="Ingestion" id="root-1">
      <rect class="actor actor-top" width="80" height="40" />
      <text class="actor actor-box">Ingestion</text>
    </g>
  </g>
</svg>`;
    renderMermaidSvgMock.mockResolvedValueOnce({ svg: sequenceSvg, sanitizerApplied: [] });

    const onSelectedNodeChange = vi.fn();
    render(
      <DiagramCanvas
        diagramSource={'sequenceDiagram\n  participant Ingestion\n  Ingestion ->> Validation: hi'}
        revisionId={1}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await act(async () => {});

    const renderer = screen.getByLabelText(/Mermaid renderer/i);
    const rect = renderer.querySelector('rect.actor-top');
    expect(rect).toBeTruthy();
    const pointerInit = {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 40,
      clientY: 20,
      bubbles: true
    };
    rect.dispatchEvent(new PointerEvent('pointerdown', pointerInit));
    rect.dispatchEvent(new PointerEvent('pointerup', pointerInit));

    expect(onSelectedNodeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        dataId: 'Ingestion',
        partKind: 'participant',
        partName: 'Ingestion'
      })
    );
  });

  it('does not report toolbar anchor for hover without selection', async () => {
    const nodeSvg =
      '<svg><g class="node" id="flowchart-A-0"><rect width="40" height="20"/><text>A</text></g></svg>';
    renderMermaidSvgMock.mockResolvedValueOnce({ svg: nodeSvg, sanitizerApplied: [] });

    const onNodeToolbarAnchor = vi.fn();
    const hoverDescriptor = {
      id: 'flowchart-A-0',
      label: 'A',
      partKind: 'node',
      partName: 'A'
    };

    render(
      <DiagramCanvas
        diagramSource={'flowchart TD\nA'}
        revisionId={1}
        hoverDescriptor={hoverDescriptor}
        onNodeToolbarAnchor={onNodeToolbarAnchor}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    await act(async () => {});

    const anchored = onNodeToolbarAnchor.mock.calls.some(
      ([arg]) => arg && typeof arg.left === 'number' && arg.nodeId === 'flowchart-A-0'
    );
    expect(anchored).toBe(false);
  });

  it('reveals and selects editor range when a flowchart node is selected', async () => {
    const source = 'flowchart TD\n  B[Beta label]\n  A --> B';
    render(
      <DiagramCanvas
        diagramSource={source}
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

  it('uses Monaco with mode-specific language on narrow layout', async () => {
    const listeners = new Map();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(max-width: 1024px)',
      media: query,
      addEventListener: (event, handler) => {
        listeners.set(event, handler);
      },
      removeEventListener: (event, handler) => {
        if (listeners.get(event) === handler) listeners.delete(event);
      }
    }));

    const { rerender } = render(
      <DiagramCanvas
        diagramSource={'{"mark":"bar"}'}
        contentType="chart"
        revisionId={1}
        editorOpen
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByLabelText('Mermaid DSL').getAttribute('data-language')).toBe('json');
    expect(screen.getByText('Chart DSL')).toBeTruthy();

    rerender(
      <DiagramCanvas
        diagramSource={'<div>hello</div>'}
        contentType="anything"
        revisionId={1}
        editorOpen
      />
    );

    expect(screen.getByLabelText('Mermaid DSL').getAttribute('data-language')).toBe('html');
    expect(screen.getByText('HTML')).toBeTruthy();
  });
});
