import { useEffect, useRef } from 'react';
import { officeCueChime } from '../utils/officeCuePlayers.js';
import { pickNextSoundscapeCue } from '../utils/officeSoundscape.js';
import { peopleOutOfChairs, roomOccupancyAt } from '../utils/officeCadence.js';
import { getOfficeSnapshot } from '../state/officeMomentStore.js';
import { getOfficeViewMode } from '../state/officeViewModeStore.js';
import { isOfficeNarrationBusy } from '../utils/officeNarration.js';
import { getRoomToneZone } from '../utils/officeRoomTone.js';

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
 * keyboard/mouse/paper; on the floor, kitchen and printer set pieces step up,
 * and standing *in* a room weights that room's own cues (the fridge in the
 * kitchen) — the cheap half of per-room beds, see `ZONE_CUES`.
 *
 * And it tells the brain **how full the room is** (`roomOccupancyAt`), so an
 * office at eight in the evening waits longer between cues and what it plays
 * is the machines that run whether or not anybody is there.
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
      /*
       * Hold while a colleague is speaking. The bed handles this by *ducking*
       * (`duckRoomTone`, to 0.03); a cue cannot duck, because it is an event
       * rather than a level — by the time the line starts, a 2 s espresso
       * machine is already committed. So the director simply does not start
       * one. Without this a keyboard burst at 0.028 lands on top of a spoken
       * line, louder than the bed it is supposed to be sitting under.
       *
       * This defers rather than drops: `lastPlayedAt` is untouched, so the cue
       * the room owed you arrives on a later tick. Same check the walk-by
       * surfaces already make, and for the same reason.
       */
      if (isOfficeNarrationBusy()) return;
      const random = paramsRef.current.random ?? Math.random;
      const atDesk = getOfficeViewMode() === 'desk';
      const now = Date.now();
      const cue = pickNextSoundscapeCue({
        now,
        sessionStartedAt,
        lastPlayedAt,
        lastCue,
        atDesk,
        // Same zone the bed is already filtered for, read back from the tone
        // player so there is one answer to "which room are you in".
        zone: getRoomToneZone(),
        /*
         * Computed here rather than read back off the bed the way the zone is,
         * because it is a pure function of the clock and the store that both
         * directors can call — see `setRoomToneOccupancy`'s comment for why
         * the two cases differ. The snapshot is the one this tick already read.
         */
        occupancy: roomOccupancyAt({ now, peopleUp: peopleOutOfChairs(snapshot) }),
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
