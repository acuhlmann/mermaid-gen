import { resolveAgentRunBudgetMs } from '@archislop/shared';
import {
  API_BASE_URL,
  SESSION_HEADER,
  getOrCreateBrowserSessionId,
  normalizeSessionId
} from './diagramSession.js';

export const AGENT_REQUEST_TIMEOUT_MS = 60_000;

/** Max gap between SSE events before we treat the stream as hung and abort. Resets on every event. */
export const AGENT_STREAM_IDLE_TIMEOUT_MS = 60_000;

/**
 * Extra headroom past the server's run budget before the client force-aborts the stream.
 * The server now enforces its own deadline (aborting in-flight model turns) and emits a
 * `run_budget_exceeded` error that carries the last validator diagnostic — give it time
 * to do that instead of racing it with a client-side abort that loses the root cause.
 */
export const AGENT_STREAM_MAX_DURATION_GRACE_MS = 15_000;

/**
 * Timeout for REST mutation requests (intent/transform) that run a full server-side agent
 * loop. Must exceed the server's run budget for the profile — a flat 60s would abort Fast
 * runs client-side at 60s while the server is allowed 75s, producing spurious
 * "request timed out" failures with no root cause.
 */
export function agentMutationTimeoutMs(modelProfile, mode = null) {
  return resolveAgentRunBudgetMs(modelProfile, {}, mode) + AGENT_STREAM_MAX_DURATION_GRACE_MS;
}

export function createSessionHeaders(sessionId) {
  const resolvedSessionId = normalizeSessionId(sessionId) ?? getOrCreateBrowserSessionId();
  return {
    [SESSION_HEADER]: resolvedSessionId
  };
}

export async function fetchWithTimeout(url, options, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(timeoutMessage)), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.message === timeoutMessage) {
      throw new Error(timeoutMessage, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function throwApiPayloadError(payload, fallback) {
  const text = [payload?.error, payload?.message, payload?.details]
    .filter(Boolean)
    .join('\n')
    .trim();
  throw new Error(text || fallback);
}

export { API_BASE_URL };
