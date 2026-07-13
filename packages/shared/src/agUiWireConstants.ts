/**
 * AG-UI wire contracts shared by server emitters and web translators.
 * Documented in docs/architecture-ag-ui.md.
 */

/** AG-UI `CUSTOM` event `name` values. */
export const AGUI_CUSTOM_NAME_A2UI = 'a2ui';
export const AGUI_CUSTOM_NAME_STATUS = 'status';
export const AGUI_CUSTOM_NAME_ARTIFACT = 'artifact';
export const AGUI_CUSTOM_NAME_PLAN_BEAT = 'plan_beat';
/** Rejected `apply_*_patch` tool result for the insights Tool trace. */
export const AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT = 'tool_apply_result';
/** Single-shot syntax fixer start/result for the insights Tool trace. */
export const AGUI_CUSTOM_NAME_SYNTAX_FIXER = 'syntax_fixer';
/** LLM turn start/end inside a run (`{ phase: 'start' | 'end', callId, model, … }`). */
export const AGUI_CUSTOM_NAME_MODEL_CALL = 'model_call';
/**
 * Auto mode resolved a concrete slot from the user prompt.
 * Value: `{ contentType, reason? }` — client switches the mode picker to that slot.
 */
export const AGUI_CUSTOM_NAME_CONTENT_TYPE = 'content_type';
/**
 * Route-level keep-alive on `/agent-stream`. Carries no payload the UI renders —
 * it exists so the client's stream idle timer resets during server-side quiet
 * windows the agent-level heartbeats don't cover (syntax-fixer model calls,
 * lazy-agent cold start). Translators must ignore it.
 */
export const AGUI_CUSTOM_NAME_HEARTBEAT = 'heartbeat';
export const AGUI_CUSTOM_NAME_LEGACY = 'legacy';

/** Legacy stream `{ type }` consumed by `createAgentStreamEmitter` / web translator. */
export const LEGACY_STREAM_TYPE_A2UI = 'a2ui';
export const LEGACY_STREAM_TYPE_PLAN_BEAT = 'plan_beat';
export const LEGACY_STREAM_TYPE_CONTENT_TYPE = 'content_type';

/** RFC 6902 paths on AG-UI STATE_DELTA / STATE_SNAPSHOT. */
export const AGUI_STATE_PATH_LAST_PATCH_SUMMARY = '/lastPatchSummary';
export const AGUI_STATE_PATH_MERMAID_REVISION = '/mermaid/revisionId';
export const AGUI_STATE_PATH_INFOGRAPHIC_REVISION = '/infographic/revisionId';
export const AGUI_STATE_PATH_METAPHOR3D_REVISION = '/metaphor3d/revisionId';
export const AGUI_STATE_PATH_CHART_REVISION = '/chart/revisionId';
export const AGUI_STATE_PATH_ANYTHING_REVISION = '/anything/revisionId';

export function agUiDraftSourcePath(contentType: string | null | undefined) {
  const slot =
    contentType === 'infographic' ||
    contentType === 'metaphor3d' ||
    contentType === 'chart' ||
    contentType === 'anything'
      ? contentType
      : 'mermaid';
  return `/${slot}/draftSource`;
}

export function agUiRevisionPath(contentType: string | null | undefined) {
  if (contentType === 'infographic') return AGUI_STATE_PATH_INFOGRAPHIC_REVISION;
  if (contentType === 'metaphor3d') return AGUI_STATE_PATH_METAPHOR3D_REVISION;
  if (contentType === 'chart') return AGUI_STATE_PATH_CHART_REVISION;
  if (contentType === 'anything') return AGUI_STATE_PATH_ANYTHING_REVISION;
  return AGUI_STATE_PATH_MERMAID_REVISION;
}

/**
 * Legacy emit payload for host-built A2UI messages (critique checklist, future surfaces).
 *
 * @param {unknown[]} messages
 * @returns {{ type: typeof LEGACY_STREAM_TYPE_A2UI, messages: unknown[] }}
 */
export function createLegacyA2uiStreamEvent(messages: unknown[]) {
  return { type: LEGACY_STREAM_TYPE_A2UI, messages };
}

/**
 * Diagram-focused "why" beat for the Thinking pane (server milestones or streamed patch reason).
 *
 * @param {{ text: string, source?: 'server' | 'agent' }} payload
 */
export function createLegacyPlanBeatStreamEvent({
  text,
  source = 'server'
}: {
  text?: string | null;
  source?: 'server' | 'agent';
}) {
  return {
    type: LEGACY_STREAM_TYPE_PLAN_BEAT,
    text: String(text ?? ''),
    source: source === 'agent' ? 'agent' : 'server'
  };
}

/**
 * Auto-mode classification result for the Thinking pane / mode picker.
 *
 * @param {{ contentType: string, reason?: string }} payload
 */
export function createLegacyContentTypeStreamEvent({
  contentType,
  reason
}: {
  contentType: string;
  reason?: string | null;
}) {
  return {
    type: LEGACY_STREAM_TYPE_CONTENT_TYPE,
    contentType: String(contentType ?? ''),
    ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {})
  };
}
