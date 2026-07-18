/**
 * Per-character speech for the office-parody layer (docs/office-parody.md,
 * docs/office-narration-roadmap.md).
 *
 * Prefers Google Cloud WaveNet audio from POST /api/office/speak when the
 * caller supplies `fetchCloudAudio`; falls back to the browser Speech
 * Synthesis API (pitch/rate profiles) when cloud TTS is off, unconfigured,
 * or fails. Emails / IMs stay silent by design — only overheard spoken
 * surfaces (walk-bys, meetings, cubicle battles, coffee scenes) call this.
 *
 * Mobile + desktop: HTMLAudioElement + Web Speech both respect the global
 * sound gate (callers wrap via playChime).
 */

/** @typedef {{ pitch: number, rate: number, volume: number }} OfficeVoiceProfile */
/** @typedef {{ audioBase64: string, mimeType?: string }} OfficeCloudAudio */
/** @typedef {{ spoken: boolean, cancelled?: boolean, source?: 'cloud' | 'webspeech' }} OfficeSpeakResult */

/** @type {OfficeVoiceProfile} */
const DEFAULT_PROFILE = { pitch: 1, rate: 1, volume: 0.8 };

/**
 * Stable speech quirks per office speaker (Web Speech fallback). Cloud TTS
 * uses its own WaveNet + prosody map in apps/server/src/agents/officeTts.js.
 *
 * @type {Record<string, OfficeVoiceProfile>}
 */
export const OFFICE_VOICE_PROFILES = {
  intern: { pitch: 1.18, rate: 1.1, volume: 0.85 },
  scrumMaster: { pitch: 1.06, rate: 0.98, volume: 0.82 },
  helpdesk: { pitch: 0.72, rate: 0.88, volume: 0.72 },
  facilities: { pitch: 0.68, rate: 0.96, volume: 0.92 },
  hr: { pitch: 1.22, rate: 1.02, volume: 0.8 },
  greybeard: { pitch: 0.62, rate: 0.82, volume: 0.8 },
  ciso: { pitch: 0.84, rate: 0.9, volume: 0.76 },
  refine: { pitch: 0.9, rate: 0.95, volume: 0.8 },
  innovate: { pitch: 1.12, rate: 1.06, volume: 0.85 },
  goMad: { pitch: 1.28, rate: 1.16, volume: 0.9 },
  critique: { pitch: 0.7, rate: 0.88, volume: 0.8 },
  explain: { pitch: 0.94, rate: 0.92, volume: 0.8 },
  exec: { pitch: 0.78, rate: 0.94, volume: 0.84 }
};

/** Gap after a spoken line before the next speaker starts. */
export const OFFICE_NARRATION_GAP_MS = 400;

/** @type {((result: OfficeSpeakResult) => void) | null} */
let pendingResolve = null;
/** Bumped on cancel / replace so a late onerror from a cancelled utterance
 * cannot settle the waiter for the line that replaced it. */
let speakGeneration = 0;
/** @type {HTMLAudioElement | null} */
let activeAudio = null;

/**
 * @param {string} speakerId
 * @returns {OfficeVoiceProfile}
 */
export function officeVoiceProfile(speakerId) {
  return OFFICE_VOICE_PROFILES[speakerId] ?? DEFAULT_PROFILE;
}

/** True when the browser exposes a usable speechSynthesis surface. */
export function isOfficeNarrationAvailable(globalObj = globalThis) {
  return Boolean(
    globalObj?.speechSynthesis && typeof globalObj.SpeechSynthesisUtterance === 'function'
  );
}

/**
 * Strip markup-ish noise and collapse whitespace so TTS doesn't read
 * emoji codes or runaway punctuation as "colon parenthesis".
 * @param {unknown} text
 * @returns {string}
 */
