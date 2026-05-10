// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const {
  fetchDiagramStateMock,
  syncClientDiagramStateMock,
  submitDiagramIntentMock,
  streamDiagramAgentMock,
  initialState,
  updatedState
} = vi.hoisted(() => {
  const styleConfig = {
    theme: 'base',
    look: 'neo',
    themeVariables: {},
    themeCSS: '',
    flowchart: { curve: 'rounded' }
  };
  const initial = {
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    styleConfig,
    updatedAt: '2026-05-10T08:30:00.000Z',
    history: []
  };
  const updated = {
    ...initial,
    revisionId: 2,
    mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]\n  EndNode --> Extended[Extended path]',
    updatedAt: '2026-05-10T08:31:00.000Z'
  };
  return {
    fetchDiagramStateMock: vi.fn(),
    syncClientDiagramStateMock: vi.fn(),
    submitDiagramIntentMock: vi.fn(),
    streamDiagramAgentMock: vi.fn(),
    initialState: initial,
    updatedState: updated
  };
});

vi.mock('../src/components/DiagramCanvas.jsx', () => ({
  default: function DiagramCanvasMock({ mermaidSource, onManualEdit }) {
    return (
      <section>
        <pre data-testid="mermaid-source">{mermaidSource}</pre>
        <button type="button" onClick={() => onManualEdit('flowchart TD\n  Start[Start] --> Edited[Edited]')}>
          Mock edit
        </button>
      </section>
    );
  }
}));

vi.mock('../src/components/InsightsPane.jsx', () => ({
  default: function InsightsPaneMock() {
    return null;
  }
}));

vi.mock('../src/state/diagramStore.js', () => ({
  API_BASE_URL: '',
  SESSION_HEADER: 'x-session-id',
  fallbackState: initialState,
  fetchDiagramState: fetchDiagramStateMock,
  getOrCreateBrowserSessionId: () => 'test-session',
  syncClientDiagramState: syncClientDiagramStateMock,
  submitDiagramIntent: submitDiagramIntentMock,
  streamDiagramAgent: streamDiagramAgentMock
}));

describe('App simplified controls', () => {
  beforeEach(() => {
    fetchDiagramStateMock.mockResolvedValue(initialState);
    syncClientDiagramStateMock.mockImplementation(async ({ mermaidSource, styleConfig }) => ({
      ...initialState,
      revisionId: 1,
      mermaidSource,
      styleConfig: styleConfig ?? initialState.styleConfig
    }));
    submitDiagramIntentMock.mockResolvedValue({ state: updatedState });
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
      } else if (payload.operation === 'analyze') {
        onEvent?.({ type: 'token', text: 'Use clearer labels and simplify branching.' });
        onEvent?.({
          type: 'final',
          revisionChanged: false,
          analyzeText: 'Use clearer labels and simplify branching.'
        });
      } else {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Transformed.'
        });
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('cancels pending editor sync and streams transform after mock edit', async () => {
    render(<App />);

    const refineButton = await screen.findByRole('button', { name: 'Refine' });
    fireEvent.click(screen.getByText('Mock edit'));
    fireEvent.click(refineButton);

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(syncClientDiagramStateMock).toHaveBeenCalledTimes(1);
    expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mermaidSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      })
    );
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'transform',
        mode: 'refine',
        revisionId: 1,
        mermaidSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      }),
      expect.any(Function)
    );
  });

  it('streams intent when submitting the prompt control', async () => {
    render(<App />);

    const input = await screen.findByPlaceholderText('Set the Topic, Describe Your Change');
    fireEvent.change(input, { target: { value: 'Add a payment step' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());

    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'intent',
        prompt: 'Add a payment step',
        revisionId: 1,
        mermaidSource: initialState.mermaidSource
      }),
      expect.any(Function)
    );
  });

  it('shows Fix after critique and applies critique-driven intent', async () => {
    render(<App />);

    const critiqueButton = await screen.findByRole('button', { name: 'Critique' });
    fireEvent.click(critiqueButton);

    const fixButton = await screen.findByRole('button', { name: 'Fix' });
    fireEvent.click(fixButton);

    await waitFor(() =>
      expect(streamDiagramAgentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'intent',
          prompt: expect.stringContaining('Use clearer labels and simplify branching.')
        }),
        expect.any(Function)
      )
    );
  });
});
