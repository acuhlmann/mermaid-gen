/**
 * Google Cloud WaveNet TTS for the office-parody layer
 * (docs/office-narration-roadmap.md).
 *
 * Server-side only — the browser never sees GCP credentials. When TTS is
 * disabled / unconfigured / fails, callers get null and the client falls
 * back to Web Speech (officeNarration.js).
 *
 * Kill switch: OFFICE_TTS=0|false|off. Default ON when a GCP project id
 * resolves (same VERTEX_PROJECT_ID / GOOGLE_CLOUD_PROJECT path as Vertex).
 */

import { createHash } from 'node:crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import { resolveVertexProjectId } from './llmProvider.js';

export const OFFICE_TTS_MAX_CHARS = 500;
export const OFFICE_TTS_CACHE_MAX = 200;

/** @typedef {{ name: string, languageCode: string, speakingRate?: number, pitch?: number }} OfficeTtsVoice */

/**
 * Cast → WaveNet voice per locale. Prosody (rate/pitch) keeps comedy
 * fingerprints without leaving WaveNet. zh locales use cmn-* voice ids.
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
    exec: { name: 'en-US-Wavenet-I', languageCode: 'en-US', speakingRate: 0.94, pitch: -2.0 }
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
    exec: { name: 'en-AU-Wavenet-B', languageCode: 'en-AU', speakingRate: 0.94, pitch: -2.0 }
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
    exec: { name: 'cmn-CN-Wavenet-B', languageCode: 'cmn-CN', speakingRate: 0.94, pitch: -2.0 }
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
    exec: { name: 'cmn-TW-Wavenet-B', languageCode: 'cmn-TW', speakingRate: 0.94, pitch: -2.0 }
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
 * @param {string} speakerId
 * @param {string | undefined} lang
 * @returns {OfficeTtsVoice}
 */
export function resolveOfficeTtsVoice(speakerId, lang) {
  const locale = normalizeOfficeTtsLang(lang);
  const table = VOICES_BY_LANG[locale] ?? VOICES_BY_LANG['en-US'];
  return table[speakerId] ?? table.refine ?? DEFAULT_VOICE;
}

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
  const voice = resolveOfficeTtsVoice(speakerId, locale);
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
