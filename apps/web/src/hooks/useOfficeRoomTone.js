import { useEffect, useRef } from 'react';
import { onOfficeAudioGateOpen } from '../utils/officeAudioPrime.js';
import { setRoomToneViewMode, startRoomTone, stopRoomTone } from '../utils/officeRoomTone.js';
import { getOfficeSnapshot, subscribe } from '../state/officeMomentStore.js';
import { getOfficeViewMode, subscribe as subscribeViewMode } from '../state/officeViewModeStore.js';

export const ROOM_TONE_TICK_MS = 5_000;

/** Active `useOfficeRoomTone` mounts — only stop the bed when the last one unmounts. */
let directorCount = 0;

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * Room-tone director (docs/office-parody.md §6) — the continuous sibling of
 * useOfficeSoundscape. Where that hook fires discrete cues on a jittered gap,
 * this one owns a single looping bed and only ever answers one question:
 * should the room be audible right now?
 *
 * Declarative rather than event-driven on purpose. `sync` reads the desired
 * state and makes reality match, so it is safe to call from anywhere; it runs
 * on every store change (Focus Time and the Soundscape toggle react instantly
 * rather than waiting out a tick), on visibility changes, and on a slow tick
 * that self-heals the one transition nothing notifies us about — the sound
 * gate opening when the user first interacts with the page.
 *
 * @param {{ playChime?: (playFn: (ref: object) => void) => boolean | void, roomToneViewMode?: 'desk' | 'floor' }} params
 */
export function useOfficeRoomTone(params) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    directorCount += 1;

    const syncViewGain = () => {
      const mode = paramsRef.current.roomToneViewMode ?? getOfficeViewMode();
      setRoomToneViewMode(mode);
    };

    const roomShouldBeAudible = () => {
      if (isHidden()) return false;
      const snapshot = getOfficeSnapshot();
      return Boolean(snapshot.soundscape) && !snapshot.focusTime;
    };

    const sync = () => {
      if (!roomShouldBeAudible()) {
        stopRoomTone();
        return;
      }
      // playChime is App's sound gate (soundEnabled + first user gesture). It
      // reports whether it let the call through, so a gate that closes
      // mid-session — muting the app while the bed loops — also stops the bed.
      const gateOpen = paramsRef.current.playChime?.(startRoomTone);
      if (!gateOpen) stopRoomTone();
    };

    const unsubscribe = subscribe(sync);
    const unsubscribeView = subscribeViewMode(syncViewGain);
    const unsubscribeGate = onOfficeAudioGateOpen(sync);
    const interval = setInterval(sync, ROOM_TONE_TICK_MS);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', sync);
    }
    syncViewGain();
    sync();

    return () => {
      directorCount -= 1;
      unsubscribe();
      unsubscribeView();
      unsubscribeGate();
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', sync);
      }
      if (directorCount === 0) stopRoomTone();
    };
  }, []);
}

/** @internal Reset between tests. */
export function _resetRoomToneDirectorsForTests() {
  directorCount = 0;
}
