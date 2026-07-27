import { useEffect, useRef } from 'react';
import { officeCueChime } from '../utils/officeCuePlayers.js';
import { pickNextSoundscapeCue } from '../utils/officeSoundscape.js';
import { getOfficeSnapshot } from '../state/officeMomentStore.js';
import { getOfficeViewMode } from '../state/officeViewModeStore.js';

export const SOUNDSCAPE_TICK_MS = 5_000;

/**
 * Office soundscape director (docs/office-parody.md): a tiny sibling of
 * useOfficeAmbience that ticks and asks the pure brain in officeSoundscape.js
 * when to play a room-tone cue. Holds while the tab is hidden, during Focus
 * Time (the whole office is muted), or when the user switched the soundscape
 * off in the desk menu; `playChime` is App's sound gate (soundEnabled +
 * user gesture), so a muted app stays silent for free.
 *
 * Cues resolve through `officeCueChime`, which prefers a baked sample and falls
 * back to synthesis. The continuous bed underneath is a separate concern —
 * see useOfficeRoomTone. While you are at your desk the brain biases toward
 * keyboard/mouse/paper; on the floor, kitchen and printer set pieces step up.
 *
 * @param {{ playChime?: (playFn: (ref: object) => void) => void, random?: () => number }} params
 */
export function useOfficeSoundscape(params) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    const sessionStartedAt = Date.now();
    let lastPlayedAt = 0;
    let lastCue = null;

    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const snapshot = getOfficeSnapshot();
      if (!snapshot.soundscape || snapshot.focusTime) return;
      const random = paramsRef.current.random ?? Math.random;
      const atDesk = getOfficeViewMode() === 'desk';
      const cue = pickNextSoundscapeCue({
        now: Date.now(),
        sessionStartedAt,
        lastPlayedAt,
        lastCue,
        atDesk,
        random
      });
      if (!cue) return;
      lastPlayedAt = Date.now();
      lastCue = cue;
      paramsRef.current.playChime?.(officeCueChime(cue, { random }));
    };

    const interval = setInterval(tick, SOUNDSCAPE_TICK_MS);
    return () => clearInterval(interval);
  }, []);
}
