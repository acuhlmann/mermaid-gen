/**
 * Google Cloud TTS for the office-parody layer
 * (docs/office-narration-roadmap.md).
 *
 * Server-side only — the browser never sees GCP credentials. When TTS is
 * disabled / unconfigured / fails, callers get null and the client falls
 * back to Web Speech (officeNarration.js).
 *
 * Voice tier: Neural2 (next step up from WaveNet) is the default for locales
 * that have it (en-US, en-AU). zh locales stay on WaveNet — Google ships no
 * Neural2 cmn-* voices at all. Set OFFICE_TTS_VOICE_TIER=wavenet to pin the
 * old WaveNet cast everywhere (instant switchback).
 *
 * Kill switch: OFFICE_TTS=0|false|off. Default ON when a GCP project id
 * resolves (same VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT path as Vertex).
 *
 * Speed: the per-persona rates below are relative fingerprints; a global
 * scale (OFFICE_TTS_RATE_SCALE, shared with the Web Speech fallback) lifts
 * the whole cast at once. Tune the scale, not the table.
 */

import { createHash } from 'node:crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import { CLOUD_TTS_RATE_RANGE, OFFICE_TTS_RATE_SCALE, scaleSpeakingRate } from '@archislop/shared';
import { resolveVertexProjectId } from './llmProvider.js';

export const OFFICE_TTS_MAX_CHARS = 500;
export const OFFICE_TTS_CACHE_MAX = 200;

/** @typedef {{ name: string, languageCode: string, speakingRate?: number, pitch?: number }} OfficeTtsVoice */

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
    refine: { name: 'en-US-Wavenet-D', languageCode: 'en-US', speakingRate: 0.95, pitch: -1.0 },
    innovate: { name: 'en-US-Wavenet-F', languageCode: 'en-US', speakingRate: 1.06, pitch: 1.5 },
    goMad: { name: 'en-US-Wavenet-J', languageCode: 'en-US', speakingRate: 1.14, pitch: 3.5 },
    critique: { name: 'en-US-Wavenet-B', languageCode: 'en-US', speakingRate: 0.88, pitch: -3.5 },
    explain: { name: 'en-US-Wavenet-C', languageCode: 'en-US', speakingRate: 0.92, pitch: 0.5 },
    exec: { name: 'en-US-Wavenet-I', languageCode: 'en-US', speakingRate: 0.94, pitch: -2.0 },
    cto: { name: 'en-US-Wavenet-A', languageCode: 'en-US', speakingRate: 1.05, pitch: 1.0 },
    cfo: { name: 'en-US-Wavenet-F', languageCode: 'en-US', speakingRate: 0.9, pitch: -2.0 }
  },
  'en-AU': {
    intern: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.1, pitch: 2.0 },
    scrumMaster: { name: 'en-AU-Wavenet-A', languageCode: 'en-AU', speakingRate: 0.98, pitch: 1.0 },
    helpdesk: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.88, pitch: -3.0 },
    facilities: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.96, pitch: -4.0 },
    hr: { name: 'en-AU-Wavenet-C', languageCode: 'en-AU', speakingRate: 1.02, pitch: 2.5 },
    greybeard: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.82, pitch: -4.5 },
    ciso: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.92, pitch: -1.5 },
    refine: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.95, pitch: -1.0 },
    innovate: { name: 'en-AU-Wavenet-A', languageCode: 'en-AU', speakingRate: 1.06, pitch: 1.5 },
    goMad: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 1.14, pitch: 3.0 },
    critique: { name: 'en-AU-Wavenet-D', languageCode: 'en-AU', speakingRate: 0.88, pitch: -3.5 },
    explain: { name: 'en-AU-Wavenet-C', languageCode: 'en-AU', speakingRate: 0.92, pitch: 0.5 },
    exec: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.94, pitch: -2.0 },
    cto: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 1.05, pitch: 1.0 },
    cfo: { name: 'en-AU-Wavenet-A', languageCode: 'en-AU', speakingRate: 0.9, pitch: -2.0 }
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
    refine: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 0.95, pitch: -1.0 },
    innovate: { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN', speakingRate: 1.05, pitch: 1.5 },
    goMad: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 1.12, pitch: 3.0 },
    critique: { name: 'cmn-CN-Wavenet-C', languageCode: 'cmn-CN', speakingRate: 0.88, pitch: -3.0 },
    explain: { name: 'cmn-CN-Wavenet-A', languageCode: 'cmn-CN', speakingRate: 0.92, pitch: 0.5 },
    exec: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 0.94, pitch: -2.0 },
    cto: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 1.04, pitch: 1.0 },
    cfo: { name: 'cmn-CN-Wavenet-D', languageCode: 'cmn-CN', speakingRate: 0.9, pitch: -2.0 }
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
    refine: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 0.95, pitch: -1.0 },
    innovate: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 1.05, pitch: 1.5 },
    goMad: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 1.12, pitch: 3.0 },
    critique: { name: 'cmn-TW-Wavenet-C', languageCode: 'cmn-TW', speakingRate: 0.88, pitch: -3.0 },
    explain: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 0.92, pitch: 0.5 },
    exec: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 0.94, pitch: -2.0 },
    cto: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 1.04, pitch: 1.0 },
    cfo: { name: 'cmn-TW-Wavenet-A', languageCode: 'cmn-TW', speakingRate: 0.9, pitch: -2.0 }
  }
};

