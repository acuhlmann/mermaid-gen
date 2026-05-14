import { buildCritiqueActionableA2uiMessages, createLegacyA2uiStreamEvent } from '@archislop/shared';

/**
 * Emits a legacy stream event carrying A2UI v0.9 messages (AG-UI path maps it to CUSTOM a2ui).
 * Call immediately before `final` on critique analyze streams when actionable items exist.
 *
 * @param {(evt: object) => void} emit
 * @param {{ kind?: string, analyzeText?: string }} input
 */
export function emitCritiqueA2uiBeforeFinal(emit, input) {
  if (typeof emit !== 'function') return;
  if (input?.kind !== 'critique') return;
  const text = input.analyzeText;
  if (typeof text !== 'string' || !text.trim()) return;
  const messages = buildCritiqueActionableA2uiMessages(text);
  if (!messages.length) return;
  emit(createLegacyA2uiStreamEvent(messages));
}
