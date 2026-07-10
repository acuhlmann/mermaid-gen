import {
  createPairingCodeStore,
  DEFAULT_PAIRING_TTL_MS,
  INVITE_REFRESH_TTL_MS,
  normalizePairingCode
} from './pairingCodeStore.js';

const KEY_PREFIX = 'archislop:pairing:';

/**
 * Redis-backed pairing codes for multi-instance Cloud Run.
 * @param {string} redisUrl
 */
export async function createRedisPairingCodeStore(redisUrl) {
  const { createClient } = await import('redis');
  const client = createClient({ url: redisUrl });
  client.on('error', (err) => {
    console.warn('Redis pairing client error:', err?.message ?? err);
  });
  await client.connect();

  const memoryFallback = createPairingCodeStore();
  const defaultTtlMs = DEFAULT_PAIRING_TTL_MS;
  const inviteTtlMs = INVITE_REFRESH_TTL_MS;

  async function readEntry(code) {
    const raw = await client.get(`${KEY_PREFIX}code:${code}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('pairingCodeStoreRedis: readEntry JSON parse failed:', err?.message ?? err);
      return null;
    }
  }

  async function writeEntry(code, entry, ttlMs) {
    const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
    await client.set(`${KEY_PREFIX}code:${code}`, JSON.stringify(entry), { EX: ttlSec });
    await client.set(`${KEY_PREFIX}session:${entry.sessionId}`, code, { EX: ttlSec });
  }

  async function getOrCreateCode(sessionId, options = {}) {
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) throw new Error('sessionId required');
    try {
      const existingCode = await client.get(`${KEY_PREFIX}session:${sid}`);
      if (existingCode) {
        const entry = await readEntry(existingCode);
        if (entry && Date.now() <= entry.expiresAt) {
          if (options.ttlMs != null) {
            entry.expiresAt = Date.now() + options.ttlMs;
            await writeEntry(existingCode, entry, options.ttlMs);
          }
          if (options.maxUses != null) entry.maxUses = options.maxUses;
          return existingCode;
        }
      }
      const code = memoryFallback.regenerate(sid, options);
      const ttl = options.ttlMs ?? defaultTtlMs;
      const expiresAt = Date.now() + ttl;
      await writeEntry(
        code,
        { sessionId: sid, expiresAt, maxUses: options.maxUses ?? null, usedCount: 0 },
        ttl
      );
      return code;
    } catch (err) {
      console.warn(
        'pairingCodeStoreRedis: getOrCreateCode falling back to memory store:',
        err?.message ?? err
      );
      return memoryFallback.getOrCreateCode(sessionId, options);
    }
  }

  function refreshForInvite(sessionId) {
    return getOrCreateCode(sessionId, { ttlMs: inviteTtlMs });
  }

  async function resolveDetailed(code, options = {}) {
    const normalized = normalizePairingCode(code);
    if (!normalized) return { ok: false, reason: 'invalid' };
    try {
      const entry = await readEntry(normalized);
      if (!entry) return { ok: false, reason: 'unknown' };
      if (Date.now() > entry.expiresAt) return { ok: false, reason: 'expired' };
      if (entry.maxUses != null && entry.usedCount >= entry.maxUses) {
        return { ok: false, reason: 'exhausted' };
      }
      if (options.consumeUse) {
        entry.usedCount += 1;
        await writeEntry(normalized, entry, Math.max(1000, entry.expiresAt - Date.now()));
      }
      return { ok: true, sessionId: entry.sessionId };
    } catch (err) {
      console.warn(
        'pairingCodeStoreRedis: resolveDetailed falling back to memory store:',
        err?.message ?? err
      );
      return memoryFallback.resolveDetailed(code, options);
    }
  }

  async function resolve(code) {
    const result = await resolveDetailed(code);
    return result.ok ? result.sessionId : null;
  }

  async function regenerate(sessionId, options = {}) {
    const sid = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!sid) throw new Error('sessionId required');
    try {
      const old = await client.get(`${KEY_PREFIX}session:${sid}`);
      if (old) await client.del(`${KEY_PREFIX}code:${old}`);
      await client.del(`${KEY_PREFIX}session:${sid}`);
    } catch (err) {
      console.warn('pairingCodeStoreRedis: regenerate cleanup failed:', err?.message ?? err);
    }
    return getOrCreateCode(sid, {
      ttlMs: options.ttlMs ?? inviteTtlMs,
      maxUses: options.maxUses ?? null
    });
  }

  function getMeta(code) {
    return memoryFallback.getMeta(code);
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
