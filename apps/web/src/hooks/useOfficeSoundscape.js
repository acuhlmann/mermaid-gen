import { useEffect, useRef } from 'react';
import {
  playChairSqueak,
  playDeskPhone,
  playDistantPrinter,
  playElevatorDing,
  playEspressoMachine,
  playKeyboardClatter,
  playMouseClicks,
  playPaperShuffle,
  playVendingMachine,
  playWaterCooler
} from '../utils/agentChimes.js';
import { playCueSample } from '../utils/officeCueSamples.js';
import { pickNextSoundscapeCue } from '../utils/officeSoundscape.js';
import { getOfficeSnapshot } from '../state/officeMomentStore.js';

export const SOUNDSCAPE_TICK_MS = 5_000;

const SYNTH_CUE_PLAYERS = {
  keyboard: playKeyboardClatter,
  mouse: playMouseClicks,
  paper: playPaperShuffle,
  printer: playDistantPrinter,
  chair: playChairSqueak,
  phone: playDeskPhone,
  watercooler: playWaterCooler,
  espresso: playEspressoMachine,
  vending: playVendingMachine,
  elevator: playElevatorDing
};

/**
 * Sampled where a real recording beats synthesis, synthesized otherwise — and
 * synthesized anyway whenever the sample has not finished decoding, so a cue is
 * never dropped waiting on a download.
 *
 * @param {string} cue
 * @param {() => number} random
 */
function cuePlayerFor(cue, random) {
  return (audioContextRef) => {
    if (playCueSample(cue, audioContextRef, random)) return;
    SYNTH_CUE_PLAYERS[cue]?.(audioContextRef);
  };
}

/**
 * Office soundscape director (docs/office-parody.md): a tiny sibling of
 * useOfficeAmbience that ticks and asks the pure brain in officeSoundscape.js
 * when to play a room-tone cue. Holds while the tab is hidden, during Focus
 * Time (the whole office is muted), or when the user switched the soundscape
 * off in the inbox dock; `playChime` is App's sound gate (soundEnabled +
 * user gesture), so a muted app stays silent for free.
 *
 * Cues resolve through `cuePlayerFor`, which prefers a baked sample and falls
 * back to synthesis. The continuous bed underneath is a separate concern —
 * see useOfficeRoomTone.
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
      const cue = pickNextSoundscapeCue({
        now: Date.now(),
        sessionStartedAt,
        lastPlayedAt,
        lastCue,
        random
      });
      if (!cue) return;
      lastPlayedAt = Date.now();
      lastCue = cue;
      paramsRef.current.playChime?.(cuePlayerFor(cue, random));
    };

    const interval = setInterval(tick, SOUNDSCAPE_TICK_MS);
    return () => clearInterval(interval);
  }, []);
}
