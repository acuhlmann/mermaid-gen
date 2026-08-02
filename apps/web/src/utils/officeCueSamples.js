/**
 * Sampled replacements for the office soundscape cues (docs/office-parody.md §6).
 *
 * Only the cues that synthesis genuinely loses on are sampled: broadband
 * mechanical and textural sounds, where oscillators read as synth buzz rather
 * than as a room. The cues that *are* tones — the elevator ding, the desk
 * phone ring, mouse clicks — keep their synthesized versions in
 * `agentChimes.js`, because synthesis is the right tool for a bell.
 *
 * Every sample is optional. `playCueSample` reports whether it played, and the
 * director falls back to the synthesized cue whenever it did not: while the
 * buffer is still decoding, when the asset is missing, or where Web Audio is
 * unavailable. The office never goes quiet waiting for a download.
 *
 * Assets are baked at build time — see docs/audio-assets.md.
 */
import { getContext } from './agentChimes.js';
import applauseUrl from '../assets/audio/cue-applause.mp3';
import chairUrl from '../assets/audio/cue-chair.mp3';
import chairsGatherUrl from '../assets/audio/cue-chairs-gather.mp3';
import coughUrl from '../assets/audio/cue-cough.mp3';
import crowdSettleUrl from '../assets/audio/cue-crowd-settle.mp3';
import doorUrl from '../assets/audio/cue-door-badge.mp3';
import espressoUrl from '../assets/audio/cue-espresso.mp3';
import footstepCarpetUrl from '../assets/audio/cue-footstep-carpet.mp3';
import footstepCarpetBUrl from '../assets/audio/cue-footstep-carpet-b.mp3';
import footstepHardUrl from '../assets/audio/cue-footstep-hard.mp3';
import footstepHardBUrl from '../assets/audio/cue-footstep-hard-b.mp3';
import fridgeUrl from '../assets/audio/cue-fridge.mp3';
import keyboardUrl from '../assets/audio/cue-keyboard.mp3';
import keyboardBUrl from '../assets/audio/cue-keyboard-b.mp3';
import laughUrl from '../assets/audio/cue-laugh.mp3';
import paperUrl from '../assets/audio/cue-paper.mp3';
import paperBUrl from '../assets/audio/cue-paper-b.mp3';
import phoneBuzzUrl from '../assets/audio/cue-phone-buzz.mp3';
import printerUrl from '../assets/audio/cue-printer.mp3';
import serverRackUrl from '../assets/audio/cue-server-rack.mp3';
import vendingUrl from '../assets/audio/cue-vending.mp3';
import watercoolerUrl from '../assets/audio/cue-watercooler.mp3';
import whiteboardUrl from '../assets/audio/cue-whiteboard.mp3';

/**
 * Each asset is peak-normalized to −3 dBFS (0.708 linear), so `gain` is simply
 * the hand-tuned peak the synthesized cue used, divided by 0.708 — the sampled
 * cue peaks exactly where its predecessor did, preserving a mix that was
 * already balanced against the event chimes.
 *
 * Desk textures (keyboard / paper) sit a notch louder than the original synth
 * peaks — corporate-IT typing is the room's heartbeat and was getting lost
 * under the bed. Set pieces stay at the synth-matched level for ambient plays;
 * diegetic `near` plays (you're stood at the machine) multiply by NEAR_GAIN.
 *
 * `spread` is how far across the stereo field the cue may be placed, randomly,
 * per play. Desk textures happen at *your* desk and stay centred; the set
 * pieces are somewhere else in the room, and moving them around is most of
 * what stops a repeated sample sounding like a repeated sample. A cue whose
 * caller passes an explicit `pan` (footsteps, which belong to somebody you can
 * see) uses `spread` only as the fallback when it does not.
 *
 * `urls` is a list because one recording of a frequent cue wears thin, so the
 * four cues that fire most often have a second take picked at random per play:
 * keyboard (~4× any set piece), paper, and **both footstep surfaces** — the
 * footsteps matter most, because they are the only cue that repeats inside a
 * single gesture (one per walk leg) rather than once per moment. Variants are
 * takes of *one* sound, never two sounds — they share a gain and a spread
 * because they are meant to be indistinguishable in placement and level, and
 * different only in detail. The slice-3 takes came in within ~2 dB of their
 * originals measured, which is what makes one shared gain honest.
 */
