import { COLD_START_COPY } from './coldStartCopy.js';

const DEFAULT_INITIAL_DELAY_MS = 1_500;
const DEFAULT_MAX_DELAY_MS = 8_000;
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_BACKOFF_FACTOR = 1.35;
/** Brief "checking" copy before showing the longer cold-start / loading message. */
const DEFAULT_CHECKING_GRACE_MS = 1_200;

/**
 * Resolve `/api/health` for same-origin production and local Vite dev (API on :4000).
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

  const host = location?.hostname ?? '';
  const port = location?.port ?? '';
  const isLocalDevHost = host === 'localhost' || host === '127.0.0.1';
  const isViteDevPort = port && port !== '4000' && port !== '8080';

  if (isLocalDevHost && isViteDevPort) {
    return `http://${host}:4000/api/health`;
  }

  const origin = location?.origin?.replace(/\/+$/, '') ?? '';
  return `${origin}/api/health`;
}

/**
 * @param {Response} response
 */
export function isHealthReadyResponse(response) {
  return response.ok;
}

/**
 * Poll health until ready or timeout. Invokes `onPhase` when the user-facing message changes.
 *
 * @param {{
 *   fetchImpl?: typeof fetch;
 *   healthUrl?: string;
 *   initialDelayMs?: number;
 *   maxDelayMs?: number;
 *   timeoutMs?: number;
 *   backoffFactor?: number;
 *   checkingGraceMs?: number;
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
  checkingGraceMs = DEFAULT_CHECKING_GRACE_MS,
  onPhase,
  signal
} = {}) {
  const startedAt = Date.now();
  let delayMs = initialDelayMs;
  let announcedWaking = false;
  let settled = false;

  const announceWaking = () => {
    if (announcedWaking || settled) return;
    announcedWaking = true;
    onPhase?.('waking');
  };

  const finish = (result) => {
    settled = true;
    clearTimeout(graceTimer);
    return result;
  };

  onPhase?.('checking');
  const graceTimer = setTimeout(announceWaking, checkingGraceMs);

  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) {
        throw new DOMException('Cold start poll aborted', 'AbortError');
      }

      try {
        const response = await fetchImpl(healthUrl, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal
        });

        if (isHealthReadyResponse(response)) {
          return finish({ ok: true, elapsedMs: Date.now() - startedAt });
        }

        announceWaking();
      } catch {
        announceWaking();
      }

      await sleep(delayMs, signal);
      delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffFactor));
    }

    onPhase?.('timeout');
    return finish({ ok: false, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    finish();
    throw error;
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

export { COLD_START_COPY };
