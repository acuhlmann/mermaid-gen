// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryDeskFlow } from '../src/features/desk/useEntryDeskFlow.js';
import { MODE_REVEAL_SEEN_KEY } from '../src/utils/modeRevealStorage.js';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

describe('useEntryDeskFlow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('always reveals full desk chrome on an empty canvas', () => {
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        handleSelectContentMode: vi.fn()
      })
    );

    expect(result.current.showDeskChrome).toBe(true);
    expect(result.current.entryReveal).toEqual({
      workOrder: true,
      desk: true,
      team: true,
      notebook: true,
      drawer: true
    });
  });

  it('starts the desk welcome beat when the office tour hands off', () => {
    const onDeskTourComplete = vi.fn();
    const { result, rerender } = renderHook((props) => useEntryDeskFlow(props), {
      initialProps: {
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        handleSelectContentMode: vi.fn(),
        deskTourPending: false,
        onDeskTourComplete,
        entryPointers: CONTROLS_EN.prompt.entryPointers
      }
    });

    expect(result.current.entryTourActive).toBe(false);

    rerender({
      hasDiagramText: false,
      insightsOpen: false,
      stakeholderIntroProps: null,
      editorOpen: false,
      handleSelectContentMode: vi.fn(),
      deskTourPending: true,
      onDeskTourComplete,
      entryPointers: CONTROLS_EN.prompt.entryPointers
    });

    expect(result.current.entryTourActive).toBe(true);
    expect(result.current.showEntryDeskIntro).toBe(true);
    expect(result.current.entryTourStep).toBe('welcome');
  });

  it('walks desk controls on the real chrome after the welcome beat', () => {
    const onDeskTourComplete = vi.fn();
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        handleSelectContentMode: vi.fn(),
        deskTourPending: true,
        onDeskTourComplete,
        entryPointers: CONTROLS_EN.prompt.entryPointers
      })
    );

    act(() => {
      result.current.advanceEntryTour();
    });
    expect(result.current.entryTourStep).toBe('work-order');
    expect(result.current.tourHighlight).toBe('work-order');
    expect(result.current.showEntryDeskIntro).toBe(false);

    act(() => {
      result.current.advanceEntryTour();
    });
    expect(result.current.entryTourStep).toBe('desk');
    expect(result.current.tourHighlight).toBe('desk');
  });

  it('keeps desk chrome visible while the notebook is open', () => {
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasDiagramText: true,
        insightsOpen: true,
        stakeholderIntroProps: null,
        editorOpen: false,
        handleSelectContentMode: vi.fn()
      })
    );

    expect(result.current.showDeskChrome).toBe(true);
  });

  it('reveals alternate content modes after the first diagram lands', () => {
    const handleSelectContentMode = vi.fn();
    const { result, rerender } = renderHook((props) => useEntryDeskFlow(props), {
      initialProps: {
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        handleSelectContentMode
      }
    });

    expect(result.current.modeRevealActive).toBe(false);

    rerender({
      hasDiagramText: true,
      insightsOpen: false,
      stakeholderIntroProps: null,
      editorOpen: false,
      handleSelectContentMode
    });

    expect(result.current.modeRevealActive).toBe(true);
    expect(window.localStorage.getItem(MODE_REVEAL_SEEN_KEY)).toBe('1');

    act(() => {
      result.current.handleModeRevealPick('infographic');
    });
    expect(handleSelectContentMode).toHaveBeenCalledWith('infographic');
    expect(result.current.modeRevealActive).toBe(false);
  });
});
