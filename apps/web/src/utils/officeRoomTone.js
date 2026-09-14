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
/**
 * Level while a colleague is speaking, so narration stays intelligible.
 *
 * Read as a *cut*, not a level: 0.03 under a 0.055 desk bed is the ~45% dip
 * this was mixed against. Anything that thins the bed has to thin the duck by
 * the same factor or the gap closes — see `targetGain`.
 */
export const ROOM_TONE_DUCK_GAIN = 0.03;

/**
 * What is left of the bed in a room with nobody in it.
 *
 * The loop is one texture carrying two things — the building (air handling, the
 * hum of a floor's worth of hardware) and the people in it (distant
 * conversation, movement). Only the second thins out after hours, and the bed
 * cannot be un-mixed, so the honest approximation is a floor: an empty office
 * still has a little over half the level, and never silence. Silence would be
 * a different bug — the room disappearing rather than emptying.
 */
export const ROOM_TONE_OCCUPANCY_FLOOR = 0.55;

const VIEW_GAIN_RAMP_SEC = 0.8;
const ZONE_RAMP_SEC = 0.55;

/** @typedef {'desk' | 'floor'} RoomToneViewMode */
/** @typedef {'neutral' | 'glass' | 'kitchen' | 'pod'} RoomToneZone */

/**
 * Per-zone colouring of the single bed (docs/audio-assets.md) — no new assets.
 * Filters reshape the open-plan loop so kitchen / glass / pod read differently
 * as you walk. True multi-bed beds still want ElevenLabs regeneration later.
 */
const ZONE_SHAPING = {
  neutral: { gainMul: 1, type: 'peaking', frequency: 800, Q: 0.7, gain: 0 },
  glass: { gainMul: 0.82, type: 'lowpass', frequency: 2400, Q: 0.7, gain: 0 },
  kitchen: { gainMul: 1.08, type: 'highshelf', frequency: 1800, Q: 0.7, gain: 3.5 },
  pod: { gainMul: 0.95, type: 'lowshelf', frequency: 220, Q: 0.7, gain: 2.2 }
};

/** @type {RoomToneViewMode} */
let viewMode = 'desk';
/** @type {RoomToneZone} */
let zone = 'neutral';
/** How full the room is, 0–1. 1 is the level the bed was mixed at. */
let occupancy = 1;

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
/** @type {BiquadFilterNode | null} */
let filterNode = null;
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

/**
 * Decode the bed during the user-gesture window so the first `startRoomTone`
 * does not wait on fetch. Safe to call from `primeOfficeAudio`.
 *
 * @param {{ current: AudioContext | null }} audioContextRef
 */
