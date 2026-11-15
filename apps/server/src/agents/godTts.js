/**
 * Google Cloud TTS for ArchiSlop God (the Altar's spoken decrees).
 *
 * Why not the browser voice, and why not ElevenLabs at runtime?
 *  - The browser `speechSynthesis` voice is whatever the OS ships — flat,
 *    inconsistent across machines, and the opposite of divine.
 *  - The office already solved this properly: server-side Google Cloud TTS
 *    (Chirp3-HD → Neural2 → WaveNet ladder in `officeTts.js`) on the same
 *    GCP project / ADC as Vertex, with the client's Web Speech as the final
 *    fallback rung. God reuses that exact shape, cast, and kill switches —
 *    no new vendor, credential, or deploy secret.
 *  - ElevenLabs stays **build-time only** in this repo
 *    (docs/audio-assets.md): it bakes committed sound-effect assets, it
 *    never runs in a route / CI / Cloud Run. God's thunder/organ SFX are
 *    already synthesized Web Audio cues that must fire with the flash —
 *    a 1–3 s runtime SFX generation would miss the moment anyway. If a
 *    baked celestial SFX bank is ever wanted, it goes through
 *    `scripts/generate-office-audio.sh`, not this module.
 *
 * The voice: **Chirp3-HD `Charon`** — Google's measured, resonant bass
 * ("classical, authoritative"; the ferryman of the dead is a bonus).
 * Chirp3-HD ignores `pitch`, so divinity is carried by the voice itself
 * plus a deliberately slow, mood-shaped `speakingRate` (wrath is slowest).
 * Fallback rungs keep a low pitch fingerprint: Neural2-J → WaveNet-J.
 *
 * Kill switches: `GOD_TTS=0` (god only) or `OFFICE_TTS=0` (all Cloud TTS).
 * Tier pin: `GOD_TTS_VOICE_TIER`, else `OFFICE_TTS_VOICE_TIER`, else chirp3.
 * Returns null on any failure — the client then uses Web Speech. Never throws.
 */

import { createHash } from 'node:crypto';
import textToSpeech from '@google-cloud/text-to-speech';
import { resolveVertexProjectId } from './llmProvider.js';

/** A decree is a proclamation, not an audiobook — cap what one call speaks. */
export const GOD_TTS_MAX_CHARS = 400;
export const GOD_TTS_CACHE_MAX = 100;

/** @typedef {'chirp3' | 'neural2' | 'wavenet'} GodTtsEngine */
/** @typedef {{ name: string, languageCode: string, speakingRate: number, pitch?: number, engine: GodTtsEngine }} GodTtsVoice */

const GOD_MOODS = ['wrathful', 'unimpressed', 'amused', 'benevolent', 'smitten'];

/** Mood → speakingRate. Wrath is slow and heavy; smitten is almost warm. */
const MOOD_RATE = {
  wrathful: 0.76,
  unimpressed: 0.8,
  amused: 0.84,
  benevolent: 0.88,
  smitten: 0.9
};

const VOICE_BY_ENGINE = {
  chirp3: { name: 'en-US-Chirp3-HD-Charon', languageCode: 'en-US' },
  neural2: { name: 'en-US-Neural2-J', languageCode: 'en-US', pitch: -3.5 },
  wavenet: { name: 'en-US-Wavenet-J', languageCode: 'en-US', pitch: -4.5 }
};

const TIER_LADDER = {
  chirp3: ['chirp3', 'neural2', 'wavenet'],
  neural2: ['neural2', 'wavenet'],
  wavenet: ['wavenet']
};

/** @type {Map<string, { audioBase64: string, mimeType: string, voiceName: string, lang: string }>} */
const cache = new Map();

/** @type {import('@google-cloud/text-to-speech').TextToSpeechClient | null} */
let sharedClient = null;

