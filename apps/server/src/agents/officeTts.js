/**
 * Google Cloud TTS for the office-parody layer
 * (docs/office-narration-roadmap.md).
 *
 * Server-side only — the browser never sees GCP credentials. When TTS is
 * disabled / unconfigured / fails, callers get null and the client falls
 * back to Web Speech (officeNarration.js).
 *
 * Voice tier: **Chirp3-HD** (the newest, most natural tier) is the default for
 * every locale, including the Chinese ones — this is the whole reason Chinese
 * finally sounds right, because unlike Neural2 (which ships no cmn-* voices at
 * all) Chirp3-HD covers cmn-CN and cmn-TW. Each `/speak` synthesises down a
 * runtime **fallback ladder**: Chirp3-HD → Neural2 → WaveNet, dropping to the
 * client's Web Speech ("system voice") only when every cloud tier fails. So a
 * Chirp outage silently degrades to Neural2, a Neural2 gap to WaveNet, and a
 * total cloud failure to the browser — no error ever reaches the user.
 *
 * `OFFICE_TTS_VOICE_TIER` pins the *top* of that ladder for switchback:
 * `chirp3` (default) tries all three; `neural2` skips Chirp and starts at
 * Neural2; `wavenet` pins the old WaveNet cast everywhere. zh locales have no
 * Neural2 voices, so their ladder is just Chirp3-HD → WaveNet.
 *
 * Kill switch: OFFICE_TTS=0|false|off. Default ON when a GCP project id
 * resolves (same VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT path as Vertex).
 *
 * Speed: the per-persona rates below are relative fingerprints; a global
 * scale (OFFICE_TTS_RATE_SCALE, shared with the Web Speech fallback) lifts
 * the whole cast at once. Tune the scale, not the table. Pitch is a WaveNet /
 * Neural2 fingerprint only — Chirp3-HD ignores pitch, so the Chirp tier keeps
 * the rate fingerprint but not the pitch one.
 */

import { createHash } from 'node:crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import {
  CLOUD_TTS_RATE_RANGE,
  OFFICE_TTS_CHUNK_MAX_CHARS,
  OFFICE_TTS_RATE_SCALE,
  scaleSpeakingRate
} from '@archislop/shared';
import { resolveVertexProjectId } from './llmProvider.js';

/** Per-request cap — longer lines are chunked client-side before /speak. */
export const OFFICE_TTS_MAX_CHARS = OFFICE_TTS_CHUNK_MAX_CHARS;
export const OFFICE_TTS_CACHE_MAX = 200;

/** @typedef {'chirp3' | 'neural2' | 'wavenet'} OfficeTtsEngine */
/** @typedef {{ name: string, languageCode: string, speakingRate?: number, pitch?: number, engine?: OfficeTtsEngine }} OfficeTtsVoice */

/**
 * Cast → WaveNet voice per locale. Prosody (rate/pitch) keeps comedy
 * fingerprints without leaving WaveNet — and doubles as the prosody source
 * for the Neural2 overlay below. zh locales use cmn-* voice ids.
 *
 * @type {Record<string, Record<string, OfficeTtsVoice>>}
 */
