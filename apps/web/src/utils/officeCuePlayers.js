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
  playChairsGather,
  playDeskPhone,
  playDistantPrinter,
  playDoorSwing,
  playElevatorDing,
  playEspressoMachine,
  playFootstepPair,
  playFridgeDoor,
  playKeyboardClatter,
  playMouseClicks,
  playPaperShuffle,
  playPhoneBuzz,
  playServerRack,
  playVendingMachine,
  playWaterCooler,
  playWhiteboardSqueak
} from './agentChimes.js';
import { playCueSample, warmAllCueSamples } from './officeCueSamples.js';

/**
 * `playOfficeCue` falls through to this table whenever the buffer is missing or
 * still decoding, so a cue with no synth row is silent on its first play — and
 * for the door, the first play used to be the only play.
 *
 * Nearly every cue therefore needs a row. The exceptions are listed in
 * `SILENT_UNTIL_SAMPLED` below, where silence is the better answer than any
 * fallback that could be built.
 *
 * Both footstep surfaces share one synth fallback deliberately: the difference
 * between carpet and vinyl is exactly the kind of thing synthesis cannot sell,
 * which is why they are sampled in the first place.
 */
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
  elevator: playElevatorDing,
  footstepCarpet: playFootstepPair,
  footstepHard: playFootstepPair,
  chairsGather: playChairsGather,
  door: playDoorSwing,
  whiteboard: playWhiteboardSqueak,
  fridge: playFridgeDoor,
  // Slice 3. Both synthesize acceptably: a vibrating motor is a narrow-band
  // rattle and a server rack is fan hiss over a fundamental. Neither is a
  // person, which is the line the set below draws.
  phoneBuzz: playPhoneBuzz,
  serverRack: playServerRack
};

/**
 * Which cues can make a sound at all. Exported as names rather than as the
 * table itself: a caller reaching for a player directly would skip the
 * sample-first path, which is the one thing this module exists to enforce.
 */
export const SYNTH_CUES = Object.keys(SYNTH_CUE_PLAYERS);

/**
 * Cues that are **deliberately silent** until their buffer decodes.
 *
 * Every cue before slice 3 has a synth fallback, and the rule that produced
 * them — "sample broadband texture, synthesize tones" — assumed the fallback
 * was always at least *worth having*. These four break that assumption: they
 * are people and crowds, and there is no oscillator arrangement that is better
 * than nothing for a cough. A synthesized laugh would not read as a cheap
 * laugh, it would read as a bug.
 *
 * Silence costs almost nothing here. `primeOfficeAudio` warms every sample the
 * moment the audio gate opens, the soundscape brain will not schedule anything
 * for the first 4 s of a session, and these are ambient or once-per-meeting —
 * so the realistic worst case is that the room happens to be quiet that time,
 * which is a thing offices do.
 *
 * This is an allowlist, not an escape hatch: `officeCuePlayers.test.js` asserts
 * every sampled cue is either in `SYNTH_CUES` or named here, so a cue cannot
 * lose its fallback by accident — only on purpose, in this list, with a reason.
 */
export const SILENT_UNTIL_SAMPLED = ['laugh', 'cough', 'crowdSettle', 'applause'];

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
      // Floor coffee auto-accepts; OfficeLayer plays espresso on accept. A
      // watercooler glug first sells the kitchen without doubling the machine.
      return [{ cue: 'watercooler', near: true }];
    case 'printer':
      // Motor first, then the one page that says "soon".
      return [
        { cue: 'printer', near: true },
        { cue: 'paper', near: true, delayMs: 1_600 }
      ];
    case 'waterCooler':
      return [{ cue: 'watercooler', near: true }];
    case 'whiteboard':
      // The one usable prop that was reachable and still silent — it has been
      // in FLOOR_PROP_USES since slice 9 and never had a row here.
      return [{ cue: 'whiteboard', near: true }];
    default:
      return [];
  }
}

/**
 * @param {string} cue
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {{ random?: () => number, near?: boolean, pan?: number }} [options]
 */
export function playOfficeCue(cue, audioContextRef, options = {}) {
  const { random = Math.random, near = false, pan } = options;
  if (!warmedAll) {
    warmAllCueSamples(audioContextRef);
    warmedAll = true;
  }
  if (playCueSample(cue, audioContextRef, random, { near, pan })) return;
  SYNTH_CUE_PLAYERS[cue]?.(audioContextRef);
}

/**
 * Adapter for App's `playChime` gate: `playChime(officeCueChime('printer'))`.
 *
 * @param {string} cue
 * @param {{ random?: () => number, near?: boolean, pan?: number }} [options]
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
