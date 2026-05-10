// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';

const {
  fetchDiagramStateMock,
  syncClientDiagramStateMock,
  submitCoAuthorIntentMock,
  submitDiagramIntentMock,
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
    submitDiagramIntentMock: vi.fn(),
    initialState: initial,
    updatedState: updated
  };
});

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
  syncClientDiagramState: syncClientDiagramStateMock,
  submitCoAuthorIntent: submitCoAuthorIntentMock,
  submitDiagramIntent: submitDiagramIntentMock
}));

describe('App flows', () => {
  beforeEach(() => {
    fetchDiagramStateMock.mockResolvedValue(initialState);
    syncClientDiagramStateMock.mockImplementation(async ({ mermaidSource, styleConfig }) => ({
      ...initialState,
      revisionId: 1,
      mermaidSource,
      styleConfig: styleConfig ?? initialState.styleConfig
    }));
    submitCoAuthorIntentMock.mockResolvedValue({ state: updatedState });
    submitDiagramIntentMock.mockResolvedValue({
      state: {
        ...initialState,
        revisionId: 3,
        mermaidSource: 'flowchart TD\n  Patched[Patched] --> End[End]'
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('cancels pending editor sync and submits the latest source before co-author runs', async () => {
    render(<App />);

    const surpriseButton = await screen.findByRole('button', { name: 'Surprise me' });
    fireEvent.click(screen.getByText('Mock edit'));
    fireEvent.click(surpriseButton);

    await waitFor(() => expect(submitCoAuthorIntentMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 500));

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

  it('submits describe-change intent from the bottom bar', async () => {
    render(<App />);

    const input = await screen.findByPlaceholderText('Describe your Change');
    fireEvent.change(input, { target: { value: 'Add a feedback loop node' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(submitDiagramIntentMock).toHaveBeenCalled());
    expect(submitDiagramIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Add a feedback loop node',
        revisionId: 1
      })
    );
  });
});
