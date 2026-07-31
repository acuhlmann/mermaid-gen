// @vitest-environment jsdom
import { createInitialDiagramState, buildFormsSeedDoc } from '@archislop/shared';
import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { setDeskSlotElement } from '../src/state/deskSlotStore.js';

const {
  fetchSessionDiagramStateMock,
  mintFreshServerSessionMock,
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
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
    styleConfig,
    updatedAt: '2026-05-10T08:30:00.000Z',
    history: [],
    lastUserPrompt: null
  };
  const updated = {
    ...initial,
    revisionId: 2,
    diagramSource:
      'flowchart TD\n  Start[Start] --> EndNode[End]\n  EndNode --> Extended[Extended path]',
    updatedAt: '2026-05-10T08:31:00.000Z'
  };
  return {
    fetchSessionDiagramStateMock: vi.fn(),
    mintFreshServerSessionMock: vi.fn(),
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
  default: function DiagramCanvasMock({ diagramSource, onManualEdit, insightsSlot }) {
    return (
      <section>
        <pre data-testid="mermaid-source">{diagramSource}</pre>
        <button
          type="button"
          onClick={() => onManualEdit('flowchart TD\n  Start[Start] --> Edited[Edited]')}
        >
          Mock edit
        </button>
        {insightsSlot}
      </section>
    );
  }
}));

vi.mock('../src/state/diagramSession.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createSessionId: () => 'generated-session',
    getOrCreateBrowserSessionId: () => 'test-session'
  };
});

vi.mock('../src/state/diagramStore.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    API_BASE_URL: '',
    SESSION_HEADER: 'x-session-id',
    createSessionId: () => 'generated-session',
    fallbackState: initialState,
    fetchSessionDiagramState: fetchSessionDiagramStateMock,
    mintFreshServerSession: mintFreshServerSessionMock,
    getOrCreateBrowserSessionId: () => 'test-session',
    normalizeSessionId: (value) => {
      const candidate = typeof value === 'string' ? value.trim() : '';
      if (!candidate) return null;
      return candidate.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 128) || null;
    },
    readDiagramCache: readDiagramCacheMock,
    syncClientDiagramState: syncClientDiagramStateMock,
    submitDiagramIntent: submitDiagramIntentMock,
    streamDiagramAgent: streamDiagramAgentMock,
    writeDiagramCache: writeDiagramCacheMock
  };
});

// Both engineer seats render the same action label ("Refine"), so the row is
// addressed by persona name rather than by accessible button name. Since slice 3
// a roster row is a *group* of two gestures — the name/face addresses (lane 2),
// the chip delegates — so this returns the delegate chip specifically.
async function waitForControlsReady(personaName = 'Bertram Gilfoyle') {
  let chip;
  await waitFor(() => {
    const group = screen.getByText(personaName).closest('.stakeholders-roster-row');
    chip = group?.querySelector('[data-testid^="stakeholders-delegate-"]');
    expect(chip).toBeTruthy();
    expect(chip.disabled).toBe(false);
  });
  return chip;
}

async function clickRefine() {
  const row = await waitForControlsReady();
  fireEvent.click(row);
}

