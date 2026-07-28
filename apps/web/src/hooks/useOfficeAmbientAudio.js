import { useCallback } from 'react';
import { useOfficeRoomTone } from './useOfficeRoomTone.js';
import { useOfficeSoundscape } from './useOfficeSoundscape.js';
import { primeOfficeAudio } from '../utils/officeAudioPrime.js';

/**
 * Continuous room-tone bed plus sparse ambient cues. Mounted from ArchiSlop so
 * the bed survives the floor-arrival → desk transition (OfficeLayer is not
 * mounted during first-run boot). FloorArrival only primes the audio gate on
 * check-in; it no longer owns a second director.
 *
 * @param {{
 *   playChime?: (playFn: (ref: object) => void) => boolean | void,
 *   audioContextRef?: { current: AudioContext | null },
 *   hasInteractedRef?: import('react').MutableRefObject<boolean>,
 *   soundEnabled?: boolean,
 *   roomToneViewMode?: 'desk' | 'floor'
 * }} params
 */
export function useOfficeAmbientAudio({
  playChime,
  audioContextRef,
  hasInteractedRef,
  soundEnabled = true,
  roomToneViewMode
}) {
  const gatedPlayChime = useCallback(
    (playFn) => {
      if (!soundEnabled) return false;
      if (audioContextRef && hasInteractedRef) {
        primeOfficeAudio(audioContextRef, hasInteractedRef);
      }
      if (!playChime) return false;
      return Boolean(playChime(playFn));
    },
    [playChime, audioContextRef, hasInteractedRef, soundEnabled]
  );

  useOfficeSoundscape({ playChime: gatedPlayChime });
  useOfficeRoomTone({ playChime: gatedPlayChime, roomToneViewMode });
}
