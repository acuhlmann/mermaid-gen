/**
 * Short Web Audio cues for agent lifecycle. Caller gates with soundEnabled + user gesture.
 */

/** Shared lazily-created AudioContext. Also used by officeRoomTone.js so the
 * continuous bed and the discrete cues live on one context. */
export function getContext(audioContextRef) {
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
  const { type = 'sine', freqHz, freqEndHz = freqHz, durationSec, peakGain } = opts;
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

export function playGilfoyleStreamStart(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 440,
    freqEndHz: 554,
    durationSec: 0.1,
    peakGain: 0.036
  });
}

/** Dinesh: same family as Gilfoyle, a shade higher and quicker. */
export function playDineshStreamStart(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 494,
    freqEndHz: 622,
    durationSec: 0.09,
    peakGain: 0.036
  });
}

export function playErlichStreamStart(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 622,
    freqEndHz: 784,
    durationSec: 0.12,
    peakGain: 0.035
  });
}

/** Ascending triad — unmistakably “something extra is happening”. */
export function playRussStreamStart(audioContextRef) {
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

/** Playful chatter while Russ streams; `tickIndex` varies pitch. */
export function playRussTokenTick(audioContextRef, tickIndex = 0) {
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

/** ────────────────────────────────────────────────────────────────
 *  Slopitect Cinematic Universe — boot stingers, completion fanfares,
 *  streak/combo/achievement stingers, and per-variant token ticks.
 *  All synthesized — no external assets. Caller gates with soundEnabled.
 *  ──────────────────────────────────────────────────────────────── */

function playToneSeq(audioContextRef, notes, { type = 'triangle', stagger = 0.6 } = {}) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  let offset = 0;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = note.type || type;
    const t0 = now + offset;
    oscillator.frequency.setValueAtTime(note.freq, t0);
    if (note.freqEnd) {
      oscillator.frequency.linearRampToValueAtTime(note.freqEnd, t0 + note.dur * 0.85);
    }
    applyGainEnvelope(gainNode, t0, note.peak ?? 0.04, note.dur);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + note.dur + 0.02);
    offset += note.dur * stagger;
  }
}

/** Gilfoyle boot: gentle ascending two-note chrome shine. */
export function playGilfoyleBoot(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 523.25, dur: 0.07, peak: 0.04 },
      { freq: 783.99, dur: 0.09, peak: 0.038 }
    ],
    { type: 'triangle', stagger: 0.55 }
  );
}

/** Dinesh boot: Gilfoyle's two-note shine plus one extra note nobody asked for. */
export function playDineshBoot(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 587.33, dur: 0.06, peak: 0.04 },
      { freq: 880.0, dur: 0.07, peak: 0.038 },
      { freq: 987.77, dur: 0.08, peak: 0.034 }
    ],
    { type: 'triangle', stagger: 0.5 }
  );
}

/** Erlich boot: synthwave riser (sawtooth sweep up) — a visionary enters. */
export function playErlichBoot(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(200, now);
  oscillator.frequency.exponentialRampToValueAtTime(900, now + 0.32);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.4);
  // synth-pluck cap on top
  playToneSeq(audioContextRef, [{ freq: 1318.5, dur: 0.06, peak: 0.045, type: 'square' }], {
    stagger: 1
  });
}

/** Russ boot: airhorn-ish three-note hit. Loud and unhinged but brief. */
export function playRussBoot(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // Klaxon: two detuned sawtooths swirling down.
  for (const detune of [-7, 7]) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.36);
    oscillator.detune.setValueAtTime(detune, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.05, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.45);
  }
  // BONK low-end thud.
  const bonk = context.createOscillator();
  const bonkGain = context.createGain();
  bonk.type = 'sine';
  bonk.frequency.setValueAtTime(110, now + 0.04);
  bonk.frequency.exponentialRampToValueAtTime(40, now + 0.18);
  bonkGain.gain.setValueAtTime(0.0001, now + 0.04);
  bonkGain.gain.exponentialRampToValueAtTime(0.09, now + 0.07);
  bonkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  bonk.connect(bonkGain);
  bonkGain.connect(context.destination);
  bonk.start(now + 0.04);
  bonk.stop(now + 0.25);
}

