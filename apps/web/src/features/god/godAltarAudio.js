/**
 * Synthesized Web Audio cues & Web Speech voice for the Altar of ArchiSlop God.
 *
 * Zero `.mp3` assets (per docs/audio-assets.md / don't-touch rules): every
 * thunderclap, cathedral organ chord, celestial blessing, and smite zap is
 * synthesized via Web Audio, and spoken decrees use browser `speechSynthesis`.
 * All functions no-op gracefully in headless/jsdom environments or when muted.
 */

function resolveContext(audioContextRef) {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = audioContextRef.current ?? new Ctor();
    audioContextRef.current = ctx;
    if (typeof ctx.resume === 'function' && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

function envelope(gainNode, startTime, peak, durationSec) {
  const attack = Math.min(0.03, durationSec * 0.25);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
}

function canSynthesizeNoise(ctx) {
  return (
    typeof ctx.createBuffer === 'function' &&
    typeof ctx.createBufferSource === 'function' &&
    typeof ctx.createBiquadFilter === 'function' &&
    Number.isFinite(ctx.sampleRate)
  );
}

/** Sub-bass boom + filtered thunder crack. */
export function playGodThunderclap(audioContextRef) {
  const ctx = resolveContext(audioContextRef);
  if (!ctx || typeof ctx.createOscillator !== 'function') return;
  const now = ctx.currentTime ?? 0;

  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(84, now);
  boom.frequency.exponentialRampToValueAtTime(28, now + 0.55);
  envelope(boomGain, now, 0.095, 0.6);
  boom.connect(boomGain);
  boomGain.connect(ctx.destination);
  boom.start(now);
  boom.stop(now + 0.65);

  if (!canSynthesizeNoise(ctx)) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * 0.75));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.28));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(220, now + 0.7);
  const noiseGain = ctx.createGain();
  envelope(noiseGain, now, 0.06, 0.72);
  source.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  source.start(now);
  source.stop(now + 0.75);
}

/** Cathedral organ triad sting (minor for wrath/amused, radiant major for benevolent). */
export function playGodOrganSting(audioContextRef, { mood = 'amused' } = {}) {
  const ctx = resolveContext(audioContextRef);
  if (!ctx || typeof ctx.createOscillator !== 'function') return;
  const now = ctx.currentTime ?? 0;
  const major = mood === 'benevolent' || mood === 'smitten';
  const freqs = major ? [293.66, 369.99, 440.0, 587.33] : [293.66, 349.23, 440.0, 523.25];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx === 0 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    envelope(gain, now + idx * 0.025, 0.028, 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.025);
    osc.stop(now + 0.62);
  });
}

/** Ascending celestial harp/choir arpeggio when a wish is blessed or PR decreed. */
export function playGodBlessingChime(audioContextRef) {
  const ctx = resolveContext(audioContextRef);
  if (!ctx || typeof ctx.createOscillator !== 'function') return;
  const now = ctx.currentTime ?? 0;
  const notes = [587.33, 739.99, 880.0, 1174.66];
  notes.forEach((freq, idx) => {
    const t0 = now + idx * 0.07;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    envelope(gain, t0, 0.036, 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.38);
  });
}

/** Sharp lightning snap + tritone warning when God is wrathful or unimpressed. */
export function playGodSmiteZap(audioContextRef) {
  const ctx = resolveContext(audioContextRef);
  if (!ctx || typeof ctx.createOscillator !== 'function') return;
  const now = ctx.currentTime ?? 0;
  const zap = ctx.createOscillator();
  const zapGain = ctx.createGain();
  zap.type = 'sawtooth';
  zap.frequency.setValueAtTime(980, now);
  zap.frequency.exponentialRampToValueAtTime(140, now + 0.24);
  envelope(zapGain, now, 0.04, 0.26);
  zap.connect(zapGain);
  zapGain.connect(ctx.destination);
  zap.start(now);
  zap.stop(now + 0.28);

  for (const freq of [207.65, 293.66]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + 0.08);
    envelope(gain, now + 0.08, 0.03, 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.08);
    osc.stop(now + 0.42);
  }
}

export function stopGodSpeech() {
  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // ignore in headless/restricted environments
  }
}

function getSpeechApi() {
  const synth = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!synth || typeof synth.speak !== 'function' || typeof Utterance !== 'function') return null;
  return { synth, Utterance };
}

/** Speak a divine decree via browser SpeechSynthesis when available. */
export function speakGodDecree(
  text,
  { enabled = true, pitch = 0.72, rate = 0.95, volume = 0.75 } = {}
) {
  if (!enabled || typeof text !== 'string') return false;
  const cleaned = text
    .replace(/[`*_#>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
  if (!cleaned) return false;
  const api = getSpeechApi();
  if (!api) return false;
  try {
    api.synth.cancel?.();
    const utterance = new api.Utterance(cleaned);
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.volume = volume;
    api.synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function isBlessingCue({ kind, mood, hasProposal }) {
  return (
    kind === 'file-pr' ||
    kind === 'bless' ||
    hasProposal ||
    mood === 'benevolent' ||
    mood === 'smitten'
  );
}

function isSmiteCue({ kind, mood }) {
  return kind === 'smite' || mood === 'wrathful' || mood === 'unimpressed';
}

/**
 * Play the combined celestial audio + optional spoken voice for a divine event.
 *
 * @param {{
 *   audioContextRef: { current: AudioContext | null },
 *   kind?: 'pray' | 'bless' | 'smite' | 'file-pr',
 *   mood?: string,
 *   hasProposal?: boolean,
 *   soundEnabled?: boolean,
 *   voiceEnabled?: boolean,
 *   text?: string
 * }} opts
 */
export function playGodJudgmentCue({
  audioContextRef,
  kind = 'pray',
  mood = 'amused',
  hasProposal = false,
  soundEnabled = true,
  voiceEnabled = true,
  text = ''
}) {
  if (!soundEnabled) return;
  playGodThunderclap(audioContextRef);
  if (isBlessingCue({ kind, mood, hasProposal })) {
    playGodOrganSting(audioContextRef, { mood: 'benevolent' });
    playGodBlessingChime(audioContextRef);
  } else if (isSmiteCue({ kind, mood })) {
    playGodSmiteZap(audioContextRef);
  } else {
    playGodOrganSting(audioContextRef, { mood });
  }
  if (voiceEnabled && text) {
    speakGodDecree(text, { enabled: true });
  }
}
