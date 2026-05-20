import {
  buildStyleEditsArtifact,
  buildStyleEditsA2uiMessages,
  createLegacyA2uiStreamEvent,
  type LegacyStreamEvent
} from '@archislop/shared';
import type { StreamEmit } from './critiqueA2uiStream.js';

/** Emits structured style edit cards before `final` when prose contains visual tweak lines. */
export function emitStyleEditsBeforeFinal(
  emit: StreamEmit | undefined,
  input: { analyzeText?: string; message?: string }
): void {
  if (typeof emit !== 'function') return;
  const text = input?.analyzeText ?? input?.message;
  if (typeof text !== 'string' || !text.trim()) return;
  const artifact = buildStyleEditsArtifact(text);
  if (!artifact) return;
  emit(artifact);
  const a2ui = buildStyleEditsA2uiMessages(artifact.edits);
  if (!a2ui.length) return;
  if (typeof emit.a2ui === 'function') {
    emit.a2ui(a2ui);
  } else {
    emit(createLegacyA2uiStreamEvent(a2ui));
  }
}