const SAMPLES = {
  keyboard: { urls: [keyboardUrl, keyboardBUrl], gain: 0.028, spread: 0.15 },
  paper: { urls: [paperUrl, paperBUrl], gain: 0.018, spread: 0.15 },
  chair: { urls: [chairUrl], gain: 0.012, spread: 0.25 },
  printer: { urls: [printerUrl], gain: 0.0099, spread: 0.7 },
  watercooler: { urls: [watercoolerUrl], gain: 0.0155, spread: 0.6 },
  espresso: { urls: [espressoUrl], gain: 0.0169, spread: 0.6 },
  vending: { urls: [vendingUrl], gain: 0.0169, spread: 0.7 },
  /*
   * Slice 2. Gains follow the same rule as the rest of this table — the synth
   * cue's hand-tuned `peakGain` ÷ 0.708 — except that these had no predecessor,
   * so the peak is the one written for their fallback in `agentChimes.js`,
   * chosen against the existing 0.006–0.014 range. First candidates for a
   * by-ear pass (docs/audio-assets.md open item 6).
   *
   * Footsteps are pitched deliberately below that derivation. Every other cue
   * fires at most once per moment; a footstep fires once per walk leg, so it is
   * the only sample that repeats *within* a single gesture, and repetitive plus
   * loud is the shortest path to a sound people turn off.
   */
  footstepCarpet: { urls: [footstepCarpetUrl, footstepCarpetBUrl], gain: 0.007, spread: 0.5 },
  footstepHard: { urls: [footstepHardUrl, footstepHardBUrl], gain: 0.007, spread: 0.5 },
  chairsGather: { urls: [chairsGatherUrl], gain: 0.0099, spread: 0.3 },
  /*
   * `spread` was 0 while the door was Day-One-only: that play passes `near`,
   * and `makePanner` short-circuits on `near` before it ever reads `spread`,
   * so the field was dead either way. Now that the door also plays ambiently
   * it needs the widest placement in the table — the entrance is the one thing
   * in this room that is definitely not where you are sitting. The Day One
   * check-in is unaffected for the same reason it always was.
   */
  door: { urls: [doorUrl], gain: 0.0127, spread: 0.8 },
  whiteboard: { urls: [whiteboardUrl], gain: 0.0085, spread: 0.3 },
  fridge: { urls: [fridgeUrl], gain: 0.0099, spread: 0.6 },
  /*
   * Slice 3, and a different derivation — see docs/audio-assets.md.
   *
   * Everything above inherits `synthPeakGain / 0.708` from the cue it replaced.
   * These have no predecessor **and no synth fallback** (below), so that rule
   * has nothing to inherit from. They are matched by measured **integrated
   * loudness** instead: gain = 10^((target − LUFS)/20), where `target` is the
   * effective playback level in dB. That is the number the peak-normalizing
   * pipeline cannot give you — it equalizes peaks, and a 2 s phone buzz has far
   * more energy under an identical peak than a paper shuffle does.
   *
   * The shipped table turns out to already work this way, it just never said
   * so: keyboard is the *quietest* source (−28.1 LUFS) and carries the
   * *highest* gain (0.028), landing at −59 dB effective, while the printer
   * (−14.9 LUFS, gain 0.0099) lands at −55. The range in use is −55 (printer,
   * the most present set piece) to −71 (footsteps, the only cue that repeats
   * inside one gesture).
   *
   * Targets chosen against that range: −63/−64 for the ambient people and the
   * server rack (present but never the subject), −58 for the two all-hands
   * cues (they *are* the moment). Loudness-matching is not attention-matching,
   * though — a laugh pulls the ear harder than a printer at the same LUFS — so
   * these still want the ear pass that open item 6 describes.
   */
  laugh: { urls: [laughUrl], gain: 0.0034, spread: 0.85 },
  cough: { urls: [coughUrl], gain: 0.0056, spread: 0.8 },
  phoneBuzz: { urls: [phoneBuzzUrl], gain: 0.002, spread: 0.7 },
  serverRack: { urls: [serverRackUrl], gain: 0.003, spread: 0.75 },
  // The all-hands pair. Centred: you are in the room, not beside it.
  crowdSettle: { urls: [crowdSettleUrl], gain: 0.009, spread: 0.2 },
  applause: { urls: [applauseUrl], gain: 0.011, spread: 0.2 }
};

/** Standing next to the source — louder, centred, not "down the hall". */
const NEAR_GAIN = 2.2;

/** Cues with a sampled version. The rest stay synthesized on purpose. */
export const SAMPLED_CUES = Object.keys(SAMPLES);

/** Per-play variation, so the twentieth keystroke burst is not the first one. */
const RATE_JITTER = 0.04;
const GAIN_JITTER = 0.18;