/** Jared boot: clipboard slam + typewriter ding. */
export function playJaredBoot(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // slam: low-mid square pulse
  const slam = context.createOscillator();
  const slamGain = context.createGain();
  slam.type = 'square';
  slam.frequency.setValueAtTime(180, now);
  slam.frequency.exponentialRampToValueAtTime(80, now + 0.1);
  slamGain.gain.setValueAtTime(0.0001, now);
  slamGain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
  slamGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  slam.connect(slamGain);
  slamGain.connect(context.destination);
  slam.start(now);
  slam.stop(now + 0.16);
  // ding
  playToneSeq(audioContextRef, [{ freq: 1760, dur: 0.12, peak: 0.038, type: 'sine' }]);
}

/** Explain boot: scroll-unfurl soft chime (two-note open fifth). */
export function playRichardBoot(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 392, dur: 0.18, peak: 0.04, type: 'triangle' },
      { freq: 587.33, dur: 0.22, peak: 0.045, type: 'triangle' }
    ],
    { stagger: 0.55 }
  );
}

export function playGilfoyleCompletion(audioContextRef) {
  playToneSeq(audioContextRef, [
    { freq: 659.25, dur: 0.07, peak: 0.045 },
    { freq: 880.0, dur: 0.09, peak: 0.04 }
  ]);
}

/** Dinesh completion: the resolve, then one insistent repeat of the last note. */
export function playDineshCompletion(audioContextRef) {
  playToneSeq(audioContextRef, [
    { freq: 739.99, dur: 0.06, peak: 0.045 },
    { freq: 987.77, dur: 0.07, peak: 0.042 },
    { freq: 987.77, dur: 0.08, peak: 0.034 }
  ]);
}

export function playErlichCompletion(audioContextRef) {
  playToneSeq(audioContextRef, [
    { freq: 739.99, dur: 0.07, peak: 0.05, type: 'square' },
    { freq: 987.77, dur: 0.09, peak: 0.045, type: 'square' },
    { freq: 1318.5, dur: 0.12, peak: 0.04, type: 'sine' }
  ]);
}

export function playJaredCompletion(audioContextRef) {
  // red-pen ding then stamp
  playToneSeq(
    audioContextRef,
    [
      { freq: 1568, dur: 0.07, peak: 0.04, type: 'sine' },
      { freq: 220, dur: 0.13, peak: 0.045, type: 'triangle' }
    ],
    { stagger: 0.7 }
  );
}

export function playRichardCompletion(audioContextRef) {
  // gentle plagal cadence
  playToneSeq(audioContextRef, [
    { freq: 523.25, dur: 0.09, peak: 0.04 },
    { freq: 659.25, dur: 0.09, peak: 0.04 },
    { freq: 783.99, dur: 0.12, peak: 0.04 }
  ]);
}

export function playGilfoyleTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 1050,
    durationSec: 0.022,
    peakGain: 0.011
  });
}

export function playDineshTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 1180,
    durationSec: 0.02,
    peakGain: 0.011
  });
}

export function playErlichTokenTick(audioContextRef, tickIndex = 0) {
  const freqs = [880, 988, 1175, 1318];
  playShortTone(audioContextRef, {
    type: 'square',
    freqHz: freqs[Math.abs(tickIndex) % freqs.length],
    durationSec: 0.022,
    peakGain: 0.01
  });
}

export function playJaredTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 660,
    durationSec: 0.024,
    peakGain: 0.011
  });
}

export function playRichardTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 740,
    durationSec: 0.022,
    peakGain: 0.011
  });
}

/** Brief pluck on phase change. */
export function playPhaseChangePluck(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 820,
    freqEndHz: 660,
    durationSec: 0.07,
    peakGain: 0.022
  });
}

/** Stinger on streak ≥ 2. Pitch climbs with streak. */
export function playStreakStinger(audioContextRef, streak = 2) {
  const base = 660 + Math.min(streak, 8) * 60;
  playToneSeq(
    audioContextRef,
    [
      { freq: base, dur: 0.06, peak: 0.045 },
      { freq: base * 1.25, dur: 0.06, peak: 0.045 },
      { freq: base * 1.5, dur: 0.08, peak: 0.045 }
    ],
    { stagger: 0.55 }
  );
}

