/**
 * Client for ArchiSlop God's conversational prayer & Wish-to-PR petition endpoints.
 * Deliberately never emits `uxSignals` so talking to God never skews product telemetry.
 */
import { API_BASE_URL } from '../../state/diagramSession.js';

export const GOD_PETITION_PATH = '/api/god/petition';
export const GOD_PETITION_CAPABILITIES_PATH = '/api/god/petition/capabilities';
export const GOD_PETITION_FILE_PR_PATH = '/api/god/petition/file-pr';
export const GOD_PETITION_DISPATCH_PATH = '/api/god/petition/dispatch';

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchGodCapabilities({ fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(`${API_BASE_URL}${GOD_PETITION_CAPABILITIES_PATH}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await readJsonSafe(res);
  } catch {
    return null;
  }
}

export async function sendGodPrayer(payload, { fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_BASE_URL}${GOD_PETITION_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
  } catch {
    return {
      ok: false,
      error: 'The celestial uplink snapped. Even deities suffer transient 502s.'
    };
  }
  const body = await readJsonSafe(res);
  if (!res.ok || !body) {
    return {
      ok: false,
      error: body?.error || `The Heavens rejected thy prayer (HTTP ${res.status}).`
    };
  }
  return { ok: true, data: body };
}

export async function fileGodPetitionPr(payload, { fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_BASE_URL}${GOD_PETITION_FILE_PR_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
  } catch {
    return {
      ok: false,
      error: 'Could not reach the Celestial PR Forge.'
    };
  }
  const body = await readJsonSafe(res);
  if (!res.ok || !body) {
    return {
      ok: false,
      error: body?.error || `The PR Forge refused the decree (HTTP ${res.status}).`
    };
  }
  return { ok: true, data: body };
}

export async function dispatchGodWorkflow(payload, { fetchImpl = fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(`${API_BASE_URL}${GOD_PETITION_DISPATCH_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
  } catch {
    return {
      ok: false,
      error: 'Could not reach the GitHub Actions dispatch relay.'
    };
  }
  const body = await readJsonSafe(res);
  if (!res.ok || !body) {
    return {
      ok: false,
      error: body?.error || `Workflow dispatch failed (HTTP ${res.status}).`
    };
  }
  return { ok: true, data: body };
}
