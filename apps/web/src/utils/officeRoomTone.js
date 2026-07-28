/**
 * Continuous room-tone bed for the office soundscape (docs/office-parody.md §6).
 *
 * The cues in agentChimes.js are *events* in the room; this is the room. One
 * ~30 s seamless loop, generated once at build time and committed
 * (docs/audio-assets.md) — decoded to a single AudioBuffer and reused for the
 * whole session, so after the first fetch there is no network, no LLM, and no
 * third-party runtime dependency. The office still works offline.
 *
 * Lifecycle belongs to useOfficeRoomTone; every entry point here is idempotent
 * and degrades to a silent no-op where AudioContext, fetch, or decodeAudioData
 * are missing (jsdom tests, old browsers, blocked autoplay).
 */
import { getContext } from './agentChimes.js';
import roomToneUrl from '../assets/audio/office-room-tone.mp3';

/**
 * Playback level for the −24 LUFS source. The bed must read as *underneath*
 * the cues, which peak at 0.006–0.014 (see agentChimes.js). Desk mode keeps
 * the room subtle under your screen; isometric floor mode lets the office
 * breathe a little louder so the soundscape matches what you are looking at.
 */
export const ROOM_TONE_GAIN_DESK = 0.055;
export const ROOM_TONE_GAIN_FLOOR = 0.115;
/** @deprecated alias — desk level; tests and duck restore use the active view gain. */
export const ROOM_TONE_GAIN = ROOM_TONE_GAIN_DESK;
/** Level while a colleague is speaking, so narration stays intelligible. */
export const ROOM_TONE_DUCK_GAIN = 0.03;

const VIEW_GAIN_RAMP_SEC = 0.8;

/** @typedef {'desk' | 'floor'} RoomToneViewMode */

/** @type {RoomToneViewMode} */
let viewMode = 'desk';

const FADE_IN_SEC = 3;
const FADE_OUT_SEC = 1.2;
const DUCK_SEC = 0.3;
/**
 * Skipped at both loop edges. The asset itself is seam-clean (verified: no
 * silence padding, wrap-around sample step well inside the interior range),
 * but MP3 carries 576–1105 samples of encoder delay and browsers that ignore
 * LAME's gapless header would click once per lap. 30 ms ≈ 1323 samples covers
 * the worst case, and losing 30 ms of diffuse room tone is inaudible.
 */
const LOOP_EDGE_GUARD_SEC = 0.03;

/** @type {Promise<AudioBuffer | null> | null} */
let bufferPromise = null;
/** @type {AudioBufferSourceNode | null} */
let sourceNode = null;
/** @type {GainNode | null} */
let gainNode = null;
/** Bumped on every stop so an in-flight decode can tell it was superseded. */
let generation = 0;
let ducked = false;

function decodeAudio(context, arrayBuffer) {
  return new Promise((resolve, reject) => {
    // Safari kept the callback form long after everyone else moved to promises.
    const maybePromise = context.decodeAudioData(arrayBuffer, resolve, reject);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve, reject);
    }
  });
}

function loadBuffer(context) {
  if (bufferPromise) return bufferPromise;
  if (typeof fetch !== 'function') return Promise.resolve(null);
  bufferPromise = fetch(roomToneUrl)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .then((arrayBuffer) => (arrayBuffer ? decodeAudio(context, arrayBuffer) : null))
    .catch(() => {
      // A missing or undecodable bed is not worth a broken office — the
      // discrete cues carry the room on their own.
      bufferPromise = null;
      return null;
    });
  return bufferPromise;
}

function baseGainForView() {
  return viewMode === 'floor' ? ROOM_TONE_GAIN_FLOOR : ROOM_TONE_GAIN_DESK;
}

function targetGain() {
  return ducked ? ROOM_TONE_DUCK_GAIN : baseGainForView();
}

/**
 * Bias the bed toward desk or isometric floor. Safe to call before the bed
 * starts — the next fade-in picks up the new level.
 *
 * @param {RoomToneViewMode} mode
 */
export function setRoomToneViewMode(mode) {
  viewMode = mode === 'floor' ? 'floor' : 'desk';
  applyDuck();
}

/**
 * Start the bed, or do nothing if it is already playing. Safe to call on every
 * tick — that is how the director self-heals after the sound gate opens.
 *
 * @param {{ current: AudioContext | null }} audioContextRef
 */
export function startRoomTone(audioContextRef) {
  if (sourceNode) return;
  const context = getContext(audioContextRef);
  if (!context || typeof context.createBufferSource !== 'function') return;
  // A context created before the first gesture starts suspended; the caller's
  // sound gate means a gesture has happened by now, so this resolves.
  context.resume?.().catch(() => {});

  const startedAt = generation;
  void loadBuffer(context).then((buffer) => {
    // Superseded by a stop (or an earlier start won the race) while decoding.
    if (!buffer || generation !== startedAt || sourceNode) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const guard = Math.min(LOOP_EDGE_GUARD_SEC, buffer.duration / 4);
    source.loopStart = guard;
    source.loopEnd = Math.max(guard, buffer.duration - guard);

    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(targetGain(), now + FADE_IN_SEC);

    source.connect(gain);
    gain.connect(context.destination);
    source.start(now, source.loopStart);

    sourceNode = source;
    gainNode = gain;
  });
}

/** Fade the bed out and release it. Idempotent; never needs the sound gate. */
export function stopRoomTone() {
  generation += 1;
  const source = sourceNode;
  const gain = gainNode;
  sourceNode = null;
  gainNode = null;
  ducked = false;
  if (!source) return;
  try {
    const context = gain?.context;
    const now = context?.currentTime ?? 0;
    gain?.gain.cancelScheduledValues(now);
    gain?.gain.setValueAtTime(gain.gain.value, now);
    gain?.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT_SEC);
    source.stop(now + FADE_OUT_SEC);
  } catch {
    // Already stopped, or a context that will not schedule — nothing to undo.
  }
}

/** Pull the bed down under narration. No-op when the bed is not playing. */
export function duckRoomTone() {
  ducked = true;
  applyDuck();
}

/** Restore the bed after narration finishes. */
export function unduckRoomTone() {
  ducked = false;
  applyDuck();
}

function applyDuck() {
  if (!gainNode) return;
  try {
    const now = gainNode.context.currentTime;
    const rampSec = ducked ? DUCK_SEC : VIEW_GAIN_RAMP_SEC;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetGain(), now + rampSec);
  } catch {
    // ignore
  }
}

/** True while a bed is playing — lets the director skip redundant work. */
export function isRoomTonePlaying() {
  return sourceNode !== null;
}

export function _resetRoomToneForTests() {
  generation += 1;
  sourceNode = null;
  gainNode = null;
  bufferPromise = null;
  ducked = false;
  viewMode = 'desk';
}
