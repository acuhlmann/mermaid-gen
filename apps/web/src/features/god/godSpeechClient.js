/**
 * Thin client for ArchiSlop God's Cloud TTS endpoint
 * (POST /api/god/petition/speak → synthesizeGodSpeech, the
 * Chirp3-HD Charon → Neural2 → WaveNet ladder in
 * apps/server/src/agents/godTts.js).
 *
 * Returns `{ audioBase64, mimeType }` on success, or `null` to mean
 * "degrade to Web Speech" — a disabled / unconfigured / failed TTS
 * backend is never an error at the Altar. Like the petition client,
 * this deliberately never emits uxSignals.
 */
import { API_BASE_URL } from '../../state/diagramSession.js';

export const GOD_SPEAK_PATH = '/api/god/petition/speak';

/**
 * @param {{ text?: string, mood?: string }} args
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<{ audioBase64: string, mimeType?: string } | null>}
 */
export async function fetchGodCloudAudio({ text, mood } = {}, { fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(`${API_BASE_URL}${GOD_SPEAK_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ text, mood })
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.audio ?? null;
  } catch {
    return null;
  }
}
