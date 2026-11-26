// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useFloorSpokenText } from '../src/components/officeFloor/useFloorSpokenText.js';
import * as officeNarration from '../src/utils/officeNarration.js';
import * as godAltarAudio from '../src/features/god/godAltarAudio.js';

/*
 * Unmount every hook this file rendered. Vitest globals are off here, so
 * Testing Library's auto-cleanup never registers: without this, the
 * `liftedSceneSpeech` cases leave the narration-busy `setInterval` running
 * after jsdom is torn down, and its next tick throws `window is not defined`
 * as an unhandled error that fails the whole web suite (seen on PR #961).
 */
afterEach(() => {
  cleanup();
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

  it('suppresses floor and cameo narration while altarOpen is true or God speech is busy', async () => {
    const cancelSpy = vi
      .spyOn(officeNarration, 'cancelOfficeNarration')
      .mockImplementation(() => {});
    const godBusySpy = vi.spyOn(godAltarAudio, 'isGodSpeechBusy').mockReturnValue(false);
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));

    const { rerender } = renderHook(
      ({ altarOpen, altarCameo }) =>
        useFloorSpokenText({
          captions: false,
          altarOpen,
          sceneHandlers: { narrateLine },
          peekColleagueId: 'greybeard',
          altarCameo,
          hasActiveSpeech: false
        }),
      {
        initialProps: {
          altarOpen: true,
          altarCameo: { speakerId: 'gilfoyle', text: 'Should stay silent while altar open' }
        }
      }
    );

    expect(cancelSpy).toHaveBeenCalled();
    expect(narrateLine).not.toHaveBeenCalled();

    // Even once Altar closes, if God is still finishing a spoken decree, floor + cameo stay silent.
    godBusySpy.mockReturnValue(true);
    rerender({
      altarOpen: false,
      altarCameo: { speakerId: 'dinesh', text: 'Wait for God to finish speaking' }
    });
    expect(narrateLine).not.toHaveBeenCalled();

    // Once God finishes speaking, floor speech resumes for a fresh cameo.
    godBusySpy.mockReturnValue(false);
    rerender({
      altarOpen: false,
      altarCameo: { speakerId: 'gilfoyle', text: 'Okay, God is done talking.' }
    });
    await waitFor(() =>
      expect(narrateLine).toHaveBeenCalledWith(
        expect.objectContaining({ speakerId: 'gilfoyle', text: 'Okay, God is done talking.' })
      )
    );
  });

  it('clears dedupe refs on empty talk/walkBy without cancelling Altar speech on the shared synthesizer', async () => {
    const cancelSpy = vi
      .spyOn(officeNarration, 'cancelOfficeNarration')
      .mockImplementation(() => {});
    const godBusySpy = vi.spyOn(godAltarAudio, 'isGodSpeechBusy').mockReturnValue(false);
    const narrateLine = vi.fn(() => new Promise(() => {}));

    const { rerender } = renderHook(
      ({ altarOpen, talkColleagueId, talkLine, walkBy }) =>
        useFloorSpokenText({
          captions: false,
          altarOpen,
          sceneHandlers: { narrateLine },
          talkColleagueId,
          talkLine,
          walkBy,
          hasActiveSpeech: Boolean(talkColleagueId || walkBy)
        }),
      {
        initialProps: {
          altarOpen: false,
          talkColleagueId: 'gilfoyle',
          talkLine: 'Same talk line',
          walkBy: { id: 'wb-1', colleagueId: 'dinesh', body: 'Same walk-by line' }
        }
      }
    );

    await waitFor(() => expect(narrateLine).toHaveBeenCalledTimes(2));

    // Altar opens (cancels office narration once) and God starts speaking.
    rerender({
      altarOpen: true,
      talkColleagueId: 'gilfoyle',
      talkLine: 'Same talk line',
      walkBy: { id: 'wb-1', colleagueId: 'dinesh', body: 'Same walk-by line' }
    });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    cancelSpy.mockClear();

    // Talk and walk-by clear while God owns the shared synthesizer: refs reset, NO cancelOfficeNarration.
    godBusySpy.mockReturnValue(true);
    rerender({
      altarOpen: true,
      talkColleagueId: null,
      talkLine: '',
      walkBy: null
    });
    expect(cancelSpy).not.toHaveBeenCalled();

    // After Altar closes and God finishes, the exact same talkLine can narrate again (ref was cleared),
    // and leaving talk while office owns playback DOES call cancelOfficeNarration.
    godBusySpy.mockReturnValue(false);
    rerender({
      altarOpen: false,
      talkColleagueId: 'gilfoyle',
      talkLine: 'Same talk line',
      walkBy: null
    });
    await waitFor(() => expect(narrateLine).toHaveBeenCalledTimes(3));

    rerender({
      altarOpen: false,
      talkColleagueId: null,
      talkLine: '',
      walkBy: null
    });
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });
});
