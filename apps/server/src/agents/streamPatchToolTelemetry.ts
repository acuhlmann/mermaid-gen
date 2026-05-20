import type { ContentType, LegacyPlanBeatEvent, LegacyDraftPreviewEvent } from '@archislop/shared';
import { extractJsonStringPrefix } from './partialJsonString.js';

const MIN_REASON_EMIT_LEN = 14;
const REASON_EMIT_DELTA = 10;

type ToolCallChunk = {
  id?: string;
  index?: number;
  name?: string;
  args?: string;
};

export type PatchStreamEmit = (
  evt: LegacyPlanBeatEvent | LegacyDraftPreviewEvent
) => void;

/** Tracks in-flight patch tool args and emits diagram-focused plan beats plus optional drafts. */
export function createPatchToolStreamTracker({
  emit,
  patchToolName,
  contentType,
  emitDraftPreview = contentType === 'infographic'
}: {
  emit?: PatchStreamEmit;
  patchToolName: string;
  contentType: ContentType;
  emitDraftPreview?: boolean;
}) {
  const buffers = new Map<string, { name: string; argsBuffer: string; lastDraftEmitted: number }>();
  let lastReasonEmitted = '';

  function processToolCallChunks(chunks: ToolCallChunk[] | undefined) {
    if (!Array.isArray(chunks) || typeof emit !== 'function') return;
    for (const tcc of chunks) {
      const bufferKey = tcc.id || `idx_${tcc.index ?? 0}`;
      let entry = buffers.get(bufferKey);
      if (!entry) {
        entry = { name: '', argsBuffer: '', lastDraftEmitted: 0 };
        buffers.set(bufferKey, entry);
      }
      if (tcc.name) entry.name = tcc.name;
      if (typeof tcc.args === 'string' && tcc.args) {
        entry.argsBuffer += tcc.args;
      }
      if (entry.name !== patchToolName || !entry.argsBuffer) continue;

      const reason = extractJsonStringPrefix(entry.argsBuffer, 'reason');
      if (
        reason.length >= MIN_REASON_EMIT_LEN &&
        reason.length >= lastReasonEmitted.length + REASON_EMIT_DELTA
      ) {
        lastReasonEmitted = reason;
        emit({ type: 'plan_beat', text: reason.trim(), source: 'agent' });
      }

      if (!emitDraftPreview) continue;
      const accumulated = extractJsonStringPrefix(entry.argsBuffer, 'diagramSource');
      if (accumulated.length > entry.lastDraftEmitted) {
        const delta = accumulated.slice(entry.lastDraftEmitted);
        entry.lastDraftEmitted = accumulated.length;
        emit({
          type: 'draftPreview',
          contentType,
          delta,
          accumulated
        });
      }
    }
  }

  return { processToolCallChunks };
}
