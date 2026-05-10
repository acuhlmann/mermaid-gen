// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const {
  fetchDiagramStateMock,
  syncClientDiagramStateMock,
  submitDiagramIntentMock,
  streamDiagramAgentMock,
  readDiagramCacheMock,
  writeDiagramCacheMock,
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
    readDiagramCacheMock: vi.fn(),
    writeDiagramCacheMock: vi.fn(),
    initialState: initial,
    updatedState: updated
  };
});

vi.mock('../src/components/DiagramCanvas.jsx', () => ({
  default: function DiagramCanvasMock({ mermaidSource, onManualEdit, insightsSlot }) {
    return (
      <section>
        <pre data-testid="mermaid-source">{mermaidSource}</pre>
        <button type="button" onClick={() => onManualEdit('flowchart TD\n  Start[Start] --> Edited[Edited]')}>
          Mock edit
        </button>
        {insightsSlot}
      </section>
    );
  }
}));

vi.mock('../src/state/diagramStore.js', () => ({
  API_BASE_URL: '',
  SESSION_HEADER: 'x-session-id',
  fallbackState: initialState,
  fetchDiagramState: fetchDiagramStateMock,
  getOrCreateBrowserSessionId: () => 'test-session',
  readDiagramCache: readDiagramCacheMock,
  syncClientDiagramState: syncClientDiagramStateMock,
  submitDiagramIntent: submitDiagramIntentMock,
  streamDiagramAgent: streamDiagramAgentMock,
  writeDiagramCache: writeDiagramCacheMock
}));

describe('App simplified controls', () => {
  beforeEach(() => {
    const oscillator = {
      type: 'triangle',
      frequency: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
    const gainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };
    const audioContext = {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gainNode)
    };
    globalThis.AudioContext = vi.fn(function MockAudioContext() {
      return audioContext;
    });

    readDiagramCacheMock.mockReturnValue(null);
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
        onEvent?.({ type: 'status', text: 'Working on change request...' });
        onEvent?.({ type: 'tool_start', name: 'get_diagram_state' });
        onEvent?.({ type: 'tool_end', name: 'get_diagram_state' });
        onEvent?.({ type: 'tool_start', name: 'apply_mermaid_patch' });
        onEvent?.({ type: 'tool_end', name: 'apply_mermaid_patch' });
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
    delete globalThis.AudioContext;
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
        mermaidSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]',
        modelProfile: 'fast'
      }),
      expect.any(Function)
    );
  });

  it(
    'Thinking segment undo syncs baseline mermaid source after Refine',
    async () => {
      render(<App />);
      fireEvent.click(await screen.findByRole('button', { name: 'Show Thinking' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Refine' }));

      await screen.findByRole('button', { name: 'Undo diagram change' });

      const callsBefore = syncClientDiagramStateMock.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Undo diagram change' }));

      await waitFor(() => expect(syncClientDiagramStateMock.mock.calls.length).toBeGreaterThan(callsBefore));
      const lastPayload = syncClientDiagramStateMock.mock.calls.at(-1)[0];
      expect(lastPayload.mermaidSource).toBe(initialState.mermaidSource);
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Undo diagram change' })).toBeNull()
      );
    },
    15_000
  );

  it('streams intent when submitting the prompt control', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show Thinking' }));

    const input = await screen.findByPlaceholderText('Set the Topic, Describe Your Change');
    fireEvent.change(input, { target: { value: 'Add a payment step' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());

    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'intent',
        prompt: 'Add a payment step',
        revisionId: 1,
        mermaidSource: initialState.mermaidSource,
        modelProfile: 'fast'
      }),
      expect.any(Function)
    );
    await screen.findByText('Read diagram snapshot');
    await screen.findByText('Apply diagram update');
    await screen.findByText('Done');
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
          prompt: expect.stringContaining('Use clearer labels and simplify branching.'),
          modelProfile: 'fast'
        }),
        expect.any(Function)
      )
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fix' })).toBeNull());
  });

  it('Fix selected sends only checked actionable improvements', async () => {
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent') {
        onEvent?.({ type: 'final', revisionChanged: true, state: updatedState, message: 'Applied.' });
      } else if (payload.operation === 'analyze') {
        const analyzeBody =
          '## Summary\n\nOk.\n\n## Actionable improvements\n\n- Keep this change\n- Skip this change\n';
        onEvent?.({ type: 'token', text: analyzeBody });
        onEvent?.({ type: 'final', revisionChanged: false, analyzeText: analyzeBody });
      } else {
        onEvent?.({ type: 'final', revisionChanged: true, state: updatedState, message: 'Transformed.' });
      }
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Critique' }));

    const keepBox = await screen.findByRole('checkbox', { name: /Keep this change/i });
    fireEvent.click(keepBox);

    fireEvent.click(screen.getByRole('button', { name: 'Fix selected' }));

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter((c) => c[0]?.operation === 'intent');
      expect(intentCalls.length).toBeGreaterThan(0);
      const prompt = intentCalls[intentCalls.length - 1][0].prompt;
      expect(prompt).toContain('Keep this change');
      expect(prompt).not.toContain('Skip this change');
    });
  });

  it('plays a completion sound when a request finishes', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show Thinking' }));

    const input = await screen.findByPlaceholderText('Set the Topic, Describe Your Change');
    fireEvent.change(input, { target: { value: 'Tighten wording' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(globalThis.AudioContext).toHaveBeenCalled());
  });

  it('clears to an empty diagram instead of seeded sample', async () => {
    render(<App />);
    const clearButton = await screen.findByRole('button', { name: 'Clear' });
    fireEvent.click(clearButton);

    await waitFor(() =>
      expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          mermaidSource: ''
        })
      )
    );
  });

  it('hydrates diagram source from local cache on load', async () => {
    readDiagramCacheMock.mockReturnValue({
      mermaidSource: 'flowchart TD\n  CachedA[Cached] --> CachedB[State]'
    });

    render(<App />);

    const source = await screen.findByTestId('mermaid-source');
    expect(source.textContent).toContain('CachedA[Cached]');
  });

  it('sends quality modelProfile after selecting Quality', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Quality' }));

    const refineButton = await screen.findByRole('button', { name: 'Refine' });
    fireEvent.click(refineButton);

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'transform',
        modelProfile: 'quality'
      }),
      expect.any(Function)
    );
  });
});
