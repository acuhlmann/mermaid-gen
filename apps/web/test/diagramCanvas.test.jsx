// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('@monaco-editor/react', () => ({
  default: function EditorMock({ value, onChange }) {
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
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders svg from initial source and updates when user edits', async () => {
    const onManualEdit = vi.fn();
    render(<DiagramCanvas mermaidSource={'flowchart TD\nA --> B'} revisionId={1} onManualEdit={onManualEdit} />);

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

    rerender(<DiagramCanvas mermaidSource={'flowchart TD\nStart --> End'} revisionId={3} onManualEdit={vi.fn()} />);

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
        styleConfig={{
          theme: 'dark',
          look: 'neo',
          themeVariables: {},
          themeCSS: '',
          flowchart: { curve: 'rounded' }
        }}
        revisionId={1}
        onManualEdit={vi.fn()}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(initializeMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        theme: 'dark',
        look: 'neo',
        flowchart: { curve: 'rounded' }
      })
    );
    expect(renderMock).toHaveBeenCalledWith(expect.stringMatching(/^diagram-/), source);
  });
});
