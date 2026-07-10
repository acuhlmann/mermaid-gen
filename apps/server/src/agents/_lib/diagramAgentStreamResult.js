import { emitStyleEditsBeforeFinal } from '../styleEditsStream.js';
import { normalizeContentType } from '@archislop/shared';

/** User-visible SSE when a mutation stream ends without a diagram revision bump. */
export const STREAM_ERROR_NO_MUTATION_REVISION =
  'The diagram was not updated—no valid patch was applied. You can retry or switch model tier (Fast vs Quality).';

/**
 * Emits `final` (and optionally `error` when no patch landed) for
 * intent/transform agent streams. Content-type agnostic — the slot to
 * read is picked from the `contentType` argument.
 *
 * Used by both the mermaid and infographic lazy agent services.
 *
 * @param {{
 *   emit: (e: unknown) => void,
 *   operation: string,
 *   revisionBefore: unknown,
 *   stateStore: { getSlot: (kind: string) => { revisionId: number }, setLastUserPrompt: (args: { contentType: string, prompt: string }) => unknown, mirrorLastUserPromptToSibling: (args: { contentType: string, prompt: string }) => unknown },
 *   agentResult: { message?: string } | null | undefined,
 *   prompt?: string,
 *   contentType?: 'mermaid' | 'infographic' | 'metaphor3d' | 'chart' | 'anything'
 * }} args
 */
export function emitIntentTransformStreamResult({
  emit,
  operation,
  revisionBefore,
  stateStore,
  agentResult,
  prompt,
  contentType = 'mermaid'
}) {
  const slotKey = normalizeContentType(contentType);
  let afterState = stateStore.getSlot(slotKey);
  const agentMessage = typeof agentResult?.message === 'string' ? agentResult.message.trim() : '';
  const revisionChanged =
    typeof revisionBefore === 'number' ? afterState.revisionId !== revisionBefore : true;

  // Record the topic on a successful intent so mode-switch can carry it across.
  if (revisionChanged && operation === 'intent' && typeof prompt === 'string') {
    afterState = stateStore.setLastUserPrompt({ contentType: slotKey, prompt });
    stateStore.mirrorLastUserPromptToSibling({ contentType: slotKey, prompt });
  }

  if (
    typeof emit === 'function' &&
    !revisionChanged &&
    (operation === 'intent' || operation === 'transform')
  ) {
    emit({
      type: 'error',
      code: 'no_mutation_revision',
      message: agentMessage || STREAM_ERROR_NO_MUTATION_REVISION
    });
  }

  if (typeof emit === 'function') {
    emitStyleEditsBeforeFinal(emit, { message: agentResult?.message ?? '' });
    emit({
      type: 'final',
      revisionChanged,
      message: agentMessage,
      state: revisionChanged ? afterState : undefined
    });
  }
}
