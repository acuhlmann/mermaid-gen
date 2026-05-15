/**
 * Short pairing codes map external MCP clients to ArchiSlop session ids without
 * embedding the session UUID in a stable MCP server URL.
 */

import { randomInt } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const DEFAULT_PAIRING_TTL_MS = Number(process.env.PAIRING_CODE_TTL_MS) || 60 * 60 * 1000;
const INVITE_REFRESH_TTL_MS = Number(process.env.PAIRING_INVITE_TTL_MS) || 30 * 60 * 1000;

function randomCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** @param {string} raw */
export function normalizePairingCode(raw) {
  const candidate = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!candidate || candidate.length !== CODE_LENGTH) return null;
  if (!/^[A-Z0-9]+$/.test(candidate)) return null;
  return candidate;
}

/**
 * @typedef {'invalid' | 'unknown' | 'expired' | 'exhausted'} PairingResolveReason
 */

/**
 * @param {{ defaultTtlMs?: number, inviteTtlMs?: number }} [options]
 */
export function createPairingCodeStore({
  defaultTtlMs = DEFAULT_PAIRING_TTL_MS,
  inviteTtlMs = INVITE_REFRESH_TTL_MS
} = {}) {
  /** @type {Map<string, { sessionId: string, expiresAt: number, maxUses: number | null, usedCount: number }>} */
  const codeToEntry = new Map();
  /** @type {Map<string, string>} */
  const sessionIdToCode = new Map();

  function allocateCode(sessionId, { ttlMs = defaultTtlMs, maxUses = null } = {}) {
    let code;
    let attempts = 0;
    do {
      code = randomCode();
      attempts += 1;
      if (attempts > 50) throw new Error('Failed to allocate pairing code');
    } while (codeToEntry.has(code));

    const expiresAt = Date.now() + ttlMs;
    codeToEntry.set(code, { sessionId, expiresAt, maxUses, usedCount: 0 });
    sessionIdToCode.set(sessionId, code);
    return code;
  }

  function getOrCreateCode(sessionId, options = {}) {
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) throw new Error('sessionId required');
    const existing = sessionIdToCode.get(sid);
    if (existing) {
      const entry = codeToEntry.get(existing);
      if (entry && Date.now() <= entry.expiresAt) {
        if (options.ttlMs != null) entry.expiresAt = Date.now() + options.ttlMs;
        if (options.maxUses != null) entry.maxUses = options.maxUses;
        return existing;
      }
      codeToEntry.delete(existing);
      sessionIdToCode.delete(sid);
    }
    return allocateCode(sid, options);
  }

  function refreshForInvite(sessionId) {
    return getOrCreateCode(sessionId, { ttlMs: inviteTtlMs });
  }

  /**
   * @param {string} code
   * @param {{ consumeUse?: boolean }} [options]
   * @returns {{ ok: true, sessionId: string } | { ok: false, reason: PairingResolveReason }}
   */
  function resolveDetailed(code, { consumeUse = false } = {}) {
    const normalized = normalizePairingCode(code);
    if (!normalized) return { ok: false, reason: 'invalid' };
    const entry = codeToEntry.get(normalized);
    if (!entry) return { ok: false, reason: 'unknown' };
    if (Date.now() > entry.expiresAt) return { ok: false, reason: 'expired' };
    if (entry.maxUses != null && entry.usedCount >= entry.maxUses) {
      return { ok: false, reason: 'exhausted' };
    }
    if (consumeUse) entry.usedCount += 1;
    return { ok: true, sessionId: entry.sessionId };
  }

  /** @param {string} code */
  function resolve(code) {
    const result = resolveDetailed(code);
    return result.ok ? result.sessionId : null;
  }

  function regenerate(sessionId, options = {}) {
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) throw new Error('sessionId required');
    const old = sessionIdToCode.get(sid);
    if (old) codeToEntry.delete(old);
    sessionIdToCode.delete(sid);
    return allocateCode(sid, { ttlMs: options.ttlMs ?? inviteTtlMs, maxUses: options.maxUses ?? null });
  }

  function getMeta(code) {
    const normalized = normalizePairingCode(code);
    if (!normalized) return null;
    const entry = codeToEntry.get(normalized);
    if (!entry) return null;
    return {
      sessionId: entry.sessionId,
      expiresAt: new Date(entry.expiresAt).toISOString(),
      maxUses: entry.maxUses,
      usedCount: entry.usedCount
    };
  }

  return {
    getOrCreateCode,
    refreshForInvite,
    resolve,
    resolveDetailed,
    regenerate,
    getMeta,
    defaultTtlMs,
    inviteTtlMs
  };
}

export { DEFAULT_PAIRING_TTL_MS, INVITE_REFRESH_TTL_MS };
