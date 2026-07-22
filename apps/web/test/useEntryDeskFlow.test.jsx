// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEntryDeskFlow } from '../src/features/desk/useEntryDeskFlow.js';
import { OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY } from '../src/utils/officeAmbienceStorage.js';
import { MODE_REVEAL_SEEN_KEY } from '../src/utils/modeRevealStorage.js';

describe('useEntryDeskFlow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('walks the entry tour without forcing the Your desk menu open', () => {
    const hasInteractedRef = { current: false };
    const handleSelectContentMode = vi.fn();
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasCanvasContent: false,
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        hasInteractedRef,
        handleSelectContentMode
      })
    );

    expect(result.current.showEntryDeskIntro).toBe(true);
    expect(result.current.entryTourStep).toBe('welcome');
    expect(result.current.entryReveal.workOrder).toBe(false);
    expect(result.current.deskDrawerTourOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2_500);
    });
    expect(result.current.entryTourStep).toBe('work-order');
    expect(result.current.entryReveal.workOrder).toBe(true);
    expect(result.current.entryReveal.desk).toBe(true);
    expect(result.current.entryReveal.team).toBe(true);
    expect(result.current.entryReveal.drawer).toBe(true);
    expect(result.current.deskDrawerTourOpen).toBe(false);

    act(() => {
      result.current.advanceEntryTour();
      result.current.advanceEntryTour();
      result.current.advanceEntryTour();
    });
    expect(result.current.entryTourStep).toBe('format');
    expect(result.current.deskDrawerTourOpen).toBe(true);

    act(() => {
      result.current.handleEntryModePick('chart');
    });
    expect(handleSelectContentMode).toHaveBeenCalledWith('chart');
    expect(result.current.entryTourStep).toBeNull();
    expect(result.current.deskDrawerTourOpen).toBe(false);
    expect(result.current.entryReveal.desk).toBe(true);
  });

  it('keeps desk chrome available on an empty canvas after the intro is seen', () => {
    window.localStorage.setItem(OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY, '1');
    window.localStorage.setItem(MODE_REVEAL_SEEN_KEY, '1');
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasCanvasContent: false,
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        hasInteractedRef: { current: false },
        handleSelectContentMode: vi.fn()
      })
    );

    expect(result.current.showEntryDeskIntro).toBe(false);
    expect(result.current.showDeskChrome).toBe(true);
    expect(result.current.entryReveal.desk).toBe(true);
    expect(result.current.entryReveal.drawer).toBe(true);
  });

  it('keeps desk chrome visible while the notebook is open', () => {
    window.localStorage.setItem(OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY, '1');
    const { result } = renderHook(() =>
      useEntryDeskFlow({
        hasCanvasContent: true,
        hasDiagramText: true,
        insightsOpen: true,
        stakeholderIntroProps: null,
        editorOpen: false,
        hasInteractedRef: { current: true },
        handleSelectContentMode: vi.fn()
      })
    );

    expect(result.current.showDeskChrome).toBe(true);
  });

  it('reveals alternate content modes after the first diagram lands', () => {
    window.localStorage.setItem(OFFICE_ENTRY_DESK_INTRO_STORAGE_KEY, '1');
    const handleSelectContentMode = vi.fn();
    const { result, rerender } = renderHook((props) => useEntryDeskFlow(props), {
      initialProps: {
        hasCanvasContent: true,
        hasDiagramText: false,
        insightsOpen: false,
        stakeholderIntroProps: null,
        editorOpen: false,
        hasInteractedRef: { current: true },
        handleSelectContentMode
      }
    });

    expect(result.current.modeRevealActive).toBe(false);

    rerender({
      hasCanvasContent: true,
      hasDiagramText: true,
      insightsOpen: false,
      stakeholderIntroProps: null,
      editorOpen: false,
      hasInteractedRef: { current: true },
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