const VOICES_BY_LANG = {
  'en-US': {
    intern: { name: 'en-US-Wavenet-D', languageCode: 'en-US', speakingRate: 1.1, pitch: 2.4 },
    scrumMaster: { name: 'en-US-Wavenet-F', languageCode: 'en-US', speakingRate: 0.98, pitch: 1.2 },
    helpdesk: { name: 'en-US-Wavenet-B', languageCode: 'en-US', speakingRate: 0.88, pitch: -3.2 },
    facilities: { name: 'en-US-Wavenet-J', languageCode: 'en-US', speakingRate: 0.96, pitch: -4.0 },
    hr: { name: 'en-US-Wavenet-H', languageCode: 'en-US', speakingRate: 1.02, pitch: 3.0 },
    greybeard: { name: 'en-US-Wavenet-I', languageCode: 'en-US', speakingRate: 0.82, pitch: -5.0 },
    ciso: { name: 'en-US-Wavenet-A', languageCode: 'en-US', speakingRate: 0.92, pitch: -1.5 },
    gilfoyle: { name: 'en-US-Wavenet-D', languageCode: 'en-US', speakingRate: 0.9, pitch: -2.5 },
    dinesh: { name: 'en-US-Wavenet-A', languageCode: 'en-US', speakingRate: 1.12, pitch: 2.4 },
    erlich: { name: 'en-US-Wavenet-I', languageCode: 'en-US', speakingRate: 1.08, pitch: 1.0 },
    russ: { name: 'en-US-Wavenet-J', languageCode: 'en-US', speakingRate: 1.14, pitch: 3.5 },
    jared: { name: 'en-US-Wavenet-B', languageCode: 'en-US', speakingRate: 1.04, pitch: 1.6 },
    explain: { name: 'en-US-Wavenet-C', languageCode: 'en-US', speakingRate: 0.92, pitch: 0.5 },
    cto: { name: 'en-US-Wavenet-A', languageCode: 'en-US', speakingRate: 1.05, pitch: 1.0 },
    cfo: { name: 'en-US-Wavenet-F', languageCode: 'en-US', speakingRate: 0.9, pitch: -2.0 },
    barker: { name: 'en-US-Wavenet-C', languageCode: 'en-US', speakingRate: 0.9, pitch: -1.5 }
  },
  'en-AU': {
    intern: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.1, pitch: 2.0 },
    scrumMaster: { name: 'en-AU-Wavenet-A', languageCode: 'en-AU', speakingRate: 0.98, pitch: 1.0 },
    helpdesk: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.88, pitch: -3.0 },
    facilities: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.96, pitch: -4.0 },
    hr: { name: 'en-AU-Wavenet-C', languageCode: 'en-AU', speakingRate: 1.02, pitch: 2.5 },
    greybeard: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.82, pitch: -4.5 },
    ciso: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.92, pitch: -1.5 },
    gilfoyle: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.9, pitch: -2.5 },
    dinesh: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.12, pitch: 2.4 },
    erlich: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.08, pitch: 1.0 },
    russ: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 1.14, pitch: 3.0 },
    jared: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 1.04, pitch: 1.6 },
    explain: { name: 'en-AU-Wavenet-C', languageCode: 'en-AU', speakingRate: 0.92, pitch: 0.5 },
    cto: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.05, pitch: 1.0 },
    cfo: { name: 'en-AU-Wavenet-A', languageCode: 'en-AU', speakingRate: 0.9, pitch: -2.0 },
    barker: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.9, pitch: -1.5 }
  },
  'zh-CN': {
    intern: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 1.08, pitch: 2.0 },
    scrumMaster: {
      name: 'cmn-CN-Wavenet-A',
      languageCode: 'cmn-CN',
      speakingRate: 0.98,
      pitch: 1.0
    },
    helpdesk: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 0.9, pitch: -2.5 },
    facilities: {
      name: 'cmn-CN-Wavenet-C',
      languageCode: 'cmn-CN',
      speakingRate: 0.96,
      pitch: -3.5
    },
    hr: { name: 'cmn-CN-Wavenet-D', languageCode: 'cmn-CN', speakingRate: 1.02, pitch: 2.5 },
    greybeard: {
      name: 'cmn-CN-Wavenet-B',
      languageCode: 'cmn-CN',
      speakingRate: 0.84,
      pitch: -4.0
    },
    ciso: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 0.92, pitch: -1.5 },
    gilfoyle: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 0.9, pitch: -2.5 },
    dinesh: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 1.12, pitch: 2.4 },
    erlich: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 1.06, pitch: 1.0 },
    russ: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 1.12, pitch: 3.0 },
    jared: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 1.02, pitch: 1.4 },
    explain: { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN', speakingRate: 0.92, pitch: 0.5 },
    cto: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 1.04, pitch: 1.0 },
    cfo: { name: 'cmn-CN-Wavenet-D', languageCode: 'cmn-CN', speakingRate: 0.9, pitch: -2.0 },
    barker: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 0.9, pitch: -1.5 }
  },
  'zh-TW': {
    intern: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 1.08, pitch: 2.0 },
    scrumMaster: {
      name: 'cmn-TW-Wavenet-A',
      languageCode: 'cmn-TW',
      speakingRate: 0.98,
      pitch: 1.0
    },
    helpdesk: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 0.9, pitch: -2.5 },
    facilities: {
      name: 'cmn-TW-Wavenet-C',
      languageCode: 'cmn-TW',
      speakingRate: 0.96,
      pitch: -3.5
    },
    hr: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 1.02, pitch: 2.5 },
    greybeard: {
      name: 'cmn-TW-Wavenet-B',
      languageCode: 'cmn-TW',
      speakingRate: 0.84,
      pitch: -4.0
    },
    ciso: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 0.92, pitch: -1.5 },
    gilfoyle: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 0.9, pitch: -2.5 },
    dinesh: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 1.12, pitch: 2.4 },
    erlich: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 1.06, pitch: 1.0 },
    russ: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 1.12, pitch: 3.0 },
    jared: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 1.02, pitch: 1.4 },
    explain: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 0.92, pitch: 0.5 },
    cto: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 1.04, pitch: 1.0 },
    cfo: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 0.9, pitch: -2.0 },
    barker: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 0.9, pitch: -1.5 }
  }
};

