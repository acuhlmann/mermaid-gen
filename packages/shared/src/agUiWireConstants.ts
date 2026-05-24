/**
 * AG-UI wire contracts shared by server emitters and web translators.
 * Documented in docs/architecture-ag-ui.md.
 */

/** AG-UI `CUSTOM` event `name` values. */
export const AGUI_CUSTOM_NAME_A2UI = 'a2ui';
export const AGUI_CUSTOM_NAME_STATUS = 'status';
export const AGUI_CUSTOM_NAME_ARTIFACT = 'artifact';
export const AGUI_CUSTOM_NAME_PLAN_BEAT = 'plan_beat';
export const AGUI_CUSTOM_NAME_LEGACY = 'legacy';

/** Legacy stream `{ type }` consumed by `createAgentStreamEmitter` / web translator. */
export const LEGACY_STREAM_TYPE_A2UI = 'a2ui';
export const LEGACY_STREAM_TYPE_PLAN_BEAT = 'plan_beat';

/** RFC 6902 paths on AG-UI STATE_DELTA / STATE_SNAPSHOT. */
export const AGUI_STATE_PATH_LAST_PATCH_SUMMARY = '/lastPatchSummary';
export const AGUI_STATE_PATH_MERMAID_REVISION = '/mermaid/revisionId';
export const AGUI_STATE_PATH_INFOGRAPHIC_REVISION = '/infographic/revisionId';
export const AGUI_STATE_PATH_METAPHOR3D_REVISION = '/metaphor3d/revisionId';

export function agUiDraftSourcePath(contentType) {
  const slot =
    contentType === 'infographic' || contentType === 'metaphor3d' ? contentType : 'mermaid';
  return `/${slot}/draftSource`;
}

export function agUiRevisionPath(contentType) {
  if (contentType === 'infographic') return AGUI_STATE_PATH_INFOGRAPHIC_REVISION;
  if (contentType === 'metaphor3d') return AGUI_STATE_PATH_METAPHOR3D_REVISION;
  return AGUI_STATE_PATH_MERMAID_REVISION;
}

/**
 * Legacy emit payload for host-built A2UI messages (critique checklist, future surfaces).
 *
 * @param {unknown[]} messages
 * @returns {{ type: typeof LEGACY_STREAM_TYPE_A2UI, messages: unknown[] }}
 */
export function createLegacyA2uiStreamEvent(messages) {
  return { type: LEGACY_STREAM_TYPE_A2UI, messages };
}

/**
 * Diagram-focused "why" beat for the Thinking pane (server milestones or streamed patch reason).
 *
 * @param {{ text: string, source?: 'server' | 'agent' }} payload
 */
export function createLegacyPlanBeatStreamEvent({ text, source = 'server' }) {
  return {
    type: LEGACY_STREAM_TYPE_PLAN_BEAT,
    text: String(text ?? ''),
    source: source === 'agent' ? 'agent' : 'server'
  };
}