/** Stinger on cross-variant combo. */
export function playComboStinger(audioContextRef, combo = 2) {
  const top = 880 + Math.min(combo, 6) * 80;
  playToneSeq(
    audioContextRef,
    [
      { freq: 523.25, dur: 0.05, peak: 0.045, type: 'square' },
      { freq: top, dur: 0.08, peak: 0.04, type: 'square' }
    ],
    { stagger: 0.6 }
  );
}

/** Big achievement fanfare. Use sparingly. */
export function playAchievementFanfare(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 523.25, dur: 0.08, peak: 0.05 },
      { freq: 659.25, dur: 0.08, peak: 0.05 },
      { freq: 783.99, dur: 0.08, peak: 0.05 },
      { freq: 1046.5, dur: 0.18, peak: 0.06, type: 'square' }
    ],
    { stagger: 0.65 }
  );
}

/**
 * Quick coin-pickup-style blip for the floating "+XP" toast — short, bright,
 * deliberately non-melodic so it doesn't conflict with the streak/combo
 * stingers when several emissions land in the same frame.
 */
export function playXpPickup(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1760, now + 0.07);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.034, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

/**
 * Full level-up fanfare — taller and more triumphant than the achievement
 * cue. Used when the Slopitect stakeholders promotes the operator to a new tier.
 */
export function playLevelUpFanfare(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // C5 - E5 - G5 - C6 ascending, then a square bell on top for sparkle.
  const notes = [
    { freq: 523.25, dur: 0.1, peak: 0.05, type: 'triangle' },
    { freq: 659.25, dur: 0.1, peak: 0.05, type: 'triangle' },
    { freq: 783.99, dur: 0.1, peak: 0.05, type: 'triangle' },
    { freq: 1046.5, dur: 0.2, peak: 0.06, type: 'square' },
    { freq: 1318.5, dur: 0.26, peak: 0.05, type: 'triangle' }
  ];
  let offset = 0;
  for (const note of notes) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = note.type;
    const t0 = now + offset;
    osc.frequency.setValueAtTime(note.freq, t0);
    applyGainEnvelope(gainNode, t0, note.peak, note.dur);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + note.dur + 0.02);
    offset += note.dur * 0.7;
  }
  // Final shimmer chord (G6 + C7) ringing over the last note.
  const shimmerFreqs = [1567.98, 2093.0];
  for (const freq of shimmerFreqs) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sine';
    const t0 = now + offset;
    osc.frequency.setValueAtTime(freq, t0);
    applyGainEnvelope(gainNode, t0, 0.04, 0.42);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + 0.46);
  }
}

/** ────────────────────────────────────────────────────────────────
 *  Streaming ambient textures — short, sporadic, per-variant.
 *  Triggered every ~4–7s during a run for additional flavor.
 *  ──────────────────────────────────────────────────────────────── */

/** Gilfoyle: a short metallic buff/polish sweep. */
export function playGilfoylePolishLoop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // High shimmer descending — like a brief chrome buff.
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(2400, now);
  osc.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.018, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

/** Dinesh: a quick double-blip — the same point, made twice. */
export function playDineshInsistLoop(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 1760, dur: 0.05, peak: 0.014 },
      { freq: 1760, dur: 0.06, peak: 0.012 }
    ],
    { type: 'triangle', stagger: 0.6 }
  );
}

/** Erlich: synth zap — quick saw chirp. */
export function playErlichSynthLoop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(1500, now + 0.15);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.022, now + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** Russ: brief klaxon honk — for unhinged ambient chaos. */
export function playRussKlaxonLoop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (const detune of [-4, 4]) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.18);
    osc.detune.setValueAtTime(detune, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.028, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}

/** Jared: scratchy pen scribble (noise-like via fast fm). */
export function playJaredScribbleLoop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // Triangle with very rapid frequency wobble — pen-scratch character.
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.linearRampToValueAtTime(700, now + 0.05);
  osc.frequency.linearRampToValueAtTime(950, now + 0.1);
  osc.frequency.linearRampToValueAtTime(720, now + 0.15);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.018, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** Explain: parchment page-flip — soft mid-frequency whoosh. */
