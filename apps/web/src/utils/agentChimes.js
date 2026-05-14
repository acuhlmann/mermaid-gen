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

export function playRefineStreamStart(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 440,
    freqEndHz: 554,
    durationSec: 0.1,
    peakGain: 0.036
  });
}

export function playInnovateStreamStart(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 622,
    freqEndHz: 784,
    durationSec: 0.12,
    peakGain: 0.035
  });
}

/** Ascending triad — unmistakably “something extra is happening”. */
export function playGoMadStreamStart(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const freqs = [392, 523.25, 659.25];
  freqs.forEach((freq, i) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'triangle';
    const t0 = now + i * 0.044;
    oscillator.frequency.setValueAtTime(freq, t0);
    applyGainEnvelope(gainNode, t0, 0.03, 0.084);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + 0.1);
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

/** Playful chatter while Go Mad streams; `tickIndex` varies pitch. */
export function playGoMadTokenTick(audioContextRef, tickIndex = 0) {
  const freqs = [720, 840, 660, 910, 780, 990];
  const f = freqs[Math.abs(tickIndex) % freqs.length];
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: f,
    durationSec: 0.022,
    peakGain: 0.014
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

/** Low thunk on prompt submit — confirms the action even before SSE opens. */
export function playSubmitThunk(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 160,
    freqEndHz: 100,
    durationSec: 0.08,
    peakGain: 0.045
  });
}

/** Very quiet click while the live infographic draft updates; caller throttles. */
export function playDraftTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 1320,
    durationSec: 0.018,
    peakGain: 0.009
  });
}

/** Sweep when the user flips content mode (mermaid <-> infographic). */
export function playModeSwoosh(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 240,
    freqEndHz: 480,
    durationSec: 0.18,
    peakGain: 0.03
  });
}

/** Three-note arpeggio synced to the canvas-confetti burst on RUN_FINISHED. */
export function playConfettiPop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [
    { freq: 659.25, dur: 0.06, peak: 0.04 },
    { freq: 880.0, dur: 0.06, peak: 0.04 },
    { freq: 1174.66, dur: 0.08, peak: 0.038 }
  ];
  let offset = 0;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    const t0 = now + offset;
    oscillator.frequency.setValueAtTime(note.freq, t0);
    applyGainEnvelope(gainNode, t0, note.peak, note.dur);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + note.dur + 0.02);
    offset += note.dur * 0.55;
  }
}

/** Short fanfare when Go Mad completes. */
export function playGoMadCompletionChime(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [
    { freq: 523.25, dur: 0.068, peak: 0.054 },
    { freq: 659.25, dur: 0.068, peak: 0.056 },
    { freq: 783.99, dur: 0.085, peak: 0.05 },
    { freq: 1046.5, dur: 0.11, peak: 0.042 }
  ];
  let offset = 0;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'triangle';
    const t0 = now + offset;
    oscillator.frequency.setValueAtTime(note.freq, t0);
    applyGainEnvelope(gainNode, t0, note.peak, note.dur);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + note.dur + 0.02);
    offset += note.dur * 0.68;
  }
}
