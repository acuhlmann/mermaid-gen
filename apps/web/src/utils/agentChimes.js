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

/** Refine boot: gentle ascending two-note chrome shine. */
export function playRefineBoot(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 523.25, dur: 0.07, peak: 0.04 },
      { freq: 783.99, dur: 0.09, peak: 0.038 }
    ],
    { type: 'triangle', stagger: 0.55 }
  );
}

/** Innovate boot: synthwave riser (sawtooth sweep up). */
export function playInnovateBoot(audioContextRef) {
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

/** Go Mad boot: airhorn-ish three-note hit. Loud and unhinged but brief. */
export function playGoMadBoot(audioContextRef) {
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

/** Critique boot: clipboard slam + typewriter ding. */
export function playCritiqueBoot(audioContextRef) {
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
export function playExplainBoot(audioContextRef) {
  playToneSeq(
    audioContextRef,
    [
      { freq: 392, dur: 0.18, peak: 0.04, type: 'triangle' },
      { freq: 587.33, dur: 0.22, peak: 0.045, type: 'triangle' }
    ],
    { stagger: 0.55 }
  );
}

export function playRefineCompletion(audioContextRef) {
  playToneSeq(audioContextRef, [
    { freq: 659.25, dur: 0.07, peak: 0.045 },
    { freq: 880.0, dur: 0.09, peak: 0.04 }
  ]);
}

export function playInnovateCompletion(audioContextRef) {
  playToneSeq(audioContextRef, [
    { freq: 739.99, dur: 0.07, peak: 0.05, type: 'square' },
    { freq: 987.77, dur: 0.09, peak: 0.045, type: 'square' },
    { freq: 1318.5, dur: 0.12, peak: 0.04, type: 'sine' }
  ]);
}

export function playCritiqueCompletion(audioContextRef) {
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

export function playExplainCompletion(audioContextRef) {
  // gentle plagal cadence
  playToneSeq(audioContextRef, [
    { freq: 523.25, dur: 0.09, peak: 0.04 },
    { freq: 659.25, dur: 0.09, peak: 0.04 },
    { freq: 783.99, dur: 0.12, peak: 0.04 }
  ]);
}

export function playRefineTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'sine',
    freqHz: 1050,
    durationSec: 0.022,
    peakGain: 0.011
  });
}

export function playInnovateTokenTick(audioContextRef, tickIndex = 0) {
  const freqs = [880, 988, 1175, 1318];
  playShortTone(audioContextRef, {
    type: 'square',
    freqHz: freqs[Math.abs(tickIndex) % freqs.length],
    durationSec: 0.022,
    peakGain: 0.01
  });
}

export function playCritiqueTokenTick(audioContextRef) {
  playShortTone(audioContextRef, {
    type: 'triangle',
    freqHz: 660,
    durationSec: 0.024,
    peakGain: 0.011
  });
}

export function playExplainTokenTick(audioContextRef) {
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

/** Refine: a short metallic buff/polish sweep. */
export function playRefinePolishLoop(audioContextRef) {
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

/** Innovate: synth zap — quick saw chirp. */
export function playInnovateSynthLoop(audioContextRef) {
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

/** Go Mad: brief klaxon honk — for unhinged ambient chaos. */
export function playGoMadKlaxonLoop(audioContextRef) {
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

/** Critique: scratchy pen scribble (noise-like via fast fm). */
export function playCritiqueScribbleLoop(audioContextRef) {
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
export function playExplainPageFlipLoop(audioContextRef) {
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

/** Rare Go Mad airhorn blast — dramatic, use sparingly. */
export function playGoMadAirhornBlast(audioContextRef) {
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

/** Critique pen-stab on phase transitions — short percussive stab. */
export function playCritiquePenStab(audioContextRef) {
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