/** @type {Map<string, AudioBuffer>} */
const buffers = new Map();
/** @type {Set<string>} */
const loading = new Set();

/** Clamp a caller-supplied pan into StereoPanner's range, or `null` if absent. */
function toPan(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(-1, Math.min(1, value));
}

/**
 * Where in the stereo field this play sits, or `null` for dead centre (which
 * costs a node and is the right answer for `near`).
 *
 * @returns {StereoPannerNode | null}
 */
function makePanner(context, { near, entry, random, pan }) {
  if (near || typeof context.createStereoPanner !== 'function') return null;
  const fixed = toPan(pan);
  if (fixed === null && !(entry.spread > 0)) return null;
  const panner = context.createStereoPanner();
  panner.pan.value = fixed ?? (random() * 2 - 1) * entry.spread;
  return panner;
}

function decodeAudio(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const maybePromise = context.decodeAudioData(arrayBuffer, resolve, reject);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve, reject);
    }
  });
}

/**
 * Fetch and decode one variant in the background. The play that triggered this
 * falls back to synthesis; the next one gets the sample.
 */
function warmVariant(cue, index, url, context) {
  const key = `${cue}:${index}`;
  if (buffers.has(key) || loading.has(key) || typeof fetch !== 'function') return;
  loading.add(key);
  void fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((arrayBuffer) => (arrayBuffer ? decodeAudio(context, arrayBuffer) : null))
    .then((buffer) => {
      if (buffer) buffers.set(key, buffer);
    })
    .catch(() => {
      // Leave this variant unsampled — the cue keeps its synthesized version,
      // or its other variants if any of those decoded.
    })
    .finally(() => {
      loading.delete(key);
    });
}

/** Warm every variant of a cue. */
function warm(cue, context) {
  const entry = SAMPLES[cue];
  if (!entry) return;
  entry.urls.forEach((url, index) => warmVariant(cue, index, url, context));
}

/**
 * One decoded variant at random, or `null` if none are ready yet.
 *
 * Chooses among the variants that have actually decoded rather than rolling
 * first and checking second: a cue whose take A is warm and take B is not
 * would otherwise fall back to synthesis half the time for no reason.
 */
function pickBuffer(cue, entry, random) {
  const ready = [];
  for (let i = 0; i < entry.urls.length; i += 1) {
    const buffer = buffers.get(`${cue}:${i}`);
    if (buffer) ready.push(buffer);
  }
  if (ready.length === 0) return null;
  return ready[Math.min(ready.length - 1, Math.floor(random() * ready.length))];
}

/**
 * Play the sampled version of a cue.
 *
 * @param {string} cue
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {() => number} [random]
 * @param {{ near?: boolean, pan?: number }} [options] `near` = standing at the
 *   source (louder, centred). `pan` (-1..1) places the cue explicitly instead of
 *   randomly within `spread` — random placement is what stops a *repeated*
 *   sample sounding repeated, but a cue that belongs to somebody visible has to
 *   come from where they are, or the sound and the picture disagree. `near`
 *   still wins: standing at the source is centred by definition.
 * @returns {boolean} whether the sample played — false means "use the synth cue"
 */
export function playCueSample(cue, audioContextRef, random = Math.random, options = {}) {
  const entry = SAMPLES[cue];
  if (!entry) return false;
  const context = getContext(audioContextRef);
  if (!context || typeof context.createBufferSource !== 'function') return false;

  const buffer = pickBuffer(cue, entry, random);
  if (!buffer) {
    warm(cue, context);
    return false;
  }

  const near = Boolean(options?.near);
  try {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1 + (random() * 2 - 1) * RATE_JITTER;

    const gainNode = context.createGain();
    const base = entry.gain * (near ? NEAR_GAIN : 1);
    gainNode.gain.value = base * (1 + (random() * 2 - 1) * GAIN_JITTER);

    const panner = makePanner(context, { near, entry, random, pan: options?.pan });
    let tail = gainNode;
    if (panner) {
      gainNode.connect(panner);
      tail = panner;
    }

    source.connect(gainNode);
    tail.connect(context.destination);
    source.start(context.currentTime);
    return true;
  } catch {
    return false;
  }
}

export function _resetCueSamplesForTests() {
  buffers.clear();
  loading.clear();
}

/**
 * Kick off decoding for every sampled cue. Call once the sound gate is open so
 * the first diegetic play (printer, espresso) is a sample, not a synth fallback.
 *
 * @param {{ current: AudioContext | null }} audioContextRef
 */
export function warmAllCueSamples(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  for (const cue of Object.keys(SAMPLES)) warm(cue, context);
}