export function sanitizeOfficeNarrationText(text) {
  return String(text ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Prefer a local voice matching `lang` (en-AU, zh-CN, …); fall back to any
 * voice whose lang shares the primary subtag, then to the engine default.
 * @param {SpeechSynthesis} synth
 * @param {string | undefined} lang
 * @returns {SpeechSynthesisVoice | null}
 */
export function pickOfficeNarrationVoice(synth, lang) {
  if (!synth || typeof synth.getVoices !== 'function') return null;
  let voices = [];
  try {
    voices = synth.getVoices() ?? [];
  } catch {
    return null;
  }
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const wanted = typeof lang === 'string' ? lang.toLowerCase() : '';
  if (wanted) {
    const exact =
      voices.find((v) => v.lang?.toLowerCase() === wanted && v.localService) ||
      voices.find((v) => v.lang?.toLowerCase() === wanted);
    if (exact) return exact;
    const primary = wanted.split('-')[0];
    const family =
      voices.find((v) => v.lang?.toLowerCase().startsWith(`${primary}-`) && v.localService) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(primary));
    if (family) return family;
  }
  return voices.find((v) => v.default) ?? voices[0] ?? null;
}

function settlePending(result) {
  const resolve = pendingResolve;
  pendingResolve = null;
  resolve?.(result);
}

function stopActiveAudio() {
  if (!activeAudio) return;
  try {
    activeAudio.onended = null;
    activeAudio.onerror = null;
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
  } catch {
    // Ignore.
  }
  activeAudio = null;
}

/**
 * Cancel any in-flight office utterance / cloud audio and resolve its waiter
 * so meeting / battle playback cannot hang.
 */
export function cancelOfficeNarration(globalObj = globalThis) {
  speakGeneration += 1;
  try {
    globalObj.speechSynthesis?.cancel();
  } catch {
    // Ignore — synthesis is a garnish.
  }
  stopActiveAudio();
  settlePending({ spoken: false, cancelled: true });
}

/**
 * @param {OfficeCloudAudio} audio
 * @param {number} generation
 * @param {typeof globalThis} globalObj
 * @returns {Promise<OfficeSpeakResult>}
 */
function playCloudAudio(audio, generation, globalObj) {
  return new Promise((resolve) => {
    if (generation !== speakGeneration) {
      resolve({ spoken: false, cancelled: true });
      return;
    }
    const AudioCtor = globalObj.Audio;
    if (typeof AudioCtor !== 'function' || !audio?.audioBase64) {
      resolve({ spoken: false });
      return;
    }
    pendingResolve = resolve;
    try {
      const mime = audio.mimeType || 'audio/mpeg';
      const el = new AudioCtor(`data:${mime};base64,${audio.audioBase64}`);
      activeAudio = el;
      el.volume = 0.9;
      const finish = (result) => {
        if (generation !== speakGeneration) return;
        if (activeAudio === el) activeAudio = null;
        el.onended = null;
        el.onerror = null;
        settlePending(result);
      };
      el.onended = () => finish({ spoken: true, source: 'cloud' });
      el.onerror = () => finish({ spoken: false });
      const playResult = el.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => finish({ spoken: false }));
      }
    } catch {
      if (generation === speakGeneration) settlePending({ spoken: false });
    }
  });
}

/**
 * @param {{
 *   speakerId?: string,
 *   text?: string,
 *   lang?: string,
 *   globalObj?: typeof globalThis
 * }} opts
 * @param {number} generation
 * @returns {Promise<OfficeSpeakResult>}
 */
function speakWebSpeech({ speakerId = '', text = '', lang, globalObj = globalThis }, generation) {
  if (!isOfficeNarrationAvailable(globalObj)) {
    return Promise.resolve({ spoken: false });
  }

  return new Promise((resolve) => {
    if (generation !== speakGeneration) {
      resolve({ spoken: false, cancelled: true });
      return;
    }
    pendingResolve = resolve;
    try {
      const synth = globalObj.speechSynthesis;
      const Utterance = globalObj.SpeechSynthesisUtterance;
      const utterance = new Utterance(text);
      const profile = officeVoiceProfile(speakerId);
      utterance.pitch = profile.pitch;
      utterance.rate = profile.rate;
      utterance.volume = profile.volume;
      if (lang) utterance.lang = lang;
      const voice = pickOfficeNarrationVoice(synth, lang);
      if (voice) utterance.voice = voice;

      const finish = (result) => {
        if (generation !== speakGeneration) return;
        utterance.onend = null;
        utterance.onerror = null;
        settlePending(result);
      };
      utterance.onend = () => finish({ spoken: true, source: 'webspeech' });
      utterance.onerror = () => finish({ spoken: false });
      synth.speak(utterance);
    } catch {
      if (generation === speakGeneration) settlePending({ spoken: false });
    }
  });
}

/**
 * Speak one line in the given speaker's voice. Tries cloud WaveNet first when
 * `fetchCloudAudio` is provided; otherwise (or on failure) uses Web Speech.
 * Resolves when playback ends, errors, or is cancelled. Never throws.
 *
 * @param {{
 *   speakerId?: string,
 *   text?: string,
 *   lang?: string,
 *   fetchCloudAudio?: (args: { speakerId: string, text: string, lang?: string }) =>
 *     Promise<OfficeCloudAudio | null | undefined>,
 *   globalObj?: typeof globalThis
 * }} opts
 * @returns {Promise<OfficeSpeakResult>}
 */
export async function speakOfficeLine({
  speakerId = '',
  text = '',
  lang,
  fetchCloudAudio,
  globalObj = globalThis
} = {}) {
  const cleaned = sanitizeOfficeNarrationText(text);
  if (!cleaned) {
    return { spoken: false };
  }

  // One office speaker at a time — replace any prior line.
  const generation = ++speakGeneration;
  try {
    globalObj.speechSynthesis?.cancel();
  } catch {
    // Ignore.
  }
  stopActiveAudio();
  settlePending({ spoken: false, cancelled: true });

  if (typeof fetchCloudAudio === 'function') {
    try {
      const cloud = await fetchCloudAudio({ speakerId, text: cleaned, lang });
      if (generation !== speakGeneration) {
        return { spoken: false, cancelled: true };
      }
      if (cloud?.audioBase64) {
        return playCloudAudio(cloud, generation, globalObj);
      }
    } catch {
      // Fall through to Web Speech.
    }
  }

  if (generation !== speakGeneration) {
    return { spoken: false, cancelled: true };
  }
  return speakWebSpeech({ speakerId, text: cleaned, lang, globalObj }, generation);
}