export function playRichardPageFlipLoop(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const gainNode = context.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.linearRampToValueAtTime(220, now + 0.22);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.016, now + 0.04);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
  osc.connect(gainNode);
  gainNode.connect(context.destination);
  osc.start(now);
  osc.stop(now + 0.28);
}

/** Rare Russ airhorn blast — dramatic, use sparingly. */
export function playRussAirhornBlast(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (const detune of [-12, 0, 12]) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(840, now);
    osc.detune.setValueAtTime(detune, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
    gainNode.gain.setValueAtTime(0.07, now + 0.18);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

/** Jared pen-stab on phase transitions — short percussive stab. */
export function playJaredPenStab(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'square',
    freqHz: 1800,
    freqEndHz: 1100,
    durationSec: 0.05,
    peakGain: 0.025
  });
}

/** Konami / rainbow-tint achievement bonus stinger. */
export function playKonamiRainbow(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
  notes.forEach((freq, i) => {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = i % 2 === 0 ? 'triangle' : 'square';
    const t0 = now + i * 0.06;
    osc.frequency.setValueAtTime(freq, t0);
    applyGainEnvelope(gainNode, t0, 0.05, 0.12);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
  });
}

/** Short fanfare when Russ completes. */
export function playRussCompletionChime(audioContextRef) {
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

/** Office ambience: soft two-note "new mail" ding (docs/office-parody.md). */
export function playMailChime(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [
    { freq: 659.25, dur: 0.09, peak: 0.03 },
    { freq: 987.77, dur: 0.14, peak: 0.026 }
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
    offset += 0.07;
  }
}

/** Office ambience: single IM "pop" ping. */
export function playImPing(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 880,
    freqEndHz: 740,
    durationSec: 0.07,
    peakGain: 0.03
  });
}

/** Office ambience: meeting-join blip (rising, conferencey). */
export function playMeetingJoinBlip(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const freqs = [440, 554.37, 659.25];
  freqs.forEach((freq, i) => {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sine';
    const t0 = now + i * 0.09;
    oscillator.frequency.setValueAtTime(freq, t0);
    applyGainEnvelope(gainNode, t0, 0.028, 0.1);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(t0);
    oscillator.stop(t0 + 0.12);
  });
}

/** ────────────────────────────────────────────────────────────────
 *  Office soundscape — sporadic room-tone cues (docs/office-parody.md):
 *  keyboard clatter from the next desk, the distant printer, the espresso
 *  machine. All synthesized, all deliberately quieter than any event chime;
 *  useOfficeSoundscape schedules them sparsely and the caller gates with
 *  soundEnabled + user gesture (Focus Time mutes the whole office).
 *  ──────────────────────────────────────────────────────────────── */

const noiseBuffers = new WeakMap();

/** Half a second of cached white noise per context — raw material for hiss,
 * paper feeds, and key taps. */
function getNoiseBuffer(context) {
  let buffer = noiseBuffers.get(context);
  if (buffer) return buffer;
  const length = Math.floor(context.sampleRate * 0.5);
  buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffers.set(context, buffer);
  return buffer;
}

/** Band-passed noise burst with the shared gain envelope. */
function playNoiseBurst(context, { at, durationSec, freqHz, freqEndHz, q = 1.2, peakGain }) {
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freqHz, at);
  if (freqEndHz && freqEndHz !== freqHz) {
    filter.frequency.linearRampToValueAtTime(freqEndHz, at + durationSec * 0.9);
  }
  filter.Q.setValueAtTime(q, at);
  const gainNode = context.createGain();
  applyGainEnvelope(gainNode, at, peakGain, durationSec);
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(at, Math.random() * 0.3);
  source.stop(at + durationSec + 0.05);
}