/**
 * Neural2 voice-name overlay per locale (next tier up from WaveNet). Names
 * only — prosody (rate/pitch) is inherited from the WaveNet table entry for
 * the same speaker, so the comedy fingerprints cannot drift between tiers.
 *
 * Mapping keeps each persona's WaveNet letter and gender where the Neural2
 * catalog allows: en-AU is 1:1; en-US has no Neural2-B, so helpdesk and
 * critique (both Wavenet-B males) move to other males (J / A). zh locales are
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
    refine: 'en-US-Neural2-D',
    innovate: 'en-US-Neural2-F',
    goMad: 'en-US-Neural2-J',
    critique: 'en-US-Neural2-A',
    explain: 'en-US-Neural2-C',
    exec: 'en-US-Neural2-I',
    cto: 'en-US-Neural2-A',
    cfo: 'en-US-Neural2-F'
  },
  'en-AU': {
    intern: 'en-AU-Neural2-B',
    scrumMaster: 'en-AU-Neural2-A',
    helpdesk: 'en-AU-Neural2-D',
    facilities: 'en-AU-Neural2-D',
    hr: 'en-AU-Neural2-C',
    greybeard: 'en-AU-Neural2-B',
    ciso: 'en-AU-Neural2-D',
    refine: 'en-AU-Neural2-B',
    innovate: 'en-AU-Neural2-A',
    goMad: 'en-AU-Neural2-D',
    critique: 'en-AU-Neural2-D',
    explain: 'en-AU-Neural2-C',
    exec: 'en-AU-Neural2-B',
    cto: 'en-AU-Neural2-B',
    cfo: 'en-AU-Neural2-A'
  }
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
export const OFFICE_TTS_DEFAULT_TIER = 'neural2';

/**
 * Deploy-time voice-tier switch. `neural2` (default) upgrades en-US / en-AU
 * to Neural2 voices; `wavenet` pins the previous cast everywhere. zh locales
 * fall back to WaveNet per locale regardless (no Neural2 cmn-* voices exist).
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {'neural2' | 'wavenet'}
 */
export function resolveOfficeTtsVoiceTier(env = process.env) {
  const raw =
    typeof env.OFFICE_TTS_VOICE_TIER === 'string'
      ? env.OFFICE_TTS_VOICE_TIER.trim().toLowerCase()
      : '';
  if (raw === 'neural2' || raw === 'wavenet') return raw;
  return OFFICE_TTS_DEFAULT_TIER;
}

/**
 * Resolve the voice for a speaker, with the global rate scale already applied
 * — callers hand the returned `speakingRate` straight to the API. Under the
 * neural2 tier the name comes from NEURAL2_VOICE_NAMES when the locale has an
 * overlay; prosody always comes from the WaveNet prosody table.
 *
 * @param {string} speakerId
 * @param {string | undefined} lang
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {OfficeTtsVoice}
 */
export function resolveOfficeTtsVoice(speakerId, lang, env = process.env) {
  const locale = normalizeOfficeTtsLang(lang);
  const table = VOICES_BY_LANG[locale] ?? VOICES_BY_LANG['en-US'];
  const key = table[speakerId] ? speakerId : 'refine';
  const base = table[key] ?? DEFAULT_VOICE;
  const name =
    resolveOfficeTtsVoiceTier(env) === 'neural2'
      ? (NEURAL2_VOICE_NAMES[locale]?.[key] ?? base.name)
      : base.name;
  return {
    ...base,
    name,
    speakingRate: scaleSpeakingRate(base.speakingRate ?? 1, {
      ...CLOUD_TTS_RATE_RANGE,
      scale: resolveOfficeTtsRateScale(env)
    })
  };
}

/** @internal Test seam — the authored (unscaled) prosody table. */
export const _VOICES_BY_LANG = VOICES_BY_LANG;

/** @internal Test seam — the Neural2 voice-name overlay per locale. */
export const _NEURAL2_VOICE_NAMES = NEURAL2_VOICE_NAMES;

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
 * Synthesize one office line. Returns null when disabled, empty, or on API
 * failure (callers must degrade gracefully — never throw to the client).
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
  const voice = resolveOfficeTtsVoice(speakerId, locale, env);
  const key = cacheKey(speakerId, cleaned, `${locale}:${voice.name}`);
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const client = getClient(env, deps);
    const [response] = await client.synthesizeSpeech({
      input: { text: cleaned },
      voice: {
        languageCode: voice.languageCode,
        name: voice.name
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: voice.speakingRate ?? 1,
        pitch: voice.pitch ?? 0
      }
    });
    const content = response?.audioContent;
    if (!content) return null;
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (buffer.length === 0) return null;
    const result = {
      audioBase64: buffer.toString('base64'),
      mimeType: 'audio/mpeg',
      voiceName: voice.name,
      lang: locale
    };
    remember(key, result);
    return result;
  } catch (err) {
    console.warn('officeTts: synthesize failed:', err?.message ?? err);
    return null;
  }
}
