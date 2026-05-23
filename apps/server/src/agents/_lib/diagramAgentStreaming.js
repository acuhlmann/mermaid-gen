import { redactSecrets } from '../../utils/redactSecrets.js';
import { getAgentRunnableConfig } from '../agentGraphConfig.js';
import { createPatchToolStreamTracker } from '../streamPatchToolTelemetry.js';
import {
  captureMessagesFromStreamEvent,
  normalizeAgentStreamEvent
} from './diagramAgentHelpers.js';

/**
 * Streaming infrastructure shared by both diagram agents. Both used to run
 * their own near-identical streaming loops; this module factors the common
 * stream → emit → reconstruct-result shape into one place that can be
 * parameterized by the patch tool name and the draft-preview policy.
 */

const DEFAULT_INVOKE_KEEPALIVE_MS = 18_000;

/** @param {NodeJS.ProcessEnv} [env] */
export function resolveInvokeKeepaliveIntervalMs(env = process.env) {
  const raw = env.MERMAID_INVOKE_KEEPALIVE_MS;
  if (raw === undefined || raw === '') return DEFAULT_INVOKE_KEEPALIVE_MS;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 500) return DEFAULT_INVOKE_KEEPALIVE_MS;
  return Math.min(120_000, n);
}

/**
 * Wraps a blocking `agent.invoke` with periodic `status` events so SSE
 * consumers do not hit idle timeouts.
 */
export async function runInvokeWithStreamingKeepalive(emit, env, invokeAsync) {
  if (typeof emit !== 'function') {
    return invokeAsync();
  }
  const intervalMs = resolveInvokeKeepaliveIntervalMs(env);
  const id = setInterval(() => {
    emit({ type: 'status', text: 'Still working…' });
  }, intervalMs);
  try {
    return await invokeAsync();
  } finally {
    clearInterval(id);
  }
}

const STREAM_HEARTBEAT_MS = 6_000;

function resolveStreamHeartbeatMs(env) {
  const raw = env?.MERMAID_STREAM_HEARTBEAT_MS;
  if (raw == null || raw === '') return STREAM_HEARTBEAT_MS;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1000) return STREAM_HEARTBEAT_MS;
  return Math.min(60_000, n);
}

/**
 * Run a streaming agent turn, forwarding normalized stream events to `emit`,
 * heartbeating when the model goes quiet, and recording patch-tool telemetry
 * via the supplied tracker config.
 */
export async function streamReactAgentEvents({
  agent,
  inputMessages,
  emit,
  env,
  abortSignal,
  patchToolName,
  contentType,
  emitDraftPreview
}) {
  const runnableConfig = {
    ...getAgentRunnableConfig(env),
    ...(abortSignal ? { signal: abortSignal } : {})
  };
  let latestMessages = [];
  const patchTelemetry =
    typeof emit === 'function'
      ? createPatchToolStreamTracker({
          emit,
          patchToolName,
          contentType,
          emitDraftPreview
        })
      : null;

  // Heartbeat keeps the SSE consumer alive when the model is internally
  // working but not yet emitting normalized events. Resets on any emitted
  // event so a healthy stream costs nothing.
  let lastActivity = Date.now();
  const intervalMs = resolveStreamHeartbeatMs(env);
  const heartbeat =
    typeof emit === 'function'
      ? setInterval(() => {
          if (Date.now() - lastActivity >= intervalMs) {
            emit({ type: 'status', text: 'Thinking…' });
            lastActivity = Date.now();
          }
        }, intervalMs)
      : null;

  try {
    const stream = await agent.streamEvents(
      { messages: inputMessages },
      { version: 'v2', ...runnableConfig }
    );
    for await (const ev of stream) {
      latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
      const normalized = normalizeAgentStreamEvent(ev);
      if (normalized) {
        emit(normalized);
        lastActivity = Date.now();
      }
      if (patchTelemetry && ev?.event === 'on_chat_model_stream') {
        const chunks = ev.data?.chunk?.tool_call_chunks;
        if (Array.isArray(chunks) && chunks.length > 0) {
          patchTelemetry.processToolCallChunks(chunks);
          lastActivity = Date.now();
        }
      }
    }
  } catch (error) {
    emit({
      type: 'error',
      message: redactSecrets(error instanceof Error ? error.message : String(error))
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
  return { messages: latestMessages };
}

/**
 * Runs one agent turn against `inputMessages`.
 * When `emit` is provided, prefers streamed events so tokens flow to the UI
 * during retries. Falls back to `agent.invoke` if the stream yielded no
 * messages.
 */
export async function runAgentTurn({
  agent,
  inputMessages,
  emit,
  env,
  abortSignal,
  patchToolName,
  contentType,
  emitDraftPreview = false
}) {
  const runnableConfig = {
    ...getAgentRunnableConfig(env),
    ...(abortSignal ? { signal: abortSignal } : {})
  };
  if (typeof emit !== 'function') {
    return agent.invoke({ messages: inputMessages }, runnableConfig);
  }

  const streamed = await streamReactAgentEvents({
    agent,
    inputMessages,
    emit,
    env,
    abortSignal,
    patchToolName,
    contentType,
    emitDraftPreview
  });
  if (streamed.messages?.length) {
    return streamed;
  }

  emit({ type: 'phase', id: 'invoke_fallback', label: 'Finalizing response…' });
  return runInvokeWithStreamingKeepalive(emit, env, () =>
    agent.invoke({ messages: inputMessages }, runnableConfig)
  );
}