/** A colleague typing at the next desk: 5–9 irregular key taps, ~1.5 s. */
export function playKeyboardClatter(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const taps = 5 + Math.floor(Math.random() * 5);
  let offset = 0.02;
  for (let i = 0; i < taps; i += 1) {
    playNoiseBurst(context, {
      at: now + offset,
      durationSec: 0.018 + Math.random() * 0.012,
      freqHz: 1900 + Math.random() * 1600,
      q: 2.2,
      peakGain: 0.009 + Math.random() * 0.005
    });
    // Human typing rhythm: quick runs with the occasional thinking pause.
    offset += Math.random() < 0.2 ? 0.28 + Math.random() * 0.22 : 0.07 + Math.random() * 0.09;
  }
}

/** The printer down the hall: motor hum plus three muffled head passes. */
export function playDistantPrinter(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const motor = context.createOscillator();
  const motorGain = context.createGain();
  motor.type = 'sawtooth';
  motor.frequency.setValueAtTime(92, now);
  motor.frequency.linearRampToValueAtTime(78, now + 1.3);
  applyGainEnvelope(motorGain, now, 0.006, 1.35);
  motor.connect(motorGain);
  motorGain.connect(context.destination);
  motor.start(now);
  motor.stop(now + 1.4);
  for (let pass = 0; pass < 3; pass += 1) {
    const t0 = now + 0.25 + pass * 0.34;
    playNoiseBurst(context, {
      at: t0,
      durationSec: 0.14,
      freqHz: pass % 2 === 0 ? 1050 : 1350,
      freqEndHz: pass % 2 === 0 ? 1350 : 1050,
      q: 1.6,
      peakGain: 0.007
    });
  }
}

/** Someone leafing through a stack of paper: two soft page sweeps. */
export function playPaperShuffle(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (let sweep = 0; sweep < 2; sweep += 1) {
    playNoiseBurst(context, {
      at: now + sweep * (0.26 + Math.random() * 0.1),
      durationSec: 0.16 + Math.random() * 0.06,
      freqHz: 900 + Math.random() * 300,
      freqEndHz: 1500 + Math.random() * 400,
      q: 0.7,
      peakGain: 0.008
    });
  }
}

/** A desk phone ringing two cubicles over — classic 440+480 Hz pair, two
 * muffled rings, nobody answers (that is the bit). */
export function playDeskPhone(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (let ring = 0; ring < 2; ring += 1) {
    const t0 = now + ring * 0.85;
    for (const freq of [440, 480]) {
      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      // Tremolo via a stepped envelope — the classic ring warble.
      gainNode.gain.setValueAtTime(0.0001, t0);
      for (let i = 0; i < 8; i += 1) {
        const seg = t0 + i * 0.055;
        gainNode.gain.exponentialRampToValueAtTime(i % 2 === 0 ? 0.006 : 0.002, seg + 0.027);
      }
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      osc.connect(gainNode);
      gainNode.connect(context.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    }
  }
}

/** The watercooler down the hall: a few descending glugs and a tiny fizz. */
export function playWaterCooler(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const glugs = 3 + Math.floor(Math.random() * 2);
  let offset = 0.02;
  for (let i = 0; i < glugs; i += 1) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sine';
    const t0 = now + offset;
    const start = 260 + Math.random() * 80;
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.exponentialRampToValueAtTime(start * 0.45, t0 + 0.09);
    applyGainEnvelope(gainNode, t0, 0.011, 0.1);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
    offset += 0.14 + Math.random() * 0.08;
  }
  // The big bubble rising back up the bottle.
  playNoiseBurst(context, {
    at: now + offset,
    durationSec: 0.18,
    freqHz: 500,
    freqEndHz: 900,
    q: 1.4,
    peakGain: 0.006
  });
}

/** The colleague one desk over working their mouse: a few crisp clicks and a
 * short scroll-wheel ratchet. Quiet desk texture, may repeat. */
export function playMouseClicks(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const clicks = 2 + Math.floor(Math.random() * 2);
  let offset = 0.02;
  for (let i = 0; i < clicks; i += 1) {
    playNoiseBurst(context, {
      at: now + offset,
      durationSec: 0.012,
      freqHz: 2600 + Math.random() * 900,
      q: 3,
      peakGain: 0.008
    });
    offset += 0.14 + Math.random() * 0.22;
  }
  // Scroll wheel: a fast run of tiny detents.
  if (Math.random() < 0.6) {
    for (let i = 0; i < 5; i += 1) {
      playNoiseBurst(context, {
        at: now + offset + i * 0.035,
        durationSec: 0.008,
        freqHz: 3400,
        q: 4,
        peakGain: 0.004
      });
    }
  }
}

