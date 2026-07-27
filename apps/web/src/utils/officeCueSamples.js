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
import chairUrl from '../assets/audio/cue-chair.mp3';
import espressoUrl from '../assets/audio/cue-espresso.mp3';
import keyboardUrl from '../assets/audio/cue-keyboard.mp3';
import paperUrl from '../assets/audio/cue-paper.mp3';
import printerUrl from '../assets/audio/cue-printer.mp3';
import vendingUrl from '../assets/audio/cue-vending.mp3';
import watercoolerUrl from '../assets/audio/cue-watercooler.mp3';

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
 * what stops a repeated sample sounding like a repeated sample.
 */
const SAMPLES = {
  keyboard: { url: keyboardUrl, gain: 0.028, spread: 0.15 },
  paper: { url: paperUrl, gain: 0.018, spread: 0.15 },
  chair: { url: chairUrl, gain: 0.012, spread: 0.25 },
  printer: { url: printerUrl, gain: 0.0099, spread: 0.7 },
  watercooler: { url: watercoolerUrl, gain: 0.0155, spread: 0.6 },
  espresso: { url: espressoUrl, gain: 0.0169, spread: 0.6 },
  vending: { url: vendingUrl, gain: 0.0169, spread: 0.7 }
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

function decodeAudio(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const maybePromise = context.decodeAudioData(arrayBuffer, resolve, reject);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve, reject);
    }
  });
}

/**
 * Fetch and decode in the background. The play that triggered this falls back
 * to synthesis; the next one gets the sample.
 */
function warm(cue, context) {
  if (buffers.has(cue) || loading.has(cue) || typeof fetch !== 'function') return;
  const entry = SAMPLES[cue];
  if (!entry) return;
  loading.add(cue);
  void fetch(entry.url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((arrayBuffer) => (arrayBuffer ? decodeAudio(context, arrayBuffer) : null))
    .then((buffer) => {
      if (buffer) buffers.set(cue, buffer);
    })
    .catch(() => {
      // Leave the cue unsampled — it keeps playing its synthesized version.
    })
    .finally(() => {
      loading.delete(cue);
    });
}

/**
 * Play the sampled version of a cue.
 *
 * @param {string} cue
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {() => number} [random]
 * @param {{ near?: boolean }} [options] `near` = standing at the source (louder, centred)
 * @returns {boolean} whether the sample played — false means "use the synth cue"
 */
export function playCueSample(cue, audioContextRef, random = Math.random, options = {}) {
  const entry = SAMPLES[cue];
  if (!entry) return false;
  const context = getContext(audioContextRef);
  if (!context || typeof context.createBufferSource !== 'function') return false;

  const buffer = buffers.get(cue);
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

    let tail = gainNode;
    const spread = near ? 0 : entry.spread;
    if (spread > 0 && typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.value = (random() * 2 - 1) * spread;
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
