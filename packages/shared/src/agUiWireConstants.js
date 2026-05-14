/**
 * AG-UI `CUSTOM` event `name` values produced or consumed by archislop.
 * Keep server (`createAgUiEmit`) and web (`createAgUiTranslator`) aligned.
 */
export const AGUI_CUSTOM_NAME_A2UI = 'a2ui';
export const AGUI_CUSTOM_NAME_STATUS = 'status';

/** Legacy stream `{ type }` before `createAgUiEmit` maps it to AG-UI `CUSTOM`. */
export const LEGACY_STREAM_TYPE_A2UI = 'a2ui';

/**
 * Legacy emit payload for host-built A2UI messages (critique checklist, future surfaces).
 * Server agents call `emit(...)` with this shape; `createAgUiEmit` turns it into AG-UI `CUSTOM`.
 *
 * @param {unknown[]} messages
 * @returns {{ type: typeof LEGACY_STREAM_TYPE_A2UI, messages: unknown[] }}
 */
export function createLegacyA2uiStreamEvent(messages) {
  return { type: LEGACY_STREAM_TYPE_A2UI, messages };
}
