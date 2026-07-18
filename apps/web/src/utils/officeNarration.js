/**
 * Per-character speech for the office-parody layer (docs/office-parody.md).
 *
 * Walk-bys and WG meeting beats are spoken aloud via the browser's
 * Speech Synthesis API — the same zero-asset path as "You've got mail!".
 * Emails stay silent (nobody reads your inbox out loud). Voice "character"
 * is pitch/rate/volume per cast id so Chad, Pam, Ulrich, etc. sound
 * distinct even when the OS only exposes one system voice.
 *
 * Mobile + desktop: Web Speech works in modern browsers; cancel + chime
 * fallback keep the office graceful when synthesis is missing or muted.
 */

/** @typedef {{ pitch: number, rate: number, volume: number }} OfficeVoiceProfile */

/** @type {OfficeVoiceProfile} */
const DEFAULT_PROFILE = { pitch: 1, rate: 1, volume: 0.8 };

/**
 * Stable speech quirks per office speaker (colleagues + stakeholders who
 * take meeting seats). Values stay inside the Web Speech [0–2] ranges.
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

/** Gap after a spoken meeting line before the next speaker starts. */
export const OFFICE_NARRATION_GAP_MS = 400;

/** @type {((result: { spoken: boolean, cancelled?: boolean }) => void) | null} */
let pendingResolve = null;
/** Bumped on cancel / replace so a late onerror from a cancelled utterance
 * cannot settle the waiter for the line that replaced it. */
let speakGeneration = 0;

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

/**
 * Cancel any in-flight office utterance and resolve its waiter so meeting
 * playback cannot hang on a cancelled speak().
 */
export function cancelOfficeNarration(globalObj = globalThis) {
  speakGeneration += 1;
  try {
    globalObj.speechSynthesis?.cancel();
  } catch {
    // Ignore — synthesis is a garnish.
  }
  settlePending({ spoken: false, cancelled: true });
}

/**
 * Speak one line in the given speaker's voice. Resolves when the utterance
 * ends, errors, or is cancelled. Never throws.
 *
 * @param {{
 *   speakerId?: string,
 *   text?: string,
 *   lang?: string,
 *   globalObj?: typeof globalThis
 * }} opts
 * @returns {Promise<{ spoken: boolean, cancelled?: boolean }>}
 */
export function speakOfficeLine({ speakerId = '', text = '', lang, globalObj = globalThis } = {}) {
  const cleaned = sanitizeOfficeNarrationText(text);
  if (!cleaned || !isOfficeNarrationAvailable(globalObj)) {
    return Promise.resolve({ spoken: false });
  }

  // One office speaker at a time — replace any prior line (walk-by → meeting).
  const generation = ++speakGeneration;
  try {
    globalObj.speechSynthesis?.cancel();
  } catch {
    // Ignore.
  }
  settlePending({ spoken: false, cancelled: true });

  return new Promise((resolve) => {
    pendingResolve = resolve;
    try {
      const synth = globalObj.speechSynthesis;
      const Utterance = globalObj.SpeechSynthesisUtterance;
      const utterance = new Utterance(cleaned);
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
      utterance.onend = () => finish({ spoken: true });
      utterance.onerror = () => finish({ spoken: false });
      synth.speak(utterance);
    } catch {
      if (generation === speakGeneration) settlePending({ spoken: false });
    }
  });
}