/**
 * Neural2 voice-name overlay per locale (next tier up from WaveNet). Names
 * only — prosody (rate/pitch) is inherited from the WaveNet table entry for
 * the same speaker, so the comedy fingerprints cannot drift between tiers.
 *
 * Mapping keeps each persona's WaveNet letter and gender where the Neural2
 * catalog allows: en-AU is 1:1; en-US has no Neural2-B, so helpdesk and
 * jared (both Wavenet-B males) move to other males (J / A). zh locales are
 * absent by design — cmn-CN / cmn-TW have no Neural2 voices (cmn-TW has
 * nothing above WaveNet), so they always resolve from the WaveNet table.
 *
 * @type {Record<string, Record<string, string>>}
 */
const NEURAL2_VOICE_NAMES = {
  'en-US': {
    intern: 'en-US-Neural2-D',
    scrumMaster: 'en-US-Neural2-F',
    helpdesk: 'en-US-Neural2-J',
    facilities: 'en-US-Neural2-J',
    hr: 'en-US-Neural2-H',
    greybeard: 'en-US-Neural2-I',
    ciso: 'en-US-Neural2-A',
    gilfoyle: 'en-US-Neural2-D',
    dinesh: 'en-US-Neural2-A',
    erlich: 'en-US-Neural2-I',
    russ: 'en-US-Neural2-J',
    jared: 'en-US-Neural2-A',
    explain: 'en-US-Neural2-C',
    cto: 'en-US-Neural2-A',
    cfo: 'en-US-Neural2-F',
    barker: 'en-US-Neural2-C'
  },
  'en-AU': {
    intern: 'en-AU-Neural2-B',
    scrumMaster: 'en-AU-Neural2-A',
    helpdesk: 'en-AU-Neural2-D',
    facilities: 'en-AU-Neural2-D',
    hr: 'en-AU-Neural2-C',
    greybeard: 'en-AU-Neural2-B',
    ciso: 'en-AU-Neural2-D',
    gilfoyle: 'en-AU-Neural2-B',
    dinesh: 'en-AU-Neural2-B',
    erlich: 'en-AU-Neural2-B',
    russ: 'en-AU-Neural2-D',
    jared: 'en-AU-Neural2-D',
    explain: 'en-AU-Neural2-C',
    cto: 'en-AU-Neural2-B',
    cfo: 'en-AU-Neural2-A',
    barker: 'en-AU-Neural2-B'
  }
};

/**
 * Chirp3-HD voice-name roster, keyed by speaker. Chirp3-HD voice names are
 * *locale-independent* (the same `Puck` / `Aoede` ship for en-US, en-AU,
 * cmn-CN and cmn-TW alike), so unlike the WaveNet / Neural2 tables this is one
 * flat map — the per-locale voice id is `${chirpLang}-Chirp3-HD-${name}`.
 *
 * Only the eight core Chirp3-HD voices are used, because those are the ones
 * guaranteed across every office locale (crucially the cmn-* ones):
 *   female — Aoede, Kore, Leda, Zephyr
 *   male   — Puck, Charon, Fenrir, Orus
 * Each speaker keeps the *gender* of its WaveNet letter so the cast still reads
 * the same; prosody (rate) is inherited from VOICES_BY_LANG, and pitch is
 * dropped (Chirp3-HD does not support it).
 *
 * @type {Record<string, string>}
 */
const CHIRP3_VOICE_ROSTER = {
  // team
  gilfoyle: 'Puck',
  dinesh: 'Charon',
  erlich: 'Fenrir',
  russ: 'Fenrir',
  jared: 'Charon',
  explain: 'Aoede',
  // senior
  ciso: 'Charon',
  cto: 'Puck',
  cfo: 'Kore',
  barker: 'Orus',
  // office
  intern: 'Puck',
  scrumMaster: 'Kore',
  helpdesk: 'Charon',
  facilities: 'Fenrir',
  hr: 'Leda',
  greybeard: 'Orus'
};

