// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { MockSpeechRecognition } = vi.hoisted(() => {
  class MockSpeechRecognition {
    lang = '';
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    results = [];

    start = vi.fn(function start() {
      MockSpeechRecognition.lastInstance = this;
    });

    stop = vi.fn(function stop() {
      this.onend?.();
    });

    abort = vi.fn(function abort() {
      this.onend?.();
    });

    static lastInstance = null;
  }
  return { MockSpeechRecognition };
});

vi.mock('../src/utils/appConstants.js', () => ({
  SpeechRecognitionCtor: MockSpeechRecognition
}));

import { useVoiceInput } from '../src/hooks/useVoiceInput.js';

function createDeps(overrides = {}) {
  const promptRef = { current: 'legacy prompt' };
  const deskPromptRef = { current: 'desk base' };
  const slopNextPromptRef = { current: 'slop base' };

  return {
    voiceSupported: true,
    controls: {
      loading: {
        micDenied: 'Mic denied',
        voiceFailed: 'Voice failed',
        voiceUnavailable: 'Voice unavailable'
      }
    },
    uiLocale: 'en-AU',
    loadingRef: { current: false },
    streamingPreviewRef: { current: false },
    slopPromptExpandedRef: { current: false },
    hasCanvasContentRef: { current: false },
    setSlopNextPrompt: vi.fn(),
    setDeskPrompt: vi.fn(),
    setPrompt: vi.fn(),
    hasInteractedRef: { current: false },
    ...overrides,
    promptRef,
    deskPromptRef,
    slopNextPromptRef
  };
}

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockSpeechRecognition.lastInstance = null;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('writes dictation into the desk Work Order field by default', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useVoiceInput(deps));

    act(() => {
      result.current.startVoiceInput();
    });

    const recognition = MockSpeechRecognition.lastInstance;
    expect(recognition.lang).toBe('en-AU');
    expect(recognition.continuous).toBe(true);

    act(() => {
      recognition.onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'create a flowchart' } }]
      });
    });

    expect(deps.setDeskPrompt).toHaveBeenCalledWith('desk base create a flowchart');
    expect(deps.deskPromptRef.current).toBe('desk base create a flowchart');
    expect(deps.setPrompt).not.toHaveBeenCalled();
    expect(deps.hasInteractedRef.current).toBe(true);
  });

  it('targets the expanded SlopNext prompt when that field is active', () => {
    const deps = createDeps({ slopPromptExpandedRef: { current: true } });
    const { result } = renderHook(() => useVoiceInput(deps));

    act(() => {
      result.current.startVoiceInput();
    });

    act(() => {
      MockSpeechRecognition.lastInstance.onresult?.({
        results: [{ isFinal: true, 0: { transcript: 'for login' } }]
      });
    });

    expect(deps.setSlopNextPrompt).toHaveBeenCalledWith('slop base for login');
    expect(deps.slopNextPromptRef.current).toBe('slop base for login');
    expect(deps.setDeskPrompt).not.toHaveBeenCalled();
  });

  it('replaces the live session transcript instead of appending duplicate finals', () => {
    const deps = createDeps();
    deps.deskPromptRef.current = '';
    const { result } = renderHook(() => useVoiceInput(deps));

    act(() => {
      result.current.startVoiceInput();
    });

    const recognition = MockSpeechRecognition.lastInstance;

    act(() => {
      recognition.onresult?.({
        results: [
          { isFinal: true, 0: { transcript: 'create a diagram' } },
          { isFinal: true, 0: { transcript: ' diagram for login' } },
          { isFinal: false, 0: { transcript: ' for login flow' } }
        ]
      });
    });

    expect(deps.setDeskPrompt).toHaveBeenLastCalledWith('create a diagram for login flow');
  });

  it('surfaces mic permission errors without leaving listening stuck', () => {
    const deps = createDeps();
    const { result } = renderHook(() => useVoiceInput(deps));

    act(() => {
      result.current.startVoiceInput();
    });

    act(() => {
      MockSpeechRecognition.lastInstance.onerror?.({ error: 'not-allowed' });
    });

    expect(result.current.voiceError).toBe('Mic denied');
  });
});
