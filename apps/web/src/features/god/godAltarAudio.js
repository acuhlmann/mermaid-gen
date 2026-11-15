/**
 * Synthesized Web Audio cues & Cloud TTS voice for the Altar of ArchiSlop God.
 *
 * Sound effects: zero `.mp3` assets (per docs/audio-assets.md): every
 * thunderclap, cathedral organ chord, celestial blessing, and smite zap is
 * synthesized via Web Audio — it must fire with the flash, and ElevenLabs
 * is build-time-only in this repo, never a runtime route.
 *
 * Voice: decrees prefer Google Cloud TTS (Chirp3-HD `Charon`, a resonant
 * bass — see apps/server/src/agents/godTts.js) fetched via
 * `fetchGodCloudAudio`, played through a generated cathedral reverb on the
 * shared AudioContext. The browser `speechSynthesis` voice is only the
 * final fallback rung when cloud TTS is off / unconfigured / fails,
 * mirroring the office's Chirp3-HD → Neural2 → WaveNet → Web Speech ladder.
 * All functions no-op gracefully in headless/jsdom environments or when muted.
 */

function resolveContext(audioContextRef) {
  if (!audioContextRef || audioContextRef.disposed) return null;
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const ctx = audioContextRef.current ?? new Ctor();
    if (audioContextRef.disposed) {
      if (!audioContextRef.current && typeof ctx.close === 'function') {
        void Promise.resolve(ctx.close()).catch(() => {});
      }
      return null;
    }
    audioContextRef.current = ctx;
    if (typeof ctx.resume === 'function' && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  } catch {
    return null;
  }
}

