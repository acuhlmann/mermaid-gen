import { useCallback } from 'react';
import { useOfficeRoomTone } from './useOfficeRoomTone.js';
import { useOfficeSoundscape } from './useOfficeSoundscape.js';
import { primeOfficeAudio } from '../utils/officeAudioPrime.js';

/**
 * Continuous room-tone bed plus sparse ambient cues. Shared by OfficeLayer and
 * FloorArrival so isometric views hear the office from the first gesture.
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
