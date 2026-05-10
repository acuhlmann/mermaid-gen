// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const {
  fetchDiagramStateMock,
  syncClientDiagramStateMock,
  submitCoAuthorIntentMock,
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
    mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]\n  EndNode --> Surprise[Surprise path]',
    updatedAt: '2026-05-10T08:31:00.000Z'
  };
  return {
    fetchDiagramStateMock: vi.fn(),
    syncClientDiagramStateMock: vi.fn(),
    submitCoAuthorIntentMock: vi.fn(),
    initialState: initial,
    updatedState: updated
  };
});

vi.mock('@copilotkit/react-core', () => ({
  CopilotChat: () => <div data-testid="copilot-chat" />,
  CopilotKit: ({ children }) => <>{children}</>,
  useAgent: () => ({ agent: { isRunning: false } }),
  useCopilotAdditionalInstructions: vi.fn(),
  useCopilotChat: () => ({ isLoading: false })
}));

vi.mock('../src/components/DiagramCanvas.jsx', () => ({
  default: function DiagramCanvasMock({ mermaidSource, onManualEdit, revisionId }) {
    return (
      <section>
        <div>Revision {revisionId}</div>
        <pre data-testid="mermaid-source">{mermaidSource}</pre>
        <button type="button" onClick={() => onManualEdit('flowchart TD\n  Start[Start] --> Edited[Edited]')}>
          Mock edit
        </button>
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
  syncClientDiagramState: syncClientDiagramStateMock,
  submitCoAuthorIntent: submitCoAuthorIntentMock
}));

describe('App Surprise me flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchDiagramStateMock.mockResolvedValue(initialState);
    syncClientDiagramStateMock.mockImplementation(async ({ mermaidSource, styleConfig }) => ({
      ...initialState,
      revisionId: 1,
      mermaidSource,
      styleConfig: styleConfig ?? initialState.styleConfig
    }));
    submitCoAuthorIntentMock.mockResolvedValue({ state: updatedState });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  it('cancels pending editor sync and submits the latest source before co-author runs', async () => {
    render(<App />);

    await screen.findByText('Surprise me');
    fireEvent.click(screen.getByText('Mock edit'));
    fireEvent.click(screen.getByText('Surprise me'));

    await waitFor(() => expect(submitCoAuthorIntentMock).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(500);

    expect(syncClientDiagramStateMock).toHaveBeenCalledTimes(1);
    expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mermaidSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      })
    );
    expect(submitCoAuthorIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionId: 1,
        mermaidSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      })
    );
  });
});