/**
 * BCP-47 language code Chirp3-HD (and WaveNet) use per office locale. zh tags
 * map onto Google's `cmn-*` codes; the en tags pass through unchanged.
 *
 * @type {Record<string, string>}
 */
const CHIRP_LANG_CODE = {
  'en-US': 'en-US',
  'en-AU': 'en-AU',
  'zh-CN': 'cmn-CN',
  'zh-TW': 'cmn-TW'
};

const DEFAULT_VOICE = {
  name: 'en-US-Wavenet-D',
  languageCode: 'en-US',
  speakingRate: 1,
  pitch: 0
};

/** @type {Map<string, { audioBase64: string, mimeType: string, voiceName: string, lang: string }>} */
const cache = new Map();

/** @type {import('@google-cloud/text-to-speech').TextToSpeechClient | null} */
let sharedClient = null;

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isOfficeTtsEnabled(env = process.env) {
  const flag = typeof env.OFFICE_TTS === 'string' ? env.OFFICE_TTS.trim().toLowerCase() : '';
  if (flag === '0' || flag === 'false' || flag === 'off' || flag === 'no') return false;
  return Boolean(resolveVertexProjectId(env));
}

/**
 * Normalize UI locale tags (zh-CN) onto the voice table keys.
 * @param {string | undefined} lang
 * @returns {string}
 */