/** An office chair losing an argument with physics: two squeaks and a slow
 * caster roll across the floor tile. */
export function playChairSqueak(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (let squeak = 0; squeak < 2; squeak += 1) {
    const t0 = now + squeak * (0.42 + Math.random() * 0.15);
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'triangle';
    const start = 480 + Math.random() * 120;
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.linearRampToValueAtTime(start * (1.35 + Math.random() * 0.25), t0 + 0.11);
    osc.frequency.linearRampToValueAtTime(start * 0.9, t0 + 0.2);
    applyGainEnvelope(gainNode, t0, 0.006, 0.22);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  }
  playNoiseBurst(context, {
    at: now + 0.15,
    durationSec: 0.7,
    freqHz: 180,
    freqEndHz: 140,
    q: 0.8,
    peakGain: 0.005
  });
}

/** The vending machine down the corridor: coin clinks, motor spiral, and the
 * fatal thunk of a snack committing to gravity. */
export function playVendingMachine(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // Two coin clinks.
  for (let coin = 0; coin < 2; coin += 1) {
    const t0 = now + coin * 0.22;
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2450 - coin * 300, t0);
    osc.frequency.linearRampToValueAtTime(2100 - coin * 300, t0 + 0.04);
    applyGainEnvelope(gainNode, t0, 0.008, 0.06);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }
  // The spiral motor considering your choice.
  const motor = context.createOscillator();
  const motorGain = context.createGain();
  motor.type = 'sawtooth';
  motor.frequency.setValueAtTime(64, now + 0.55);
  motor.frequency.linearRampToValueAtTime(58, now + 1.35);
  applyGainEnvelope(motorGain, now + 0.55, 0.006, 0.85);
  motor.connect(motorGain);
  motorGain.connect(context.destination);
  motor.start(now + 0.55);
  motor.stop(now + 1.45);
  // The drop.
  playNoiseBurst(context, {
    at: now + 1.5,
    durationSec: 0.09,
    freqHz: 130,
    q: 0.8,
    peakGain: 0.012
  });
}

/** The elevator arriving on this floor: one polite ding, doors rumbling open.
 * Nobody gets out. */
export function playElevatorDing(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (const [freq, peak] of [
    [1567.98, 0.012],
    [3135.96, 0.004]
  ]) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    applyGainEnvelope(gainNode, now, peak, 0.55);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }
  playNoiseBurst(context, {
    at: now + 0.5,
    durationSec: 0.6,
    freqHz: 120,
    freqEndHz: 170,
    q: 0.7,
    peakGain: 0.005
  });
}

/** Footsteps approaching on office carpet — heralds a walk-by. */
export function playFootsteps(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const steps = 4;
  let offset = 0.02;
  for (let i = 0; i < steps; i += 1) {
    playNoiseBurst(context, {
      at: now + offset,
      durationSec: 0.055,
      freqHz: 150 + (i % 2 === 0 ? 0 : 35) + Math.random() * 25,
      q: 0.9,
      // Each step slightly louder — they are walking TOWARD you.
      peakGain: 0.005 + i * 0.002
    });
    offset += 0.34 + Math.random() * 0.05;
  }
}

/** Boxing-bell ding-ding for a cubicle battle entering the arena — a bright
 * metallic strike (fundamental + clashing overtones), twice. */
export function playBattleBell(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  for (let hit = 0; hit < 2; hit += 1) {
    const t0 = now + hit * 0.28;
    for (const [freq, peak] of [
      [880, 0.02],
      [1976, 0.011],
      [2640, 0.006]
    ]) {
      const osc = context.createOscillator();
      const gainNode = context.createGain();
      osc.type = 'triangle';
      // Slight detune keeps it clangy instead of musical.
      osc.frequency.setValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.01), t0);
      applyGainEnvelope(gainNode, t0, peak, 0.24);
      osc.connect(gainNode);
      gainNode.connect(context.destination);
      osc.start(t0);
      osc.stop(t0 + 0.28);
    }
  }
}

