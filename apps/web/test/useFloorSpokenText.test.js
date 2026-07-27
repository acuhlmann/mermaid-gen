// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFloorSpokenText } from '../src/components/officeFloor/useFloorSpokenText.js';

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
});
