/**
 * Short Web Audio cues for agent lifecycle. Caller gates with soundEnabled + user gesture.
 */

function getContext(audioContextRef) {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextCtor) return null;
  const ctx = audioContextRef.current ?? new AudioContextCtor();
  audioContextRef.current = ctx;
  return ctx;
}

function applyGainEnvelope(gainNode, now, peak, totalDur) {
  const attack = Math.min(0.018, totalDur * 0.22);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(peak, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);
}

/**
 * @param {{ current: AudioContext | null }} audioContextRef
 * @param {object} opts
 * @param {'sine'|'triangle'} opts.type
 * @param {number} opts.freqHz
 * @param {number} [opts.freqEndHz]
 * @param {number} opts.durationSec
 * @param {number} opts.peakGain
 */
export function playShortTone(audioContextRef, opts) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const {
    type = 'sine',
    freqHz,
    freqEndHz = freqHz,
    durationSec,
    peakGain
  } = opts;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freqHz, now);
  if (freqEndHz !== freqHz) {
    oscillator.frequency.linearRampToValueAtTime(freqEndHz, now + durationSec * 0.85);
  }
  applyGainEnvelope(gainNode, now, peakGain, durationSec);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSec + 0.02);
}

export function playStreamStartChime(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 380,
    freqEndHz: 520,
    durationSec: 0.11,
    peakGain: 0.038
  });
}

export function playToolStartChime(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 720,
    freqEndHz: 680,
    durationSec: 0.06,
    peakGain: 0.028
  });
}

export function playToolEndChime(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 520,
    freqEndHz: 640,
    durationSec: 0.07,
    peakGain: 0.026
  });
}

export function playFailureChime(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 180,
    freqEndHz: 120,
    durationSec: 0.22,
    peakGain: 0.045
  });
}

/** Very quiet tick while tokens stream; use throttling in caller. */
export function playTokenTickChime(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 880,
    durationSec: 0.028,
    peakGain: 0.012
  });
}

/** Existing completion cadence (two-note feel preserved via ramp). */
export function playCompletionChime(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(523.25, now);
  oscillator.frequency.linearRampToValueAtTime(659.25, now + 0.12);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.065, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.3);
}
