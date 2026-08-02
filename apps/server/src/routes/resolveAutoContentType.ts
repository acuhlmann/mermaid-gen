/**
 * Resolve Auto (`contentType: 'auto'`) to a concrete slot before agent dispatch.
 * Intent/Go only — transform/analyze never accept auto on the wire.
 */

import {
  AUTO_CONTENT_TYPE,
  AGUI_CUSTOM_NAME_CONTENT_TYPE,
  AGUI_CUSTOM_NAME_MODEL_CALL,
  customEvent,
  type ContentType
} from '@archislop/shared';
import {
  inferContentTypeFromPrompt,
  type InferContentTypeResult
} from '../agents/inferContentType.js';

export type ResolvedSlotState = {
  revisionId: number;
  diagramSource: string;
  contentType?: string;
  [key: string]: unknown;
};

type StreamEmit = (evt: ReturnType<typeof customEvent> | Record<string, unknown>) => void;

type InferFn = (args: {
  prompt: string;
  contentType: string | null | undefined;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
}) => Promise<InferContentTypeResult>;

/**
 * Emit Auto-classifier token usage as AG-UI model_call events so the thinking
 * panel + Stakeholder Damage Report include the classification spend.
 */
function emitClassifierModelCall(
  emit: StreamEmit | undefined,
  {
    model,
    usage
  }: {
    model?: string | null;
    usage?: { inputTokens?: number; outputTokens?: number } | null;
  }
) {
  if (typeof emit !== 'function' || !usage || typeof usage !== 'object') return;
  const inputTokens = Number(usage.inputTokens);
  const outputTokens = Number(usage.outputTokens);
  if (!Number.isFinite(inputTokens) && !Number.isFinite(outputTokens)) return;
  const modelId = typeof model === 'string' ? model : '';
  const callId = `auto-classify-${Date.now()}`;
  emit(
    customEvent({
      name: AGUI_CUSTOM_NAME_MODEL_CALL,
      value: { phase: 'start', callId, ...(modelId ? { model: modelId } : {}) }
    })
  );
  emit(
    customEvent({
      name: AGUI_CUSTOM_NAME_MODEL_CALL,
      value: {
        phase: 'end',
        callId,
        ...(modelId ? { model: modelId } : {}),
        ...(Number.isFinite(inputTokens) ? { inputTokens } : {}),
        ...(Number.isFinite(outputTokens) ? { outputTokens } : {})
      }
    })
  );
}

/**
 * When the client sends Auto, classify the prompt and adopt the target slot's
 * server-side revision/source (client placeholders are not meaningful for Auto).
 */
export async function resolveAutoIntentContentType<
  T extends {
    contentType: string;
    prompt: string;
    revisionId: number;
    diagramSource: string;
  }
>({
  payload,
  getSlot,
  env = process.env,
  abortSignal,
  onResolved,
  infer = inferContentTypeFromPrompt
}: {
  payload: T;
  getSlot: (contentType: ContentType) => ResolvedSlotState;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  onResolved?: StreamEmit;
  /** Test seam — production uses {@link inferContentTypeFromPrompt}. */
  infer?: InferFn;
}): Promise<T & { contentType: ContentType }> {
  if (payload.contentType !== AUTO_CONTENT_TYPE) {
    return payload as T & { contentType: ContentType };
  }

  const inferred = await infer({
    prompt: payload.prompt,
    contentType: AUTO_CONTENT_TYPE,
    env,
    abortSignal
  });

  emitClassifierModelCall(onResolved, {
    model: inferred.model,
    usage: inferred.usage
  });

  onResolved?.(
    customEvent({
      name: AGUI_CUSTOM_NAME_CONTENT_TYPE,
      value: {
        contentType: inferred.contentType,
        ...(inferred.reason ? { reason: inferred.reason } : {})
      }
    })
  );

  const slot = getSlot(inferred.contentType);
  return {
    ...payload,
    contentType: inferred.contentType,
    revisionId: slot.revisionId,
    diagramSource: typeof slot.diagramSource === 'string' ? slot.diagramSource : ''
  };
}
