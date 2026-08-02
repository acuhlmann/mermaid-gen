import { resolveHealthCheckUrl } from '../utils/coldStartGate.js';

/** @typedef {{ fast: string | null, quality: string | null, decorative: string | null }} LlmModelsByProfile */

/** @type {LlmModelsByProfile} */
const EMPTY = { fast: null, quality: null, decorative: null };

/** @type {LlmModelsByProfile | null} */
let cached = null;
/** @type {Promise<LlmModelsByProfile> | null} */
let inflight = null;

/**
 * @param {unknown} raw
 * @returns {LlmModelsByProfile}
 */
function normalizeModels(raw) {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const pick = (key) => {
    const v = obj[key];
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    if (!trimmed || trimmed === 'none') return null;
    return trimmed;
  };
  return {
    fast: pick('fast'),
    quality: pick('quality'),
    decorative: pick('decorative')
  };
}

/** Fetch `/api/health` model labels (cached). */
export async function loadLlmModelsByProfile() {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch(resolveHealthCheckUrl(), { cache: 'no-store' });
      if (!response.ok) throw new Error(`health ${response.status}`);
      const body = await response.json();
      cached = normalizeModels(body?.llmModelsByProfile);
      return cached;
    } catch {
      cached = { ...EMPTY };
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Synchronous read after `loadLlmModelsByProfile` has resolved at least once. */
export function getCachedLlmModelsByProfile() {
  return cached ?? EMPTY;
}

/** Test hook — reset module cache between Vitest cases. */
export function resetLlmModelsByProfileCacheForTests() {
  cached = null;
  inflight = null;
}

/**
 * Human-facing slug for a Brain profile (`deepseek-v4-flash`), stripping the backend prefix.
 * @param {string | null | undefined} label
 */
export function shortModelSlug(label) {
  if (typeof label !== 'string' || !label.trim()) return '';
  const trimmed = label.trim();
  if (trimmed.startsWith('google/')) return trimmed;
  const idx = trimmed.indexOf(':');
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}
