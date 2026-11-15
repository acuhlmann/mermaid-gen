// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFloorSpokenText } from '../src/components/officeFloor/useFloorSpokenText.js';
import * as officeNarration from '../src/utils/officeNarration.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFloorSpokenText', () => {
  it('hides bubbles while narration speaks and CC is off', async () => {
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    const { result } = renderHook(() =>
      useFloorSpokenText({
        captions: false,
        sceneHandlers: { narrateLine },
        peekColleagueId: 'greybeard',
        talkColleagueId: null,
        talkLine: '',
        walkBy: null,
        hasActiveSpeech: true
      })
    );

    await waitFor(() =>
      expect(narrateLine).toHaveBeenCalledWith(expect.objectContaining({ speakerId: 'greybeard' }))
    );
    await waitFor(() => expect(result.current.showSpokenText).toBe(false));
  });

  it('shows bubbles when narration fails and CC stays off', async () => {
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: false }));
    const { result } = renderHook(() =>
      useFloorSpokenText({
        captions: false,
        sceneHandlers: { narrateLine },
        peekColleagueId: 'greybeard',
        talkColleagueId: null,
        talkLine: '',
        walkBy: null,
        hasActiveSpeech: true
      })
    );

    await waitFor(() => expect(narrateLine).toHaveBeenCalled());
    await waitFor(() => expect(result.current.showSpokenText).toBe(true));
  });

  it('keeps lifted scene bubbles hidden while the current paced line was heard', async () => {
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    const { result } = renderHook(() =>
      useFloorSpokenText({
        captions: false,
        sceneHandlers: { narrateLine },
        liftedSceneSpeech: true,
        liftedLineSpoken: true,
        hasActiveSpeech: true
      })
    );
    await waitFor(() => expect(result.current.showSpokenText).toBe(false));
  });

  it('shows lifted scene bubbles when the paced line was silent', async () => {
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    const { result } = renderHook(() =>
      useFloorSpokenText({
        captions: false,
        sceneHandlers: { narrateLine },
        liftedSceneSpeech: true,
        liftedLineSpoken: false,
        hasActiveSpeech: true
      })
    );
    await waitFor(() => expect(result.current.showSpokenText).toBe(true));
  });

  it('keeps the current altarCameo balloon visible when narration is skipped due to busy TTS', async () => {
    const busySpy = vi.spyOn(officeNarration, 'isOfficeNarrationBusy').mockReturnValue(false);
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));

    const { result, rerender } = renderHook(
      ({ altarCameo }) =>
        useFloorSpokenText({
          captions: false,
          sceneHandlers: { narrateLine },
          altarCameo,
          hasActiveSpeech: false
        }),
      { initialProps: { altarCameo: { speakerId: 'gilfoyle', text: 'First cameo' } } }
    );

    await waitFor(() => expect(narrateLine).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.showSpokenText).toBe(false));

    busySpy.mockReturnValue(true);
    rerender({ altarCameo: { speakerId: 'dinesh', text: 'Second cameo while busy' } });

    await waitFor(() => expect(result.current.showSpokenText).toBe(true));
    expect(narrateLine).toHaveBeenCalledTimes(1);
  });
});
