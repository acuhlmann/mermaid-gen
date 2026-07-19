/**
 * Thin client for the office Cloud TTS endpoint (POST /api/office/speak →
 * synthesizeOfficeSpeech, the Chirp3-HD → Neural2 → WaveNet ladder in
 * apps/server/src/agents/officeTts.js).
 *
 * Returns `{ audioBase64, mimeType }` on success, or `null` to mean "degrade to
 * Web Speech" — a disabled / unconfigured / failed TTS backend is a feature
 * here, never an error. Shared by the ambient OfficeLayer narrator and the
 * click-to-hear intro narrator so both go through one code path (and one place
 * to reason about cost: the server only ever synthesizes when this is called,
 * and the intro only calls it on an explicit user click).
 */

import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';

/**
 * @param {{ speakerId?: string, text?: string, lang?: string, sessionId?: string }} args
 * @returns {Promise<{ audioBase64: string, mimeType?: string } | null>}
 */
export async function fetchOfficeCloudAudio({ speakerId, text, lang, sessionId } = {}) {
  try {
    const headers = { 'content-type': 'application/json' };
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    const response = await fetch(`${API_BASE_URL}/api/office/speak`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ speakerId, text, lang })
    });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.audio ?? null;
  } catch {
    return null;
  }
}
