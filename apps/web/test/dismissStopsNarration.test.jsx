// @vitest-environment jsdom
/**
 * Closing talk UI must cut the voice mid-sentence — finishing the line after
 * you walked away from a huddle / holy war / desk card feels like a ghost.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import OfficeDeskSpeech from '../src/components/OfficeDeskSpeech.jsx';
import { useScenePacing } from '../src/hooks/useScenePacing.js';
import { cancelOfficeNarration, OFFICE_NARRATION_GAP_MS } from '../src/utils/officeNarration.js';

vi.mock('../src/utils/officeNarration.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cancelOfficeNarration: vi.fn(actual.cancelOfficeNarration)
  };
});

const LINES = [
  { speakerId: 'gilfoyle', text: 'First line.' },
  { speakerId: 'dinesh', text: 'Second line.' },
  { speakerId: 'erlich', text: 'Third line.' }
];

describe('dismiss stops narration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelOfficeNarration.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    // Drain any real utterance left from a leaked generation.
    cancelOfficeNarration();
  });

  it('desk speech dismiss cancels in-flight voice', () => {
    const narrateLine = vi.fn(() => new Promise(() => {}));
    render(
      <OfficeDeskSpeech
        line={{ id: 'im-1', colleagueId: 'gilfoyle', body: 'Three services too many.' }}
        narration
        narrateLine={narrateLine}
        captions={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Back to work|Get back to work/i }));
    expect(cancelOfficeNarration).toHaveBeenCalled();
  });

  it('scene pacing cancels voice when the scene is dismissed mid-line', async () => {
    let resolveSpeak;
    const narrateLine = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSpeak = resolve;
        })
    );
    const { rerender } = renderHook(
      ({ active }) =>
        useScenePacing({
          lines: LINES,
          active,
          narrateLine,
          paceMs: 3000,
          silentDurationMs: 9000,
          sceneId: 'battle-1'
        }),
      { initialProps: { active: true } }
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(narrateLine).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender({ active: false });
    });
    expect(cancelOfficeNarration).toHaveBeenCalled();

    await act(async () => {
      resolveSpeak?.({ spoken: true });
      await vi.advanceTimersByTimeAsync(OFFICE_NARRATION_GAP_MS + 50);
    });
    expect(narrateLine).toHaveBeenCalledTimes(1);
  });

  it('scene pacing does not start the next line when the cancel was the scene stopping', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false, cancelled: true }));
    const { rerender } = renderHook(
      ({ active }) =>
        useScenePacing({
          lines: LINES,
          active,
          narrateLine,
          paceMs: 3000,
          silentDurationMs: 9000,
          sceneId: 'huddle-1'
        }),
      { initialProps: { active: true } }
    );

    await act(async () => {
      await Promise.resolve();
    });
    // The Hard stop lands after the voice was cut, as it does in the app.
    await act(async () => {
      rerender({ active: false });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000 + 100);
    });
    expect(narrateLine).toHaveBeenCalledTimes(1);
  });

  it('scene pacing carries on when a cancel leaves the scene running (a pinned face)', async () => {
    // Pinning a face mid-stand-up cuts the voice without ending the scene;
    // bailing there used to strand the ring on that line for good.
    const narrateLine = vi
      .fn()
      .mockResolvedValueOnce({ spoken: false, cancelled: true })
      .mockResolvedValue({ spoken: false });
    renderHook(() =>
      useScenePacing({
        lines: LINES,
        active: true,
        narrateLine,
        paceMs: 3000,
        silentDurationMs: 9000,
        sceneId: 'huddle-1'
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000 + 200);
    });
    expect(narrateLine).toHaveBeenCalledTimes(2);
  });
});
