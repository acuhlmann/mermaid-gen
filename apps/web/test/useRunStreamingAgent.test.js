// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playFailureChime,
  playRussStreamStart,
  playErlichStreamStart,
  playGilfoyleStreamStart,
  playStreamStartChime
} from '../src/utils/agentChimes.js';

const streamDiagramAgentMock = vi.fn();

vi.mock('../src/state/diagramStore.js', () => ({
  streamDiagramAgent: (...args) => streamDiagramAgentMock(...args)
}));

import { useRunStreamingAgent } from '../src/features/streaming/useRunStreamingAgent.js';

function createDeps(overrides = {}) {
  return {
    activeSessionId: 'sess-1',
    contentMode: 'mermaid',
    modelProfile: 'fast',
    controls: {
      loading: { stopped: 'Stopped' },
      insights: {
        errorPrefix: 'Error',
        streamFailures: {
          no_patch: 'No patch applied',
          syntax_exhausted: 'Could not produce valid output',
          stale_revision: 'Diagram changed — retry',
          timeout: 'Timed out',
          unknown: 'Something went wrong'
        }
      }
    },
    streamAgentAbortRef: { current: null },
    lastTokenSoundAtRef: { current: 99 },
    russTokenTickIndexRef: { current: 5 },
    lastDraftTickAtRef: { current: 0 },
    sessionTopicRef: { current: null },
    crossModeSyncRef: { current: {} },
    pendingAutoDiagramHighlightRef: { current: null },
    pendingAutoDiagramHighlightTimeoutRef: { current: null },
    agentCostEstimatesRef: { current: {} },
    autoCloseActiveEntryIdRef: { current: null },
    setInsightsOpen: vi.fn(),
    setRussStreak: vi.fn(),
    setLiveDraftSource: vi.fn(),
    setLiveDraftContentType: vi.fn(),
    appendInsightEntry: vi.fn(() => 'section-42'),
    patchInsightEntry: vi.fn(),
    appendToInsight: vi.fn(),
    setInsightStatus: vi.fn(),
    appendTechnicalAction: vi.fn(),
    annotateTechnicalActionResult: vi.fn(),
    finalizeTechnicalActionResult: vi.fn(),
    enrichTechnicalActionDetail: vi.fn(),
    appendStreamDebugLog: vi.fn(),
    animateAcceptedSource: vi.fn(),
    applyResolvedContentMode: vi.fn(),
    triggerCompletionDelight: vi.fn(),
    tryAgentSound: vi.fn(),
    ...overrides
  };
}

describe('useRunStreamingAgent', () => {
  beforeEach(() => {
    streamDiagramAgentMock.mockReset();
    streamDiagramAgentMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('opens insights, creates an entry, and streams with session id', async () => {
    const deps = createDeps();
    streamDiagramAgentMock.mockImplementation(async (_payload, onEvent) => {
      onEvent({ type: 'token', text: 'hello' });
    });

    const { result } = renderHook(() => useRunStreamingAgent(deps));

    await act(async () => {
      await result.current.runStreamingAgent({
        operation: 'intent',
        payload: { prompt: 'draw auth flow', contentType: 'mermaid' },
        title: 'Go',
        variant: 'intent'
      });
    });

    expect(deps.setInsightsOpen).toHaveBeenCalledWith(true);
    expect(deps.appendInsightEntry).toHaveBeenCalledWith(
      'Go',
      'intent',
      expect.objectContaining({
        contentType: 'mermaid',
        modelProfile: 'fast',
        retryDescriptor: expect.objectContaining({ operation: 'intent', variant: 'intent' })
      })
    );
    expect(deps.tryAgentSound).toHaveBeenCalledWith(playStreamStartChime);
    expect(streamDiagramAgentMock).toHaveBeenCalledWith(
      { prompt: 'draw auth flow', contentType: 'mermaid' },
      expect.any(Function),
      expect.objectContaining({ sessionId: 'sess-1', signal: expect.any(AbortSignal) })
    );
    expect(deps.appendStreamDebugLog).toHaveBeenCalledWith('section-42', {
      type: 'token',
      text: 'hello'
    });
    expect(deps.streamAgentAbortRef.current).toBeNull();
  });

  it('plays variant-specific start chimes', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useRunStreamingAgent(deps));

    for (const [variant, chime] of [
      ['russ', playRussStreamStart],
      ['erlich', playErlichStreamStart],
      ['gilfoyle', playGilfoyleStreamStart]
    ]) {
      deps.tryAgentSound.mockClear();
      await act(async () => {
        await result.current.runStreamingAgent({
          operation: 'transform',
          payload: { prompt: 'x' },
          title: variant,
          variant
        });
      });
      expect(deps.tryAgentSound).toHaveBeenCalledWith(chime);
    }
  });

  it('marks undo baseline entries for auto-close', async () => {
    const deps = createDeps();
    const { result } = renderHook(() => useRunStreamingAgent(deps));

    await act(async () => {
      await result.current.runStreamingAgent({
        operation: 'transform',
        payload: { prompt: 'gilfoyle' },
        title: 'Refine',
        variant: 'gilfoyle',
        diagramUndoBaseline: { revisionId: 3 }
      });
    });

    expect(deps.autoCloseActiveEntryIdRef.current).toBe('section-42');
  });

  it('marks the insight cancelled when the stream aborts', async () => {
    const deps = createDeps();
    const abortErr = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    streamDiagramAgentMock.mockRejectedValue(abortErr);

    const { result } = renderHook(() => useRunStreamingAgent(deps));

    await act(async () => {
      await result.current.runStreamingAgent({
        operation: 'intent',
        payload: { prompt: 'stop me' },
        title: 'Go',
        variant: 'general'
      });
    });

    expect(deps.appendToInsight).not.toHaveBeenCalled();
    expect(deps.patchInsightEntry).toHaveBeenCalledWith('section-42', expect.any(Function));
    const patched = deps.patchInsightEntry.mock.calls[0][1]({ phases: [{ open: true }] });
    expect(patched.status).toBe('cancelled');
    expect(patched.statusText).toBe('Stopped');
    expect(deps.tryAgentSound).not.toHaveBeenCalledWith(playFailureChime);
    expect(deps.streamAgentAbortRef.current).toBeNull();
  });

  it('surfaces stream failures with classified status text', async () => {
    const deps = createDeps();
    streamDiagramAgentMock.mockRejectedValue(
      new Error('Agent run exceeded the Fast time limit (75s). Try a smaller diagram or retry.')
    );

    const { result } = renderHook(() => useRunStreamingAgent(deps));

    await act(async () => {
      await result.current.runStreamingAgent({
        operation: 'transform',
        payload: { prompt: 'big diagram' },
        title: 'Refine',
        variant: 'gilfoyle'
      });
    });

    expect(deps.appendToInsight).toHaveBeenCalledWith(
      'section-42',
      expect.stringContaining('**Error:** Agent run exceeded')
    );
    expect(deps.patchInsightEntry).toHaveBeenCalledWith('section-42', expect.any(Function));
    const patched = deps.patchInsightEntry.mock.calls[0][1]({ phases: [] });
    expect(patched.status).toBe('failed');
    expect(patched.failureClass).toBe('timeout');
    expect(patched.statusText).toMatch(/timed out/i);
    expect(deps.tryAgentSound).toHaveBeenCalled();
    expect(deps.streamAgentAbortRef.current).toBeNull();
  });
});
