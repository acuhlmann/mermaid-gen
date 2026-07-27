/**
 * Sample-first office cue players (docs/office-parody.md §6, docs/audio-assets.md).
 *
 * One path for ambient soundscape ticks *and* diegetic events (walk up to the
 * printer, accept a coffee break, stand up from the chair). Prefers the baked
 * ElevenLabs sample; falls back to the synthesized cue in agentChimes.js
 * whenever the buffer is still warming, missing, or Web Audio is unavailable.
 */
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
} from './agentChimes.js';
import { playCueSample, warmAllCueSamples } from './officeCueSamples.js';

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

let warmedAll = false;

/**
 * Diegetic prop → cue sequence. Ambient watercooler/espresso still fire from
 * the soundscape brain; these are what you hear when *you* walk up and use the
 * thing. The water cooler is scenery-only today (§6 rule 21) but keeps a row so
 * a future mark lights up without a second wiring pass.
 *
 * @param {string} propKind
 * @returns {Array<{ cue: string, near?: boolean, delayMs?: number }>}
 */
export function cuesForProp(propKind) {
  switch (propKind) {
    case 'coffeeMachine':
      // Floor coffee auto-accepts; OfficeLayer already plays espresso on accept.
      // Playing here too would double. Ambient invites use the accept path only.
      return [];
    case 'printer':
      // Motor first, then the one page that says "soon".
      return [
        { cue: 'printer', near: true },
        { cue: 'paper', near: true, delayMs: 1_600 }
      ];
    case 'waterCooler':
      return [{ cue: 'watercooler', near: true }];
    default:
      return [];
  }
}

/**
 * @param {string} cue
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {{ random?: () => number, near?: boolean }} [options]
 */
export function playOfficeCue(cue, audioContextRef, options = {}) {
  const { random = Math.random, near = false } = options;
  if (!warmedAll) {
    warmAllCueSamples(audioContextRef);
    warmedAll = true;
  }
  if (playCueSample(cue, audioContextRef, random, { near })) return;
  SYNTH_CUE_PLAYERS[cue]?.(audioContextRef);
}

/**
 * Adapter for App's `playChime` gate: `playChime(officeCueChime('printer'))`.
 *
 * @param {string} cue
 * @param {{ random?: () => number, near?: boolean }} [options]
 * @returns {(audioContextRef: { current: AudioContext | null }) => void}
 */
export function officeCueChime(cue, options = {}) {
  return (audioContextRef) => playOfficeCue(cue, audioContextRef, options);
}

/**
 * Fire every cue in a prop sequence through `playChime`, honouring delays.
 *
 * @param {string} propKind
 * @param {(playFn: (ref: object) => void) => void} [playChime]
 * @param {{ random?: () => number }} [options]
 * @returns {() => void} cancel pending follow-ups
 */
export function playPropCues(propKind, playChime, options = {}) {
  if (!playChime) return () => {};
  const timers = [];
  for (const step of cuesForProp(propKind)) {
    const fire = () => playChime(officeCueChime(step.cue, { ...options, near: step.near }));
    if (step.delayMs && step.delayMs > 0) {
      timers.push(setTimeout(fire, step.delayMs));
    } else {
      fire();
    }
  }
  return () => {
    for (const id of timers) clearTimeout(id);
  };
}