function isOff(value) {
  const flag = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return flag === '0' || flag === 'false' || flag === 'off' || flag === 'no';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isGodTtsEnabled(env = process.env) {
  if (isOff(env.GOD_TTS) || isOff(env.OFFICE_TTS)) return false;
  return Boolean(resolveVertexProjectId(env));
}

/**
 * @param {string | undefined} mood
 * @returns {string}
 */
export function normalizeGodMood(mood) {
  return GOD_MOODS.includes(mood) ? mood : 'amused';
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {GodTtsEngine}
 */
export function resolveGodTtsVoiceTier(env = process.env) {
  const raw =
    typeof env.GOD_TTS_VOICE_TIER === 'string' && env.GOD_TTS_VOICE_TIER.trim()
      ? env.GOD_TTS_VOICE_TIER.trim().toLowerCase()
      : typeof env.OFFICE_TTS_VOICE_TIER === 'string'
        ? env.OFFICE_TTS_VOICE_TIER.trim().toLowerCase()
        : '';
  if (raw === 'chirp' || raw === 'chirp3') return 'chirp3';
  if (raw === 'neural2' || raw === 'wavenet') return raw;
  return 'chirp3';
}

/**
 * Ordered voice candidates for a decree, richest engine first.
 *
 * @param {string | undefined} mood
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {GodTtsVoice[]}
 */
export function resolveGodTtsVoiceCandidates(mood, env = process.env) {
  const speakingRate = MOOD_RATE[normalizeGodMood(mood)];
  const ladder = TIER_LADDER[resolveGodTtsVoiceTier(env)] ?? TIER_LADDER.chirp3;
  return ladder.map((engine) => ({ ...VOICE_BY_ENGINE[engine], speakingRate, engine }));
}

/**
 * @param {string | undefined} mood
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {GodTtsVoice}
 */
export function resolveGodTtsVoice(mood, env = process.env) {
  return resolveGodTtsVoiceCandidates(mood, env)[0];
}

/**
 * @param {unknown} text
 * @returns {string}
 */
export function sanitizeGodTtsText(text) {
  const cleaned = String(text ?? '')
    .replace(/[`*_#>-]+/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= GOD_TTS_MAX_CHARS) return cleaned;
  return `${cleaned.slice(0, GOD_TTS_MAX_CHARS - 1).trimEnd()}…`;
}

function cacheKey(text, voiceName) {
  return createHash('sha256').update(`god\0${voiceName}\0${text}`).digest('hex');
}

function remember(key, value) {
  if (cache.size >= GOD_TTS_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
}

function getClient(env = process.env, deps = {}) {
  if (deps.client) return deps.client;
  if (sharedClient) return sharedClient;
  const projectId = resolveVertexProjectId(env) || undefined;
  sharedClient = new textToSpeech.TextToSpeechClient(projectId ? { projectId } : undefined);
  return sharedClient;
}

/** Test helper — clears the in-process LRU and shared client. */
export function _resetGodTtsForTests() {
  cache.clear();
  sharedClient = null;
}

/** @internal Test seams. */
export const _MOOD_RATE = MOOD_RATE;
export const _VOICE_BY_ENGINE = VOICE_BY_ENGINE;

function audioConfigFor(voice) {
  const config = { audioEncoding: 'MP3', speakingRate: voice.speakingRate ?? 0.84 };
  // Chirp3-HD rejects pitch — it rides only on Neural2 / WaveNet.
  if (voice.engine !== 'chirp3') config.pitch = voice.pitch ?? 0;
  return config;
}

async function synthesizeVoice(client, voice, text) {
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
      lang: 'en-US'
    };
  } catch (err) {
    console.warn(
      `godTts: ${voice.engine} (${voice.name}) failed, trying fallback:`,
      err?.message ?? err
    );
    return null;
  }
}

/**
 * Synthesize one divine decree, walking Chirp3-HD → Neural2 → WaveNet.
 * Returns null when disabled / empty / every cloud rung fails. Never throws.
 *
 * @param {{ text?: string, mood?: string }} args
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ client?: import('@google-cloud/text-to-speech').TextToSpeechClient }} [deps]
 * @returns {Promise<{ audioBase64: string, mimeType: string, voiceName: string, lang: string } | null>}
 */
export async function synthesizeGodSpeech({ text = '', mood } = {}, env = process.env, deps = {}) {
  if (!isGodTtsEnabled(env)) return null;
  const cleaned = sanitizeGodTtsText(text);
  if (!cleaned) return null;

  const candidates = resolveGodTtsVoiceCandidates(mood, env);
  const key = cacheKey(cleaned, candidates[0].name + ':' + candidates[0].speakingRate);
  const hit = cache.get(key);
  if (hit) return hit;

  let client;
  try {
    client = getClient(env, deps);
  } catch (err) {
    console.warn('godTts: client init failed:', err?.message ?? err);
    return null;
  }
  for (const voice of candidates) {
    const result = await synthesizeVoice(client, voice, cleaned);
    if (result) {
      remember(key, result);
      return result;
    }
  }
  return null;
}
