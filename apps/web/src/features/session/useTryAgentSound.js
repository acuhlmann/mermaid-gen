import { useCallback, useEffect } from 'react';
import { primeOfficeAudio } from '../../utils/officeAudioPrime.js';

/**
 * Shared gesture gate for agent chimes and the office room-tone bed.
 * Returns whether the gate let the call through.
 */
export function useTryAgentSound({
  soundEnabled,
  audioContextRef,
  hasInteractedRef,
  tryAgentSoundRef
}) {
  const tryAgentSound = useCallback(
    (playFn) => {
      if (!soundEnabled) return false;
      primeOfficeAudio(audioContextRef, hasInteractedRef);
      if (!hasInteractedRef.current) return false;
      try {
        playFn(audioContextRef);
      } catch {
        // Ignore audio issues (autoplay restrictions, unsupported browser, etc).
      }
      return true;
    },
    [soundEnabled, audioContextRef, hasInteractedRef]
  );

  tryAgentSoundRef.current = tryAgentSound;

  // Office soundscape waits on the same gesture gate as agent chimes. Prime on
  // any deliberate UI interaction — stand up, check in, desk menu — not only on
  // diagram generation.
  useEffect(() => {
    if (!soundEnabled) return undefined;
    const prime = () => primeOfficeAudio(audioContextRef, hasInteractedRef);
    const opts = { capture: true, once: true, passive: true };
    document.addEventListener('pointerdown', prime, opts);
    document.addEventListener('keydown', prime, opts);
    return () => {
      document.removeEventListener('pointerdown', prime, opts);
      document.removeEventListener('keydown', prime, opts);
    };
  }, [soundEnabled, audioContextRef, hasInteractedRef]);

  return tryAgentSound;
}