export function warmRoomTone(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  void loadBuffer(context);
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

function zoneProfile() {
  return ZONE_SHAPING[zone] ?? ZONE_SHAPING.neutral;
}

/**
 * Never anything but exactly 1 for a full room — the early return is load-bearing
 * rather than an optimisation. `0.55 + 0.45 * 1` is `0.9999999999999999` in
 * binary floating point, which would put the bed a hair off `ROOM_TONE_GAIN_DESK`
 * for every session of the working day and make the level an approximation
 * nobody asked for.
 */
function occupancyGainMul() {
  if (occupancy >= 1) return 1;
  const level = Math.max(0, occupancy);
  return ROOM_TONE_OCCUPANCY_FLOOR + (1 - ROOM_TONE_OCCUPANCY_FLOOR) * level;
}

function baseGainForView() {
  const base = viewMode === 'floor' ? ROOM_TONE_GAIN_FLOOR : ROOM_TONE_GAIN_DESK;
  return base * (viewMode === 'floor' ? zoneProfile().gainMul : 1) * occupancyGainMul();
}

/**
 * The duck rides the occupancy dial, because it was mixed for the same full
 * room the bed was.
 *
 * `ROOM_TONE_DUCK_GAIN` is absolute, so on its own it stops being a cut as the
 * bed thins: at `afterHours` occupancy (0.15) the desk bed is 0.034 and a flat
 * 0.03 duck is an 11.7% dip rather than 45.5% — a colleague speaking at 20:00
 * over a room at effectively full level, which is the one thing the duck
 * exists to prevent. Below a 0.5454 occupancy floor it would invert outright
 * and duck *up*. Multiplying by the same `occupancyGainMul()` the bed uses
 * keeps the ratio exact in every cell, and its full-room early return keeps a
 * full room byte-identical to the pre-occupancy level.
 */
function targetGain() {
  return ducked ? ROOM_TONE_DUCK_GAIN * occupancyGainMul() : baseGainForView();
}

function applyZoneFilter(rampSec = ZONE_RAMP_SEC) {
  if (!filterNode) return;
  const profile = zoneProfile();
  try {
    const now = filterNode.context.currentTime;
    filterNode.type = profile.type;
    filterNode.frequency.cancelScheduledValues(now);
    filterNode.frequency.setValueAtTime(filterNode.frequency.value, now);
    filterNode.frequency.linearRampToValueAtTime(profile.frequency, now + rampSec);
    filterNode.Q.value = profile.Q;
    filterNode.gain.cancelScheduledValues(now);
    filterNode.gain.setValueAtTime(filterNode.gain.value, now);
    filterNode.gain.linearRampToValueAtTime(profile.gain, now + rampSec);
  } catch {
    // ignore
  }
}

/**
 * Bias the bed toward desk or isometric floor. Safe to call before the bed
 * starts — the next fade-in picks up the new level.
 *
 * @param {RoomToneViewMode} mode
 */
export function setRoomToneViewMode(mode) {
  viewMode = mode === 'floor' ? 'floor' : 'desk';
  if (viewMode === 'desk') zone = 'neutral';
  applyZoneFilter();
  applyDuck();
}

/**
 * Colour the bed for the floor zone under you. Desk mode ignores this.
 *
 * @param {RoomToneZone} next
 */
export function setRoomToneZone(next) {
  const allowed = next === 'glass' || next === 'kitchen' || next === 'pod' ? next : 'neutral';
  if (zone === allowed) return;
  zone = allowed;
  applyZoneFilter();
  applyDuck();
}

/**
 * Thin the bed for a room with fewer people in it.
 *
 * Pushed by `useOfficeRoomTone` on every sync rather than polled here, for the
 * reason the whole module is passive: this file owns a `GainNode` and nothing
 * else — no clock, no store. Its sibling `useOfficeSoundscape` computes the
 * same number from `roomOccupancyAt` instead of reading it back from here,
 * which is the opposite of what the zone does two functions down. The zone has
 * exactly one knower (the floor, where you are standing) so it has to be
 * pushed once and read back; occupancy is a pure function of the clock and the
 * store, so two callers of that function cannot disagree, and a read-back
 * would only add an ordering dependency between the two directors.
 *
 * @param {number} next 0–1; out-of-range and non-finite values clamp.
 */
export function setRoomToneOccupancy(next) {
  const level = Number.isFinite(next) ? Math.min(1, Math.max(0, next)) : 1;
  if (level === occupancy) return;
  occupancy = level;
  applyDuck();
}

/** How full the bed currently thinks the room is. */
export function getRoomToneOccupancy() {
  return occupancy;
}

/**
 * Which zone the room is currently coloured for.
 *
 * Exported so the cue director can bias *which* cue plays by the same room the
 * bed is already shaped by (`ZONE_CUES` in officeSoundscape.js). Reading it back
 * from here rather than adding a second source of truth is the point: the floor
 * pushes the zone exactly once, and the two halves of "what this room sounds
 * like" — its timbre and its events — cannot drift apart.
 *
 * @returns {RoomToneZone} `'neutral'` in desk mode, which `setRoomToneViewMode`
 *   enforces, so a caller never has to check the view mode itself.
 */
export function getRoomToneZone() {
  return zone;
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

    // jsdom test stubs often omit BiquadFilter — skip colouring rather than crash.
    if (typeof context.createBiquadFilter === 'function') {
      const filter = context.createBiquadFilter();
      const profile = zoneProfile();
      filter.type = profile.type;
      filter.frequency.value = profile.frequency;
      filter.Q.value = profile.Q;
      filter.gain.value = profile.gain;
      source.connect(filter);
      filter.connect(gain);
      filterNode = filter;
    } else {
      source.connect(gain);
      filterNode = null;
    }
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
  filterNode = null;
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
  filterNode = null;
  gainNode = null;
  bufferPromise = null;
  ducked = false;
  viewMode = 'desk';
  zone = 'neutral';
  occupancy = 1;
}