export function normalizeOfficeTtsLang(lang) {
  const raw = typeof lang === 'string' ? lang.trim() : '';
  if (!raw) return 'en-US';
  if (Object.prototype.hasOwnProperty.call(VOICES_BY_LANG, raw)) return raw;
  const lower = raw.toLowerCase();
  if (lower.startsWith('en-au')) return 'en-AU';
  if (lower.startsWith('zh-tw') || lower.startsWith('cmn-tw')) return 'zh-TW';
  if (lower.startsWith('zh') || lower.startsWith('cmn')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';
  return 'en-US';
}

/**
 * Deploy-time override for the global rate scale, so narration speed can be
 * tuned by ear without a rebuild. Absent or malformed values fall back to the
 * shared default.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number}
 */
export function resolveOfficeTtsRateScale(env = process.env) {
  const raw = typeof env.OFFICE_TTS_RATE_SCALE === 'string' ? env.OFFICE_TTS_RATE_SCALE.trim() : '';
  if (!raw) return OFFICE_TTS_RATE_SCALE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : OFFICE_TTS_RATE_SCALE;
}

/** Default voice tier when OFFICE_TTS_VOICE_TIER is unset or malformed. */
export const OFFICE_TTS_DEFAULT_TIER = 'chirp3';

/**
 * The fallback ladder for each pinned tier, richest engine first. `synthesize`
 * walks it until an engine answers; whatever's left when all cloud engines
 * fail is the client's Web Speech "system voice".
 *
 * @type {Record<OfficeTtsEngine, OfficeTtsEngine[]>}
 */
const TIER_LADDER = {
  chirp3: ['chirp3', 'neural2', 'wavenet'],
  neural2: ['neural2', 'wavenet'],
  wavenet: ['wavenet']
};

/**
 * Deploy-time voice-tier switch — the *top* of the fallback ladder. `chirp3`
 * (default) tries Chirp3-HD → Neural2 → WaveNet; `neural2` skips Chirp;
 * `wavenet` pins the previous cast everywhere. Bare `chirp` is accepted as an
 * alias for `chirp3`. Locales without a given engine (zh has no Neural2, no
 * locale-independent limits on Chirp) simply drop that rung from their ladder.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {OfficeTtsEngine}
 */
export function resolveOfficeTtsVoiceTier(env = process.env) {
  const raw =
    typeof env.OFFICE_TTS_VOICE_TIER === 'string'
      ? env.OFFICE_TTS_VOICE_TIER.trim().toLowerCase()
      : '';
  if (raw === 'chirp' || raw === 'chirp3') return 'chirp3';
  if (raw === 'neural2' || raw === 'wavenet') return raw;
  return OFFICE_TTS_DEFAULT_TIER;
}

/**
 * Build one engine's voice for a speaker, or null when that engine has no
 * voice for the locale (e.g. Neural2 in zh). Prosody (rate/pitch) always comes
 * from the WaveNet prosody table so the comedy fingerprints cannot drift
 * between engines; the rate is returned already globally scaled.
 *
 * @param {OfficeTtsEngine} engine
 * @param {string} locale
 * @param {string} key resolved speaker key (already fell back to 'gilfoyle')
 * @param {OfficeTtsVoice} base prosody row from VOICES_BY_LANG
 * @param {NodeJS.ProcessEnv} env
 * @returns {OfficeTtsVoice | null}
 */
function voiceForEngine(engine, locale, key, base, env) {
  let name = null;
  let languageCode = base.languageCode;
  if (engine === 'wavenet') {
    name = base.name;
  } else if (engine === 'neural2') {
    name = NEURAL2_VOICE_NAMES[locale]?.[key] ?? null;
  } else if (engine === 'chirp3') {
    const chirpLang = CHIRP_LANG_CODE[locale];
    const voiceName = CHIRP3_VOICE_ROSTER[key];
    if (chirpLang && voiceName) {
      name = `${chirpLang}-Chirp3-HD-${voiceName}`;
      languageCode = chirpLang;
    }
  }
  if (!name) return null;
  return {
    ...base,
    name,
    languageCode,
    engine,
    speakingRate: scaleSpeakingRate(base.speakingRate ?? 1, {
      ...CLOUD_TTS_RATE_RANGE,
      scale: resolveOfficeTtsRateScale(env)
    })
  };
}

/**
 * Ordered voice candidates for a speaker, richest engine first, per the tier
 * ladder. `synthesizeOfficeSpeech` tries each until one succeeds; the client's
 * Web Speech is the implicit last rung once the array is exhausted.
 *
 * @param {string} speakerId
 * @param {string | undefined} lang
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {OfficeTtsVoice[]}
 */
export function resolveOfficeTtsVoiceCandidates(speakerId, lang, env = process.env) {
  const locale = normalizeOfficeTtsLang(lang);
  const table = VOICES_BY_LANG[locale] ?? VOICES_BY_LANG['en-US'];
  const key = table[speakerId] ? speakerId : 'gilfoyle';
  const base = table[key] ?? DEFAULT_VOICE;
  const ladder = TIER_LADDER[resolveOfficeTtsVoiceTier(env)] ?? TIER_LADDER.chirp3;
  /** @type {OfficeTtsVoice[]} */
  const candidates = [];
  const seen = new Set();
  for (const engine of ladder) {
    const voice = voiceForEngine(engine, locale, key, base, env);
    if (voice && !seen.has(voice.name)) {
      seen.add(voice.name);
      candidates.push(voice);
    }
  }
  // A locale/tier that somehow resolved nothing still gets the WaveNet base so
  // callers never see an empty ladder.
  if (candidates.length === 0) {
    const fallback = voiceForEngine('wavenet', locale, key, base, env);
    if (fallback) candidates.push(fallback);
  }
  return candidates;
}

/**
 * Resolve the single primary voice for a speaker (the top of the ladder), with
 * the global rate scale already applied. Kept for callers/tests that want the
 * default voice; `synthesizeOfficeSpeech` walks the full candidate ladder.
 *
 * @param {string} speakerId
 * @param {string | undefined} lang
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {OfficeTtsVoice}
 */
export function resolveOfficeTtsVoice(speakerId, lang, env = process.env) {
  const candidates = resolveOfficeTtsVoiceCandidates(speakerId, lang, env);
  return candidates[0] ?? { ...DEFAULT_VOICE, engine: 'wavenet' };
}

/** @internal Test seam — the authored (unscaled) prosody table. */
export const _VOICES_BY_LANG = VOICES_BY_LANG;

/** @internal Test seam — the Neural2 voice-name overlay per locale. */
export const _NEURAL2_VOICE_NAMES = NEURAL2_VOICE_NAMES;

/** @internal Test seam — the locale-independent Chirp3-HD voice roster. */
export const _CHIRP3_VOICE_ROSTER = CHIRP3_VOICE_ROSTER;

/**
 * @param {unknown} text
 * @returns {string}
 */
export function sanitizeOfficeTtsText(text) {
  const cleaned = String(text ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= OFFICE_TTS_MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, OFFICE_TTS_MAX_CHARS - 1).trimEnd()}…`;
}

function cacheKey(speakerId, text, lang) {
  return createHash('sha256').update(`${lang}\0${speakerId}\0${text}`).digest('hex');
}

function remember(key, value) {
  if (cache.size >= OFFICE_TTS_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ client?: import('@google-cloud/text-to-speech').TextToSpeechClient }} [deps]
 */
function getClient(env = process.env, deps = {}) {
  if (deps.client) return deps.client;
  if (sharedClient) return sharedClient;
  const projectId = resolveVertexProjectId(env) || undefined;
  sharedClient = new textToSpeech.TextToSpeechClient(projectId ? { projectId } : undefined);
  return sharedClient;
}

/** Test helper — clears the in-process LRU and shared client. */
export function _resetOfficeTtsForTests() {
  cache.clear();
  sharedClient = null;
}

/**
 * Build the Cloud TTS `audioConfig` for one voice. Chirp3-HD does not support
 * `pitch` (sending it errors the whole request), so pitch rides only on the
 * WaveNet / Neural2 engines — Chirp keeps the rate fingerprint alone.
 *
 * @param {OfficeTtsVoice} voice
 * @returns {import('@google-cloud/text-to-speech').protos.google.cloud.texttospeech.v1.IAudioConfig}
 */
function audioConfigFor(voice) {
  const config = {
    audioEncoding: 'MP3',
    speakingRate: voice.speakingRate ?? 1
  };
  if (voice.engine !== 'chirp3') config.pitch = voice.pitch ?? 0;
  return config;
}

/**
 * Synthesize one office line, walking the Chirp3-HD → Neural2 → WaveNet ladder
 * (`resolveOfficeTtsVoiceCandidates`) until an engine answers. Returns null
 * when disabled, empty, or when *every* cloud engine fails — the caller then
 * degrades to the client's Web Speech "system voice". Never throws.
 *
 * @param {{ speakerId?: string, text?: string, lang?: string }} args
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ client?: import('@google-cloud/text-to-speech').TextToSpeechClient }} [deps]
 * @returns {Promise<{ audioBase64: string, mimeType: string, voiceName: string, lang: string } | null>}
 */
export async function synthesizeOfficeSpeech(
  { speakerId = '', text = '', lang } = {},
  env = process.env,
  deps = {}
) {
  if (!isOfficeTtsEnabled(env)) return null;
  const cleaned = sanitizeOfficeTtsText(text);
  if (!cleaned || typeof speakerId !== 'string' || !speakerId) return null;

  const locale = normalizeOfficeTtsLang(lang);
  const candidates = resolveOfficeTtsVoiceCandidates(speakerId, locale, env);
  if (candidates.length === 0) return null;

  // Cache keys off the ladder's *top* voice so identical lines skip the API
  // (and its fallback walk) entirely — the stored `voiceName` still records
  // whichever engine actually answered.
  const key = cacheKey(speakerId, cleaned, `${locale}:${candidates[0].name}`);
  const hit = cache.get(key);
  if (hit) return hit;

  let client;
  try {
    client = getClient(env, deps);
  } catch (err) {
    // Constructing the TTS client can throw (missing ADC) — degrade, never throw.
    console.warn('officeTts: client init failed:', err?.message ?? err);
    return null;
  }
  for (const voice of candidates) {
    const result = await synthesizeVoice(client, voice, cleaned, locale);
    if (result) {
      remember(key, result);
      return result;
    }
  }
  return null;
}

/**
 * One rung of the fallback ladder: synthesize with a single voice. Returns the
 * result on success, or null when the engine fails or hands back empty audio
 * (so the caller falls through to the next rung).
 *
 * @param {import('@google-cloud/text-to-speech').TextToSpeechClient} client
 * @param {OfficeTtsVoice} voice
 * @param {string} text pre-sanitized line
 * @param {string} locale
 * @returns {Promise<{ audioBase64: string, mimeType: string, voiceName: string, lang: string } | null>}
 */
async function synthesizeVoice(client, voice, text, locale) {
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: audioConfigFor(voice)
    });
    const content = response?.audioContent;
    if (!content) return null;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buffer.length === 0) return null;
    return {
      audioBase64: buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      voiceName: voice.name,
      lang: locale
    };
  } catch (err) {
    // Fall through to the next rung of the ladder.
    console.warn(
      `officeTts: ${voice.engine} (${voice.name}) failed, trying fallback:`,
      err?.message ?? err
    );
    return null;
  }
}