/** Tiny two-note victory sting when the user settles a cubicle battle. */
export function playVictoryDing(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [
    { freq: 880, dur: 0.09, peak: 0.024 },
    { freq: 1318.5, dur: 0.16, peak: 0.026 }
  ];
  let offset = 0;
  for (const note of notes) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sine';
    const t0 = now + offset;
    osc.frequency.setValueAtTime(note.freq, t0);
    applyGainEnvelope(gainNode, t0, note.peak, note.dur);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + note.dur + 0.02);
    offset += 0.09;
  }
}

/** Calendar-reminder "bing-bong" for an incoming meeting invite. */
export function playCalendarDing(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  const notes = [
    { freq: 1318.5, dur: 0.09, peak: 0.026 },
    { freq: 987.77, dur: 0.16, peak: 0.022 }
  ];
  let offset = 0;
  for (const note of notes) {
    const osc = context.createOscillator();
    const gainNode = context.createGain();
    osc.type = 'sine';
    const t0 = now + offset;
    osc.frequency.setValueAtTime(note.freq, t0);
    applyGainEnvelope(gainNode, t0, note.peak, note.dur);
    osc.connect(gainNode);
    gainNode.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + note.dur + 0.02);
    offset += 0.11;
  }
}

/**
 * The dial-up-era greeting: mail chime plus a spoken "You've got mail!" via
 * the browser's speech synthesis (no assets). Falls back to the plain chime
 * when speech synthesis is unavailable. Played once per session for the first
 * email; `text`/`lang` come from the localized office chrome copy.
 */
export function playYouveGotMail(audioContextRef, { text = "You've got mail!", lang } = {}) {
  playMailChime(audioContextRef);
  try {
    const synth = globalThis.speechSynthesis;
    if (!synth || typeof globalThis.SpeechSynthesisUtterance !== 'function') return;
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    if (lang) utterance.lang = lang;
    utterance.volume = 0.55;
    utterance.rate = 1.02;
    utterance.pitch = 0.85;
    synth.speak(utterance);
  } catch {
    // Speech synthesis is a garnish — the chime already played.
  }
}

/** The espresso machine: grinder growl, steam-wand hiss, cup clink. */
export function playEspressoMachine(audioContextRef) {
  const context = getContext(audioContextRef);
  if (!context) return;
  const now = context.currentTime;
  // Grinder: low detuned growl with a slow wobble.
  for (const detune of [-9, 9]) {
    const grinder = context.createOscillator();
    const grinderGain = context.createGain();
    grinder.type = 'sawtooth';
    grinder.frequency.setValueAtTime(58, now);
    grinder.frequency.linearRampToValueAtTime(50, now + 0.4);
    grinder.frequency.linearRampToValueAtTime(60, now + 0.8);
    grinder.detune.setValueAtTime(detune, now);
    applyGainEnvelope(grinderGain, now, 0.008, 0.85);
    grinder.connect(grinderGain);
    grinderGain.connect(context.destination);
    grinder.start(now);
    grinder.stop(now + 0.9);
  }
  playNoiseBurst(context, {
    at: now,
    durationSec: 0.85,
    freqHz: 320,
    q: 0.8,
    peakGain: 0.008
  });
  // Steam wand: rising hiss once the grind stops.
  playNoiseBurst(context, {
    at: now + 0.95,
    durationSec: 0.75,
    freqHz: 3200,
    freqEndHz: 4600,
    q: 0.9,
    peakGain: 0.007
  });
  // Cup on saucer, after the steam.
  const clink = context.createOscillator();
  const clinkGain = context.createGain();
  clink.type = 'triangle';
  const clinkAt = now + 1.78;
  clink.frequency.setValueAtTime(1980, clinkAt);
  clink.frequency.linearRampToValueAtTime(1760, clinkAt + 0.045);
  applyGainEnvelope(clinkGain, clinkAt, 0.012, 0.05);
  clink.connect(clinkGain);
  clinkGain.connect(context.destination);
  clink.start(clinkAt);
  clink.stop(clinkAt + 0.07);
}
