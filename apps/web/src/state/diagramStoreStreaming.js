import {
  buildAgentRunBudgetExceededMessage,
  resolveAgentRunBudgetMs,
  sanitizeAgentStreamPayload
} from '@archislop/shared';
import { CopilotStreamHttpAgent } from './copilotStreamHttpAgent.js';
import { createAgUiTranslator } from './agUiTranslator.js';
import {
  AGENT_STREAM_IDLE_TIMEOUT_MS,
  AGENT_STREAM_MAX_DURATION_GRACE_MS,
  API_BASE_URL,
  createSessionHeaders,
  throwApiPayloadError
} from './diagramStoreHttp.js';

/**
 * Streams SSE from POST /api/copilotkit/agent-stream (AG-UI wire only). Uses
 * @ag-ui/client HttpAgent for decode + validation; `createAgUiTranslator` maps
 * each event to the legacy union consumed by `applyAgentStreamInsightEvent`.
 *
 * Includes an idle timeout: if no event arrives for AGENT_STREAM_IDLE_TIMEOUT_MS, the run is
 * aborted as if the caller's signal fired. Healthy agent runs emit events well within that gap,
 * so this only fires on truly hung streams.
 */
export async function streamDiagramAgent(payload, onEvent, options = {}) {
  const wirePayload = sanitizeAgentStreamPayload(payload);
  const { signal: callerSignal, sessionId } = options;
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const abortController = new AbortController();
  let idleTimedOut = false;
  let maxDurationTimedOut = false;
  let idleTimer = null;
  let maxDurationTimer = null;
  // Mirror the server's budget, including per-mode headroom (Russ runs get a longer
  // server budget; without the mode here the client would abort those runs early).
  const runBudgetMs = resolveAgentRunBudgetMs(
    wirePayload.modelProfile,
    {},
    typeof wirePayload.mode === 'string' ? wirePayload.mode : null
  );
  const maxDurationMs = runBudgetMs + AGENT_STREAM_MAX_DURATION_GRACE_MS;
  const armIdleTimer = () => {
    if (idleTimer != null) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      abortController.abort();
    }, AGENT_STREAM_IDLE_TIMEOUT_MS);
  };
  const clearIdleTimer = () => {
    if (idleTimer != null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  const armMaxDurationTimer = () => {
    maxDurationTimer = setTimeout(() => {
      maxDurationTimedOut = true;
      abortController.abort();
    }, maxDurationMs);
  };
  const clearMaxDurationTimer = () => {
    if (maxDurationTimer != null) {
      clearTimeout(maxDurationTimer);
      maxDurationTimer = null;
    }
  };

  let onCallerAbort = null;
  if (callerSignal) {
    onCallerAbort = () => abortController.abort();
    callerSignal.addEventListener('abort', onCallerAbort);
  }
  armIdleTimer();
  armMaxDurationTimer();

  const isAbortError = (err) =>
    err?.name === 'AbortError' ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError');

  const translate = createAgUiTranslator();

  const agent = new CopilotStreamHttpAgent(
    {
      url: `${API_BASE_URL}/api/copilotkit/agent-stream?protocol=agui`,
      headers: createSessionHeaders(sessionId)
    },
    wirePayload
  );

  agent.subscribe({
    onEvent: ({ event }) => {
      armIdleTimer();
      const translated = translate(event);
      if (translated) onEvent(translated);
      // HttpAgent's defaultApplyEvents tries to apply STATE_DELTA/SNAPSHOT against
      // its own (always empty here) state/messages and warns on every patch miss.
      // We don't consume agent.state / agent.messages, so short-circuit the apply.
      return { stopPropagation: true };
    }
  });

  let runError = null;
  try {
    await agent.runAgent({ abortController });
  } catch (err) {
    runError = err;
  } finally {
    clearIdleTimer();
    clearMaxDurationTimer();
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }

  if (idleTimedOut) {
    throw new Error('Agent stream stalled (no events received). Please try again.');
  }
  if (maxDurationTimedOut) {
    throw new Error(buildAgentRunBudgetExceededMessage(wirePayload.modelProfile, runBudgetMs));
  }
  if (callerSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  if (runError) {
    if (isAbortError(runError)) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (runError.payload && typeof runError.payload === 'object') {
      throwApiPayloadError(runError.payload, runError.message || 'Stream request failed');
    }
    throw runError;
  }
}
