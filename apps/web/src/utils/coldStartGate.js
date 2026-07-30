import { COLD_START_COPY } from './coldStartCopy.js';
import { waitForAppReady } from './appReadySignal.js';

const DEFAULT_INITIAL_DELAY_MS = 1_500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_BACKOFF_FACTOR = 1.35;
const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

/**
 * Resolve `/api/health` for same-origin production and local Vite dev (proxied /api).
 * @param {{ location?: Location; apiBaseMeta?: string | null }} [options]
 */
export function resolveHealthCheckUrl({ location = globalThis.location, apiBaseMeta = null } = {}) {
  const meta =
    apiBaseMeta ??
    (typeof document !== 'undefined'
      ? document.querySelector('meta[name="archislop-api-base"]')?.getAttribute('content')
      : null);
  const trimmedMeta = typeof meta === 'string' ? meta.trim().replace(/\/+$/, '') : '';
  if (trimmedMeta) return `${trimmedMeta}/api/health`;

  const origin = location?.origin?.replace(/\/+$/, '') ?? '';
  return `${origin}/api/health`;
}

/**
 * @param {Response} response
 */
export async function isHealthReadyResponse(response) {
  if (!response.ok) return false;

  try {
    const body = await response.json();
    return body?.status === 'ok' && body?.runtimeReady !== false;
  } catch {
    return false;
  }
}

/**
 * Poll health until ready or timeout. Invokes `onPhase` when the user-facing message changes.
 *
 * The static `index.html` shell already shows the waking (loading) copy before JS runs.
 * This poll keeps that message visible through scale-to-zero cold starts and only skips
 * the gate quickly when health is already warm.
 *
 * @param {{
 *   fetchImpl?: typeof fetch;
 *   healthUrl?: string;
 *   initialDelayMs?: number;
 *   maxDelayMs?: number;
 *   timeoutMs?: number;
 *   backoffFactor?: number;
 *   fetchTimeoutMs?: number;
 *   onPhase?: (phase: 'checking' | 'waking' | 'timeout') => void;
 *   signal?: AbortSignal;
 * }} [options]
 */
export async function pollHealthUntilReady({
  fetchImpl = fetch,
  healthUrl = resolveHealthCheckUrl(),
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  backoffFactor = DEFAULT_BACKOFF_FACTOR,
  fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
  onPhase,
  signal
} = {}) {
  const startedAt = Date.now();
  let delayMs = initialDelayMs;
  let announcedWaking = false;

  const announceWaking = () => {
    if (announcedWaking) return;
    announcedWaking = true;
    onPhase?.('waking');
  };

  announceWaking();

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) {
      throw new DOMException('Cold start poll aborted', 'AbortError');
    }

    try {
      const response = await fetchWithTimeout(fetchImpl, healthUrl, fetchTimeoutMs, signal);

      if (await isHealthReadyResponse(response)) {
        return { ok: true, elapsedMs: Date.now() - startedAt };
      }
    } catch {
      // Retry after backoff — typical while Cloud Run scales from zero.
    }

    await sleep(delayMs, signal);
    delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffFactor));
  }

  onPhase?.('timeout');
  return { ok: false, elapsedMs: Date.now() - startedAt };
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} healthUrl
 * @param {number} timeoutMs
 * @param {AbortSignal | undefined} signal
 */
async function fetchWithTimeout(fetchImpl, healthUrl, timeoutMs, signal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onParentAbort = () => controller.abort();
  signal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    return await fetchImpl(healthUrl, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onParentAbort);
  }
}

/**
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cold start poll aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Cold start poll aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

export { COLD_START_COPY, waitForAppReady };