// Slice 2: Deliverable format and Shredder moved off the desk row into the
// parody-OS menu bar (`DeskOsMenuBar`).
function openDeliverableMenu() {
  const trigger = screen.getByTestId('desk-os-menu-trigger-deliverable');
  if (trigger.getAttribute('aria-expanded') === 'true') return;
  fireEvent.click(trigger);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickContentMode(modeLabel) {
  openDeliverableMenu();
  // Menu rows show the human label plus a tech subtitle (e.g. "Diagram" + "Mermaid").
  fireEvent.click(
    screen.getByRole('menuitem', {
      name: new RegExp(`^${escapeRegExp(modeLabel)}`, 'i')
    })
  );
}

describe('App simplified controls', { timeout: 20_000 }, () => {
  beforeEach(() => {
    // Full-suite pre-push runs can starve jsdom; RTL defaults (1s) flake under load.
    configure({ asyncUtilTimeout: 10_000 });
    vi.useRealTimers();
    window.localStorage.clear();
    setDeskSlotElement(null);
    window.localStorage.setItem('archislop:office-directory-seen', '1');
    window.localStorage.setItem('archislop:mode-reveal-seen', '1');
    // Most integration tests assume a concrete slot with server-backed diagram state.
    window.localStorage.setItem('archislop:content-mode', 'mermaid');
    window.history.replaceState({}, '', '/');
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
    mintFreshServerSessionMock.mockResolvedValue('fresh-recovered-session');
    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: initialState,
      infographic: createInitialDiagramState('infographic')
    });
    syncClientDiagramStateMock.mockImplementation(async ({ diagramSource, styleConfig }) => ({
      ...initialState,
      revisionId: 1,
      diagramSource,
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

    // Resolve the seat BEFORE the edit: the pending sync is only cancellable if
    // the transform click lands before the editor debounce fires.
    const refineButton = await waitForControlsReady();
    fireEvent.click(screen.getByText('Mock edit'));
    fireEvent.click(refineButton);

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(syncClientDiagramStateMock).toHaveBeenCalledTimes(1);
    expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        diagramSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      })
    );
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'transform',
        mode: 'gilfoyle',
        revisionId: 1,
        diagramSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]',
        modelProfile: 'fast'
      }),
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('creates a shareable URL session on first visit and fetches server state with it', async () => {
    render(<App />);

    await waitFor(() => expect(fetchSessionDiagramStateMock).toHaveBeenCalled());

    expect(window.location.pathname).toBe('/sessions/generated-session');
    expect(fetchSessionDiagramStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'generated-session'
      })
    );
  });

  it('rotates to a fresh session and clears storage when the URL session is gone on the server', async () => {
    window.history.replaceState({}, '', '/sessions/stale-before-restart');
    window.localStorage.setItem(
      'archislop:diagram-cache-v2:stale-before-restart',
      JSON.stringify({ diagramSource: 'flowchart TD\n  A --> B', insightsEntries: [{ id: 'i1' }] })
    );
    window.localStorage.setItem('archislop:model-profile', 'quality');
    const notFound = new Error('Session not found');
    notFound.code = 'SESSION_NOT_FOUND';
    fetchSessionDiagramStateMock.mockRejectedValueOnce(notFound);

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/sessions/fresh-recovered-session');
    });
    expect(mintFreshServerSessionMock).toHaveBeenCalled();
  });

  it('treats a pristine server room plus stale local cache as a lost URL session', async () => {
    window.history.replaceState({}, '', '/sessions/phantom-room');
    readDiagramCacheMock.mockImplementation((sessionId) =>
      sessionId === 'phantom-room'
        ? { diagramSource: 'flowchart TD\n  A --> B', insightsEntries: [{ id: 'i1' }] }
        : null
    );
    fetchSessionDiagramStateMock.mockResolvedValueOnce({
      activeContentType: 'mermaid',
      mermaid: { ...createInitialDiagramState('mermaid') },
      infographic: createInitialDiagramState('infographic')
    });

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/sessions/fresh-recovered-session');
    });
    expect(mintFreshServerSessionMock).toHaveBeenCalled();
  });

  it('uses an existing URL session id for sync and stream calls', async () => {
    window.history.replaceState({}, '', '/sessions/shared-room-1');

    render(<App />);
    const refineButton = await waitForControlsReady();
    fireEvent.click(screen.getByText('Mock edit'));
    fireEvent.click(refineButton);

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());

    expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'shared-room-1',
        diagramSource: 'flowchart TD\n  Start[Start] --> Edited[Edited]'
      })
    );
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Function),
      expect.objectContaining({ sessionId: 'shared-room-1' })
    );
  });

  it("Thinking segment Restore re-syncs the entry's after-snapshot to the canvas", async () => {
    render(<App />);
    await clickRefine();

    await screen.findByRole('button', { name: 'Restore' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const callsBefore = syncClientDiagramStateMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(syncClientDiagramStateMock.mock.calls.length).toBeGreaterThan(callsBefore)
    );
    // Restore now jumps to the entry's after-source (the snapshot rendered in its preview),
    // not the baseline. We just assert the call happened with a diagramSource string — the
    // exact source depends on the streamed final state captured during the test.
    const lastPayload = syncClientDiagramStateMock.mock.calls.at(-1)[0];
    expect(typeof lastPayload.diagramSource).toBe('string');
    // Restore stays available so the user can re-jump to this version anytime.
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
  }, 15_000);

  it("Thinking segment Restore re-syncs a forms entry's after-snapshot to the canvas", async () => {
    const formsDoc = buildFormsSeedDoc();
    const formsUpdatedDoc = formsDoc.replace('Form 0-A', 'Form 0-B');
    const formsBaseline = {
      ...createInitialDiagramState('forms'),
      revisionId: 1,
      diagramSource: formsDoc
    };
    const formsUpdated = {
      ...formsBaseline,
      contentType: 'forms',
      revisionId: 2,
      diagramSource: formsUpdatedDoc,
      updatedAt: '2026-05-10T08:31:00.000Z'
    };

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'forms',
      mermaid: initialState,
      infographic: createInitialDiagramState('infographic'),
      forms: formsBaseline
    });
    syncClientDiagramStateMock.mockImplementation(async (payload) => ({
      ...formsUpdated,
      ...payload,
      contentType: payload.contentType ?? 'forms'
    }));
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'transform' || payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: formsUpdated,
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    pickContentMode('Forms');
    await clickRefine();

    await screen.findByRole('button', { name: 'Restore' });
    const callsBefore = syncClientDiagramStateMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(syncClientDiagramStateMock.mock.calls.length).toBeGreaterThan(callsBefore)
    );
    const lastPayload = syncClientDiagramStateMock.mock.calls.at(-1)[0];
    expect(lastPayload.contentType).toBe('forms');
    expect(lastPayload.diagramSource).toBe(formsUpdatedDoc);
  }, 15_000);

  it('streams intent when submitting the prompt control', async () => {
    // Empty canvas uses the real Work order after the first-run desk intro is seen.
    window.localStorage.setItem('archislop:entry-desk-intro-seen', '1');
    // Prompt input is only shown when no diagram is set (initial topic-setting state).
    fetchSessionDiagramStateMock.mockResolvedValueOnce({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });

    render(<App />);

    await screen.findByLabelText(/Work order/i);
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-archislop-app-ready')).toBe('true');
      expect(screen.getByTestId('desk-os-menubar')).toBeTruthy();
    });
    const input = screen.getByLabelText(/Work order/i);
    fireEvent.change(input, { target: { value: 'Add a payment step' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.submit(screen.getByLabelText(/Work order/i).closest('form'));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());

    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'intent',
        prompt: 'Add a payment step',
        revisionId: 1,
        diagramSource: '',
        modelProfile: 'fast'
      }),
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    await screen.findByText('Read diagram snapshot');
    await screen.findByText('Apply diagram update');
    await screen.findAllByText('Done');
  });

  it('streams intent from the first-run desk work order on an empty canvas', async () => {
    window.localStorage.setItem('archislop:mode-reveal-seen', '1');
    window.localStorage.setItem('archislop:entry-desk-intro-seen', '1');
    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });

    render(<App />);

    await waitFor(
      () => {
        expect(screen.getByLabelText(/Work order/i)).toBeTruthy();
        expect(screen.getByTestId('bottom-brand-mark')).toBeTruthy();
        expect(screen.getByTestId('desk-os-menubar')).toBeTruthy();
      },
      { timeout: 6_000 }
    );
    expect(screen.queryByTestId('entry-desk-intro')).toBeNull();
    expect(screen.queryByTestId('topic-starters')).toBeNull();
    expect(screen.queryByTestId('entry-render-as')).toBeNull();
    expect(screen.getByTestId('bottom-brand-mark').getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /Open your team|Hide team actions/i })).toBeTruthy();

    const input = screen.getByLabelText(/Work order/i);
    fireEvent.change(input, { target: { value: 'Break down the global coffee supply chain' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.submit(screen.getByLabelText(/Work order/i).closest('form'));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'intent',
        prompt: 'Break down the global coffee supply chain'
      }),
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('shows Fix after critique with actionable items and applies critique-driven intent', async () => {
    // Full-suite CI runs can starve this one past the describe's 20s ceiling
    // (see 447a057) — give it its own explicit headroom.
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
      } else if (payload.operation === 'analyze') {
        const analyzeBody =
          '## Summary\n\nOk.\n\n## Actionable improvements\n\n- Use clearer labels and simplify branching.\n';
        onEvent?.({ type: 'token', text: analyzeBody });
        onEvent?.({ type: 'final', revisionChanged: false, analyzeText: analyzeBody });
      } else {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Transformed.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady('Jared Dunn');

    const critiqueButton = await screen.findByRole('menuitem', {
      name: /Delegate to .* Critique/i
    });
    fireEvent.click(critiqueButton);

    // Fix left the desk chrome with the Desk tray; the Notebook checklist is its
    // home until slice 3 re-homes it beside Jared, whose critique it acts on.
    // It appears once critique text exists but stays disabled until actionable
    // bullets are parsed and the agent is idle.
    await screen.findByRole('checkbox', {
      name: /Use clearer labels and simplify branching/i
    });
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: /Delegate to .* Critique/i }).disabled).toBe(
        false
      );
    });

    const fixButton = await screen.findByRole('button', { name: 'Fix all' });
    await waitFor(() => expect(fixButton.disabled).toBe(false));
    fireEvent.click(fixButton);

    await waitFor(
      () =>
        expect(streamDiagramAgentMock).toHaveBeenCalledWith(
          expect.objectContaining({
            operation: 'intent',
            prompt: expect.stringContaining('Use clearer labels and simplify branching.'),
            modelProfile: 'fast'
          }),
          expect.any(Function),
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        ),
      { timeout: 25_000 }
    );
    // With the critique consumed, the checklist's Fix affordance goes away.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Fix all' })).toBeNull());
  }, 30_000);

  it('Fix selected sends only checked actionable improvements', async () => {
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
      } else if (payload.operation === 'analyze') {
        const analyzeBody =
          '## Summary\n\nOk.\n\n## Actionable improvements\n\n- Keep this change\n- Skip this change\n';
        onEvent?.({ type: 'token', text: analyzeBody });
        onEvent?.({ type: 'final', revisionChanged: false, analyzeText: analyzeBody });
      } else {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Transformed.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady('Jared Dunn');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delegate to .* Critique/i }));

    const keepBox = await screen.findByRole('checkbox', { name: /Keep this change/i });
    fireEvent.click(keepBox);

    fireEvent.click(screen.getByRole('button', { name: 'Fix selected' }));

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter(
        (c) => c[0]?.operation === 'intent'
      );
      expect(intentCalls.length).toBeGreaterThan(0);
      const prompt = intentCalls[intentCalls.length - 1][0].prompt;
      expect(prompt).toContain('Keep this change');
      expect(prompt).not.toContain('Skip this change');
    });
  });

  it('shows actionable checkboxes when critique final has analyzeText but no token stream', async () => {
    const analyzeBody = '## Summary\n\nOk.\n\n## Actionable improvements\n\n- Alpha\n- Beta\n';
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'analyze') {
        onEvent?.({ type: 'final', revisionChanged: false, analyzeText: analyzeBody });
      } else {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady('Jared Dunn');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delegate to .* Critique/i }));

    const keepBox = await screen.findByRole('checkbox', { name: /Alpha/i });
    expect(keepBox).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Beta/i })).toBeTruthy();
  });

  it('plays a completion sound when a request finishes', async () => {
    window.localStorage.setItem('archislop:entry-desk-intro-seen', '1');
    // Prompt input is only shown when no diagram is set (initial topic-setting state).
    fetchSessionDiagramStateMock.mockResolvedValueOnce({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });

    render(<App />);

    await screen.findByLabelText(/Work order/i);
    await waitFor(() => {
      expect(screen.getByTestId('desk-os-menubar')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText(/Work order/i), {
      target: { value: 'Tighten wording' }
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));

    await waitFor(() => expect(globalThis.AudioContext).toHaveBeenCalled());
  });

  it('clears to an empty diagram instead of seeded sample', async () => {
    window.localStorage.setItem('archislop:entry-desk-intro-seen', '1');
    render(<App />);
    await waitForControlsReady();
    // Shredder lives on the menu bar's Deliverable menu now.
    openDeliverableMenu();
    const clearButton = await screen.findByRole('menuitem', { name: 'Shredder' });
    fireEvent.click(clearButton);

    // Clear now opens a "demolition" confirmation overlay first — click through to
    // actually wipe the diagram.
    const demolishButton = await screen.findByRole('button', { name: 'Demolish it' });
    fireEvent.click(demolishButton);

    await waitFor(() =>
      expect(syncClientDiagramStateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          diagramSource: ''
        })
      )
    );

    await waitFor(() => expect(screen.getByTestId('entry-example')).toBeTruthy());
    expect(screen.queryByTestId('topic-starters')).toBeNull();
    expect(screen.getByLabelText(/Work order/i)).toBeTruthy();
  });

  it('does not let cached diagram source override URL session server state on load', async () => {
    readDiagramCacheMock.mockReturnValue({
      diagramSource: 'flowchart TD\n  CachedA[Cached] --> CachedB[State]'
    });

    render(<App />);

    const source = await screen.findByTestId('mermaid-source');
    await waitFor(() => expect(fetchSessionDiagramStateMock).toHaveBeenCalled());
    expect(source.textContent).toContain('Start[Start]');
    expect(source.textContent).not.toContain('CachedA[Cached]');
  });

  it('sends quality modelProfile after selecting Deep work', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /Your desk/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Deep work' }));

    await clickRefine();

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'transform',
        modelProfile: 'quality'
      }),
      expect.any(Function),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('Stop request aborts the agent stream and marks insight stopped', async () => {
    streamDiagramAgentMock.mockImplementation((_payload, _onEvent, opts) => {
      return new Promise((_resolve, reject) => {
        if (opts?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        opts.signal.addEventListener(
          'abort',
          () => {
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      });
    });

    // Prompt input is only shown when no diagram is set (initial topic-setting state).
    window.localStorage.setItem('archislop:entry-desk-intro-seen', '1');
    fetchSessionDiagramStateMock.mockResolvedValueOnce({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });

    render(<App />);

    await screen.findByLabelText(/Work order/i);
    await waitFor(() => {
      expect(screen.getByTestId('desk-os-menubar')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText(/Work order/i), {
      target: { value: 'Long request' }
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Do it' }).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Stop request' }));

    await waitFor(() => {
      expect(document.querySelector('.insights-entry.is-cancelled')).not.toBeNull();
    });
    expect(screen.getByText('Stopped')).toBeTruthy();
  });

  it('marks transform as failed when stream ends without a diagram revision', async () => {
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'transform') {
        onEvent?.({
          type: 'error',
          code: 'no_mutation_revision',
          message: 'The diagram was not updated—no valid patch was applied.'
        });
        onEvent?.({ type: 'final', revisionChanged: false, message: 'Model reply only.' });
        return;
      }
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
        return;
      }
      if (payload.operation === 'analyze') {
        onEvent?.({ type: 'final', revisionChanged: false, analyzeText: 'ok' });
      }
    });

    render(<App />);
    await clickRefine();

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalled());
    await screen.findByText(/No diagram patch was applied/i);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('auto-closes Thinking on mobile after Refine applies a diagram revision', async () => {
    // Full-suite runs can exceed the default 5s when many App tests share one worker.
    readDiagramCacheMock.mockReturnValue({
      insightsEntries: [
        {
          id: 'legacy-entry-without-status',
          title: 'Legacy note',
          content: 'Cached before status was persisted.'
        }
      ]
    });
    const previousMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('639px') && query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    syncClientDiagramStateMock.mockImplementation(async () => ({ ...updatedState }));

    let finishStream;
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation !== 'transform') return;
      onEvent?.({ type: 'status', text: 'Working on change request...' });
      await new Promise((resolve) => {
        finishStream = () => {
          onEvent?.({
            type: 'final',
            revisionChanged: true,
            state: updatedState,
            message: 'Transformed.'
          });
          resolve();
        };
      });
    });

    try {
      render(<App />);
      await waitFor(() => expect(screen.getByTestId('desk-notebook-button')).toBeTruthy());
      const notebookBtn = screen.getByTestId('desk-notebook-button');
      expect(notebookBtn.disabled).toBe(false);
      fireEvent.click(notebookBtn);
      await waitFor(() =>
        expect(document.querySelector('.app-shell')?.className).toContain('is-insights-open')
      );

      await clickRefine();
      await waitFor(() =>
        expect(document.querySelector('.insights-entry.is-running')).not.toBeNull()
      );

      await act(async () => {
        finishStream();
      });

      await waitFor(
        () => {
          expect(document.querySelector('.insights-entry.is-running')).toBeNull();
          expect(document.querySelector('.app-shell')?.className).not.toContain('is-insights-open');
        },
        { timeout: 5000 }
      );
    } finally {
      globalThis.matchMedia = previousMatchMedia;
    }
  }, 15000);

  it('retries a failed transform from the insight card', async () => {
    let transformCalls = 0;
    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'transform') {
        transformCalls += 1;
        if (transformCalls === 1) {
          onEvent?.({
            type: 'error',
            code: 'no_mutation_revision',
            message: 'The diagram was not updated—no valid patch was applied.'
          });
          onEvent?.({ type: 'final', revisionChanged: false, message: 'Model reply only.' });
          return;
        }
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
        return;
      }
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: updatedState,
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    await clickRefine();

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalledTimes(1));
    await screen.findByText(/No diagram patch was applied/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(streamDiagramAgentMock).toHaveBeenCalledTimes(2));
    expect(syncClientDiagramStateMock).toHaveBeenCalledTimes(2);
    const secondPayload = streamDiagramAgentMock.mock.calls[1][0];
    expect(secondPayload.operation).toBe('transform');
    expect(secondPayload.mode).toBe('gilfoyle');
    expect(secondPayload.revisionId).toBe(1);
  });

  it('does not re-submit intent when switching back after a mode-switch sync', async () => {
    // Same full-suite headroom as the mobile auto-close test above.
    const previousMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));

    const mermaidWithTopic = {
      ...initialState,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  Sun --> Planets',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T08:30:00.000Z'
    };
    const syncedInfographic = {
      ...createInitialDiagramState('infographic'),
      revisionId: 5,
      diagramSource: 'infographic sequence-diagram\n  title Solar',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T09:00:00.000Z'
    };

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: mermaidWithTopic,
      infographic: createInitialDiagramState('infographic')
    });

    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent' && payload.contentType === 'infographic') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: syncedInfographic,
          message: 'Applied.'
        });
        return;
      }
      if (payload.operation === 'intent') {
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: mermaidWithTopic,
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady();

    pickContentMode('Infographic');

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter(
        (c) => c[0]?.operation === 'intent'
      );
      expect(intentCalls).toHaveLength(1);
    });
    await screen.findAllByText('Done');
    await waitForControlsReady();

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'infographic',
      mermaid: mermaidWithTopic,
      infographic: syncedInfographic
    });

    streamDiagramAgentMock.mockClear();

    pickContentMode('Diagram');
    await waitForControlsReady();

    const intentCalls = streamDiagramAgentMock.mock.calls.filter(
      (c) => c[0]?.operation === 'intent'
    );
    expect(intentCalls).toHaveLength(0);

    globalThis.matchMedia = previousMatchMedia;
  }, 15000);

  it('auto-submits intent with peerContext when switching to infographic after Refine without lastUserPrompt', async () => {
    const mermaidFromRefine = {
      ...initialState,
      revisionId: 3,
      diagramSource: 'flowchart TD\n  API --> DB',
      lastUserPrompt: null,
      updatedAt: '2026-05-10T10:00:00.000Z'
    };

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: mermaidFromRefine,
      infographic: createInitialDiagramState('infographic')
    });

    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent' && payload.contentType === 'infographic') {
        expect(payload.peerContext?.contentType).toBe('mermaid');
        expect(payload.peerContext?.diagramSource).toContain('API');
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: {
            ...createInitialDiagramState('infographic'),
            revisionId: 1,
            diagramSource: 'infographic list\n  items\n    - API',
            lastUserPrompt: payload.prompt
          },
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady();

    pickContentMode('Infographic');

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter(
        (c) => c[0]?.operation === 'intent' && c[0]?.contentType === 'infographic'
      );
      expect(intentCalls).toHaveLength(1);
      expect(intentCalls[0][0].peerContext?.contentType).toBe('mermaid');
    });
  });

  it('auto-submits intent with peerContext when switching to diagram and infographic is ahead', async () => {
    window.localStorage.setItem('archislop:content-mode', 'infographic');

    const staleMermaid = {
      ...initialState,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  Old --> Stale',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T08:30:00.000Z'
    };
    const freshInfographic = {
      ...createInitialDiagramState('infographic'),
      revisionId: 5,
      diagramSource: 'infographic sequence-diagram\n  title Solar',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T09:00:00.000Z'
    };

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'infographic',
      mermaid: staleMermaid,
      infographic: freshInfographic
    });

    render(<App />);
    await waitForControlsReady();

    pickContentMode('Diagram');

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter(
        (c) => c[0]?.operation === 'intent'
      );
      expect(intentCalls.length).toBeGreaterThan(0);
      expect(
        intentCalls.some(
          (c) =>
            c[0]?.prompt === 'Solar system' &&
            c[0]?.contentType === 'mermaid' &&
            c[0]?.peerContext?.contentType === 'infographic'
        )
      ).toBe(true);
    });
  });

  it('auto-submits intent with peerContext when switching to 3D from mermaid', async () => {
    const mermaidWithTopic = {
      ...initialState,
      revisionId: 3,
      diagramSource: 'flowchart TD\n  API --> DB',
      lastUserPrompt: 'Order pipeline',
      updatedAt: '2026-05-10T10:00:00.000Z'
    };

    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: mermaidWithTopic,
      infographic: createInitialDiagramState('infographic'),
      metaphor3d: createInitialDiagramState('metaphor3d')
    });

    streamDiagramAgentMock.mockImplementation(async (payload, onEvent) => {
      if (payload.operation === 'intent' && payload.contentType === 'metaphor3d') {
        expect(payload.peerContext?.contentType).toBe('mermaid');
        expect(payload.peerContext?.diagramSource).toContain('API');
        onEvent?.({
          type: 'final',
          revisionChanged: true,
          state: {
            ...createInitialDiagramState('metaphor3d'),
            revisionId: 1,
            diagramSource:
              '{"metaphor":"city","scene":{"theme":"whiteboard","camera":"orbit"},"items":[]}',
            lastUserPrompt: payload.prompt
          },
          message: 'Applied.'
        });
      }
    });

    render(<App />);
    await waitForControlsReady();

    pickContentMode('3D metaphor');

    await waitFor(() => {
      const intentCalls = streamDiagramAgentMock.mock.calls.filter(
        (c) => c[0]?.operation === 'intent' && c[0]?.contentType === 'metaphor3d'
      );
      expect(intentCalls).toHaveLength(1);
    });
  });

  it('defaults deliverable format to Auto on a fresh visit', async () => {
    window.localStorage.removeItem('archislop:content-mode');
    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('desk-os-menubar')).toBeTruthy();
    });
    openDeliverableMenu();
    expect(screen.getByRole('menuitem', { name: /^Auto/i }).getAttribute('aria-current')).toBe(
      'true'
    );
  });

  // First run arrives through the isometric floor (ADR-0011 slice 3); the card
  // tour stays mounted afterwards for replays.
  it('shows the floor arrival alone on first visit, then reveals the entry screen', async () => {
    window.localStorage.removeItem('archislop:office-directory-seen');
    fetchSessionDiagramStateMock.mockResolvedValue({
      activeContentType: 'mermaid',
      mermaid: { ...initialState, diagramSource: '', revisionId: 0 },
      infographic: createInitialDiagramState('infographic')
    });
    render(<App />);
    expect(screen.getByTestId('office-floor-arrival')).toBeTruthy();
    expect(screen.queryByTestId('office-directory-modal')).toBeNull();
    expect(screen.queryByTestId('day-one-badge')).toBeNull();
    expect(screen.queryByRole('button', { name: /Do it/i })).toBeNull();

    fireEvent.click(screen.getByTestId('office-floor-arrival-skip'));

    expect(await screen.findByPlaceholderText(/Prompt anything into reality/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Do it/i })).toBeNull();
    expect(screen.queryByTestId('office-floor-arrival')).toBeNull();
    expect(screen.queryByTestId('day-one-badge')).toBeNull();
  });
});
