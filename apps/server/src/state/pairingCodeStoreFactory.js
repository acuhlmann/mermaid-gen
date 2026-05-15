import { createPairingCodeStore } from './pairingCodeStore.js';

/**
 * Returns an in-memory pairing store, or a Redis-backed store when REDIS_URL is set.
 * Redis enables pairing codes to resolve across Cloud Run instances (diagram state remains per-instance unless further shared).
 */
export async function createPairingCodeStoreFromEnv() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return { store: createPairingCodeStore(), backend: 'memory' };
  }

  try {
    const { createRedisPairingCodeStore } = await import('./pairingCodeStoreRedis.js');
    const store = await createRedisPairingCodeStore(redisUrl);
    return { store, backend: 'redis' };
  } catch (error) {
    console.warn(
      'REDIS_URL set but Redis pairing store failed; falling back to in-memory:',
      error?.message ?? error
    );
    return { store: createPairingCodeStore(), backend: 'memory' };
  }
}
