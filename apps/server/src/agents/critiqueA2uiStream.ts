import {
  buildCritiqueActionableA2uiMessages,
  createLegacyA2uiStreamEvent,
  type A2uiV09Message,
  type LegacyStreamEvent
} from '@archislop/shared';

export type StreamEmit = ((evt: LegacyStreamEvent) => void) & {
  a2ui?: (messages: A2uiV09Message[]) => void;
};

/** Emits A2UI messages before `final` on critique analyze streams when actionable items exist. */
export function emitCritiqueA2uiBeforeFinal(
  emit: StreamEmit | undefined,
  input: { kind?: string; analyzeText?: string }
): void {
  if (typeof emit !== 'function') return;
  if (input?.kind !== 'critique') return;
  const text = input.analyzeText;
  if (typeof text !== 'string' || !text.trim()) return;
  const messages = buildCritiqueActionableA2uiMessages(text);
  if (!messages.length) return;
  if (typeof emit.a2ui === 'function') {
    emit.a2ui(messages);
  } else {
    emit(createLegacyA2uiStreamEvent(messages));
  }
}
