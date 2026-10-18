// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTryAgentSound } from '../src/features/session/useTryAgentSound.js';

vi.mock('../src/utils/officeAudioPrime.js', () => ({
  primeOfficeAudio: vi.fn()
}));

import { primeOfficeAudio } from '../src/utils/officeAudioPrime.js';

describe('useTryAgentSound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when sound is disabled and does not play', () => {
    const tryAgentSoundRef = { current: null };
    const playFn = vi.fn();
    const { result } = renderHook(() =>
      useTryAgentSound({
        soundEnabled: false,
        audioContextRef: { current: null },
        hasInteractedRef: { current: true },
        tryAgentSoundRef
      })
    );

    let allowed = false;
    act(() => {
      allowed = result.current(playFn);
    });

    expect(allowed).toBe(false);
    expect(playFn).not.toHaveBeenCalled();
    expect(primeOfficeAudio).not.toHaveBeenCalled();
    expect(tryAgentSoundRef.current).toBe(result.current);
  });

  it('plays after priming when sound is enabled and the user has interacted', () => {
    const audioContextRef = { current: { sampleRate: 44100 } };
    const hasInteractedRef = { current: true };
    const tryAgentSoundRef = { current: null };
    const playFn = vi.fn();

    const { result } = renderHook(() =>
      useTryAgentSound({
        soundEnabled: true,
        audioContextRef,
        hasInteractedRef,
        tryAgentSoundRef
      })
    );

    let allowed = false;
    act(() => {
      allowed = result.current(playFn);
    });

    expect(allowed).toBe(true);
    expect(primeOfficeAudio).toHaveBeenCalledWith(audioContextRef, hasInteractedRef);
    expect(playFn).toHaveBeenCalledWith(audioContextRef);
  });
});
