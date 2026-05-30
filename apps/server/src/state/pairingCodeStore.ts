/**
 * Short pairing codes map external MCP clients to ArchiSlop session ids without
 * embedding the session UUID in a stable MCP server URL.
 */

import { randomInt } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const DEFAULT_PAIRING_TTL_MS = Number(process.env.PAIRING_CODE_TTL_MS) || 60 * 60 * 1000;
const INVITE_REFRESH_TTL_MS = Number(process.env.PAIRING_INVITE_TTL_MS) || 30 * 60 * 1000;

type PairingEntry = {
  sessionId: string;
  expiresAt: number;
  maxUses: number | null;
  usedCount: number;
};

export type PairingResolveReason = 'invalid' | 'unknown' | 'expired' | 'exhausted';

export type PairingResolveResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: PairingResolveReason };

export type PairingCodeStore = ReturnType<typeof createPairingCodeStore>;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)] ?? '';
  }
  return out;
}

export function normalizePairingCode(raw: unknown): string | null {
  const candidate = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!candidate || candidate.length !== CODE_LENGTH) return null;
  if (!/^[A-Z0-9]+$/.test(candidate)) return null;
  return candidate;
}

export function createPairingCodeStore({
  defaultTtlMs = DEFAULT_PAIRING_TTL_MS,
  inviteTtlMs = INVITE_REFRESH_TTL_MS
}: {
  defaultTtlMs?: number;
  inviteTtlMs?: number;
} = {}) {
  const codeToEntry = new Map<string, PairingEntry>();
  const sessionIdToCode = new Map<string, string>();

  function allocateCode(
    sessionId: string,
    { ttlMs = defaultTtlMs, maxUses = null }: { ttlMs?: number; maxUses?: number | null } = {}
  ): string {
    let code: string;
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

  function getOrCreateCode(
    sessionId: string,
    options: { ttlMs?: number; maxUses?: number | null } = {}
  ): string {
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

  function refreshForInvite(sessionId: string): string {
    return getOrCreateCode(sessionId, { ttlMs: inviteTtlMs });
  }

  function resolveDetailed(
    code: string,
    { consumeUse = false }: { consumeUse?: boolean } = {}
  ): PairingResolveResult {
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

  function resolve(code: string): string | null {
    const result = resolveDetailed(code);
    return result.ok ? result.sessionId : null;
  }

  function regenerate(
    sessionId: string,
    options: { ttlMs?: number; maxUses?: number | null } = {}
  ): string {
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) throw new Error('sessionId required');
    const old = sessionIdToCode.get(sid);
    if (old) codeToEntry.delete(old);
    sessionIdToCode.delete(sid);
    return allocateCode(sid, {
      ttlMs: options.ttlMs ?? inviteTtlMs,
      maxUses: options.maxUses ?? null
    });
  }

  function getMeta(code: string): {
    sessionId: string;
    expiresAt: string;
    maxUses: number | null;
    usedCount: number;
  } | null {
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