export function disposeGodAudioContext(audioContextRef) {
  if (!audioContextRef) return;
  audioContextRef.disposed = true;
  const ctx = audioContextRef.current;
  audioContextRef.current = null;
  if (ctx && typeof ctx.close === 'function') {
    void Promise.resolve(ctx.close()).catch(() => {});
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

/** Web Speech prosody per mood — only the fallback rung, but keep it in character. */
const GOD_WEB_SPEECH_PROSODY = {
  wrathful: { pitch: 0.5, rate: 0.82 },
  unimpressed: { pitch: 0.6, rate: 0.88 },
  amused: { pitch: 0.72, rate: 0.95 },
  benevolent: { pitch: 0.8, rate: 0.97 },
  smitten: { pitch: 0.85, rate: 1 }
};

/** @type {{ stop?: () => void } | null} */
let activeCloudSource = null;
/** @type {HTMLAudioElement | null} */
let activeCloudAudioEl = null;
/** Bumped on stop/replace so a late cloud fetch cannot speak over a newer decree. */
let godSpeechGeneration = 0;

function stopActiveCloudPlayback() {
  if (activeCloudSource) {
    try {
      activeCloudSource.stop?.();
    } catch {
      // Already ended.
    }
    activeCloudSource = null;
  }
  if (activeCloudAudioEl) {
    try {
      activeCloudAudioEl.pause();
      activeCloudAudioEl.removeAttribute('src');
    } catch {
      // Ignore.
    }
    activeCloudAudioEl = null;
  }
}

export function stopGodSpeech() {
  godSpeechGeneration += 1;
  stopActiveCloudPlayback();
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

function cleanGodDecreeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/[`*_#>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

/** Speak a divine decree via browser SpeechSynthesis — the final fallback rung. */
export function speakGodDecree(
  text,
  { enabled = true, mood = 'amused', pitch, rate, volume = 0.85 } = {}
) {
  if (!enabled) return false;
  const cleaned = cleanGodDecreeText(text);
  if (!cleaned) return false;
  const api = getSpeechApi();
  if (!api) return false;
  const prosody = GOD_WEB_SPEECH_PROSODY[mood] ?? GOD_WEB_SPEECH_PROSODY.amused;
  try {
    api.synth.cancel?.();
    const utterance = new api.Utterance(cleaned);
    utterance.pitch = pitch ?? prosody.pitch;
    utterance.rate = rate ?? prosody.rate;
    utterance.volume = volume;
    api.synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

function decodeBase64Bytes(audioBase64) {
  const atobFn = globalThis.atob;
  if (typeof atobFn !== 'function') return null;
  try {
    const binary = atobFn(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** Generated cathedral impulse — decaying stereo noise, no IR asset needed. */
function cathedralImpulse(ctx, durationSec = 1.8) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.55));
    }
  }
  return buffer;
}

/**
 * Play cloud decree audio through the shared AudioContext with a cathedral
 * reverb send (and a whisper of pitch-down from playing the buffer back
 * slightly slow). Returns false when Web Audio playback is unavailable so
 * the caller can try the plain <audio> path.
 */
async function playCloudAudioViaContext(audio, audioContextRef, generation) {
  const ctx = resolveContext(audioContextRef);
  if (
    !ctx ||
    typeof ctx.decodeAudioData !== 'function' ||
    typeof ctx.createBufferSource !== 'function'
  )
    return false;
  const bytes = decodeBase64Bytes(audio.audioBase64);
  if (!bytes) return false;
  let buffer;
  try {
    buffer = await ctx.decodeAudioData(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    );
  } catch {
    return false;
  }
  if (generation !== godSpeechGeneration || !buffer) return false;
  try {
    stopActiveCloudPlayback();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // A touch slow = a touch deeper; the server rate already carries the pace.
    if ('playbackRate' in source && source.playbackRate) source.playbackRate.value = 0.96;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    source.connect(dry);
    dry.connect(ctx.destination);
    if (typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function') {
      const convolver = ctx.createConvolver();
      convolver.buffer = cathedralImpulse(ctx);
      const wet = ctx.createGain();
      wet.gain.value = 0.38;
      source.connect(convolver);
      convolver.connect(wet);
      wet.connect(ctx.destination);
    }
    activeCloudSource = source;
    source.onended = () => {
      if (activeCloudSource === source) activeCloudSource = null;
    };
    source.start();
    return true;
  } catch {
    return false;
  }
}

function playCloudAudioViaElement(audio, generation) {
  const AudioCtor = globalThis.Audio;
  if (typeof AudioCtor !== 'function' || !audio?.audioBase64) return false;
  if (generation !== godSpeechGeneration) return false;
  try {
    stopActiveCloudPlayback();
    const el = new AudioCtor(`data:${audio.mimeType || 'audio/mpeg'};base64,${audio.audioBase64}`);
    el.volume = 0.9;
    activeCloudAudioEl = el;
    const result = el.play();
    if (result && typeof result.catch === 'function') result.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak a decree cloud-first: Google Cloud TTS (Chirp3-HD Charon) when
 * `fetchCloudAudio` answers, Web Speech when it does not. Never throws.
 *
 * @returns {Promise<boolean>} true when any rung actually spoke
 */
export async function speakGodDecreeWithCloud(
  text,
  { enabled = true, mood = 'amused', fetchCloudAudio, audioContextRef } = {}
) {
  if (!enabled) return false;
  const cleaned = cleanGodDecreeText(text);
  if (!cleaned) return false;
  const generation = ++godSpeechGeneration;
  stopActiveCloudPlayback();
  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
    // Ignore.
  }

  if (typeof fetchCloudAudio === 'function') {
    let cloud = null;
    try {
      cloud = await fetchCloudAudio({ text: cleaned, mood });
    } catch {
      cloud = null;
    }
    if (generation !== godSpeechGeneration) return false;
    if (cloud?.audioBase64) {
      if (await playCloudAudioViaContext(cloud, audioContextRef, generation)) return true;
      if (generation !== godSpeechGeneration) return false;
      if (playCloudAudioViaElement(cloud, generation)) return true;
    }
  }
  if (generation !== godSpeechGeneration) return false;
  return speakGodDecree(cleaned, { enabled: true, mood });
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

function playReactionSting(audioContextRef, { kind, mood, hasProposal }) {
  if (isBlessingCue({ kind, mood, hasProposal })) {
    playGodOrganSting(audioContextRef, { mood: 'benevolent' });
    playGodBlessingChime(audioContextRef);
    return;
  }
  if (isSmiteCue({ kind, mood })) {
    playGodSmiteZap(audioContextRef);
    return;
  }
  playGodOrganSting(audioContextRef, { mood });
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
 *   text?: string,
 *   fetchCloudAudio?: (args: { text: string, mood?: string }) =>
 *     Promise<{ audioBase64: string, mimeType?: string } | null>
 * }} opts
 * @returns {Promise<boolean>} resolves true when the decree was spoken (any rung)
 */
export function playGodJudgmentCue({
  audioContextRef,
  kind = 'pray',
  mood = 'amused',
  hasProposal = false,
  soundEnabled = true,
  voiceEnabled = true,
  text = '',
  fetchCloudAudio
}) {
  if (!soundEnabled || audioContextRef?.disposed) return Promise.resolve(false);
  playGodThunderclap(audioContextRef);
  playReactionSting(audioContextRef, { kind, mood, hasProposal });
  if (voiceEnabled && text) {
    return speakGodDecreeWithCloud(text, { enabled: true, mood, fetchCloudAudio, audioContextRef });
  }
  return Promise.resolve(false);
}
