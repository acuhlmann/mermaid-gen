import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_ARTIFACT,
  AGUI_CUSTOM_NAME_HEARTBEAT,
  AGUI_CUSTOM_NAME_PLAN_BEAT,
  AGUI_CUSTOM_NAME_STATUS,
  AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
  AGUI_CUSTOM_NAME_SYNTAX_FIXER,
  AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
  LEGACY_STREAM_TYPE_A2UI,
  agUiDraftSourcePath,
  type DiagramState,
  type LegacyFinalEvent,
  type LegacyStreamEvent
} from '@archislop/shared';

type AgUiWireEvent = { type: string; [key: string]: unknown };

/**
 * Translates AG-UI wire events into legacy stream events for `applyAgentStreamInsightEvent`.
 */
export function createAgUiTranslator(): (evt: AgUiWireEvent | null | undefined) => LegacyStreamEvent | null {
  let lastSnapshot: unknown = null;
  /** AG-UI TOOL_CALL_END carries only toolCallId — resolve name from the matching start. */
  const toolCallNamesById = new Map<string, string>();
  return function translate(evt): LegacyStreamEvent | null {
    if (!evt || typeof evt !== 'object') return null;
    switch (evt.type) {
      case 'RUN_STARTED':
        return { type: 'phase', id: 'run_started', label: 'Starting…' };
      case 'STEP_STARTED': {
        const raw = String(evt.stepName ?? 'step');
        const sep = raw.indexOf('\x1f');
        if (sep >= 0) {
          const id = raw.slice(0, sep) || 'step';
          const label = raw.slice(sep + 1) || id;
          return { type: 'phase', id, label };
        }
        return { type: 'phase', id: raw, label: raw };
      }
      case 'STEP_FINISHED':
      case 'TEXT_MESSAGE_START':
      case 'TEXT_MESSAGE_END':
        return null;
      case 'TEXT_MESSAGE_CONTENT': {
        const text = typeof evt.delta === 'string' ? evt.delta : '';
        if (!text) return null;
        return { type: 'token', text };
      }
      case 'TOOL_CALL_START': {
        const toolCallId = String(evt.toolCallId ?? '');
        const toolCallName = String(evt.toolCallName ?? 'tool');
        if (toolCallId) toolCallNamesById.set(toolCallId, toolCallName);
        return { type: 'tool_start', name: toolCallName, ...(toolCallId ? { id: toolCallId } : {}) };
      }
      case 'TOOL_CALL_END': {
        const toolCallId = String(evt.toolCallId ?? '');
        const toolCallName = toolCallId ? (toolCallNamesById.get(toolCallId) ?? '') : '';
        if (toolCallId) toolCallNamesById.delete(toolCallId);
        return { type: 'tool_end', name: toolCallName, ...(toolCallId ? { id: toolCallId } : {}) };
      }
      case 'TOOL_CALL_ARGS':
        return null;
      case 'STATE_SNAPSHOT':
        lastSnapshot = evt.snapshot ?? null;
        return null;
      case 'STATE_DELTA': {
        const ops = Array.isArray(evt.delta) ? evt.delta : [];
        const draftOp = ops.find((op: { path?: string }) => {
          if (typeof op?.path !== 'string') return false;
          return (
            op.path === agUiDraftSourcePath('mermaid') ||
            op.path === agUiDraftSourcePath('infographic') ||
            op.path === agUiDraftSourcePath('metaphor3d') ||
            op.path === agUiDraftSourcePath('chart') ||
            op.path === agUiDraftSourcePath('anything')
          );
        });
        if (draftOp) {
          const ct = String(draftOp.path).split('/')[1];
          if (draftOp.op === 'remove') {
            return { type: 'draftPreview', contentType: ct, source: '', delta: '' };
          }
          const v = typeof draftOp.value === 'string' ? draftOp.value : '';
          return { type: 'draftPreview', contentType: ct, source: v, delta: '' };
        }
        const summaryOp = ops.find((op: { path?: string }) => op?.path === AGUI_STATE_PATH_LAST_PATCH_SUMMARY);
        if (summaryOp?.value && typeof summaryOp.value === 'object') {
          const v = summaryOp.value as {
            revisionId?: number;
            linesAdded?: number;
            linesRemoved?: number;
          };
          return {
            type: 'artifact',
            kind: 'patch_summary',
            revisionId: v.revisionId ?? 0,
            linesAdded: v.linesAdded ?? 0,
            linesRemoved: v.linesRemoved ?? 0
          };
        }
        return null;
      }
      case 'RUN_FINISHED': {
        const result = (evt.result ?? {}) as {
          revisionChanged?: boolean;
          message?: string;
          analyzeText?: string;
        };
        const out: LegacyFinalEvent = {
          type: 'final',
          revisionChanged: Boolean(result.revisionChanged),
          ...(typeof result.message === 'string' ? { message: result.message } : {}),
          ...(typeof result.analyzeText === 'string' ? { analyzeText: result.analyzeText } : {})
        };
        if (lastSnapshot && typeof lastSnapshot === 'object') {
          out.state = lastSnapshot as DiagramState;
        }
        lastSnapshot = null;
        return out;
      }
      case 'RUN_ERROR':
        return {
          type: 'error',
          message: String(evt.message ?? 'Unknown error'),
          ...(evt.code ? { code: String(evt.code) } : {})
        };
      case 'CUSTOM': {
        const name = evt.name;
        const value = evt.value as Record<string, unknown> | undefined;
        // Keep-alive only — its job (resetting the stream idle timer) is done the
        // moment the event is decoded; nothing renders it.
        if (name === AGUI_CUSTOM_NAME_HEARTBEAT) return null;
        if (name === AGUI_CUSTOM_NAME_STATUS) {
          const text = (value?.text as string) ?? '';
          return { type: 'status', text };
        }
        if (name === AGUI_CUSTOM_NAME_PLAN_BEAT) {
          const text = typeof value?.text === 'string' ? value.text : '';
          const source = value?.source === 'agent' ? 'agent' : 'server';
          return text.trim() ? { type: 'plan_beat', text: text.trim(), source } : null;
        }
        if (name === AGUI_CUSTOM_NAME_A2UI && Array.isArray(value?.messages)) {
          return { type: LEGACY_STREAM_TYPE_A2UI, messages: value.messages };
        }
        if (name === AGUI_CUSTOM_NAME_ARTIFACT) return (value ?? null) as LegacyStreamEvent | null;
        if (name === AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT && value && typeof value === 'object') {
          const toolName = typeof value.name === 'string' ? value.name : '';
          const accepted = value.accepted === true;
          const error = typeof value.error === 'string' ? value.error : '';
          if (!toolName || (!accepted && !error)) return null;
          const optionalKeys = [
            'revisionId',
            'reason',
            'validator',
            'sanitizerApplied',
            'linesAdded',
            'linesRemoved',
            'nodesAdded',
            'nodesRemoved',
            'edgesAdded',
            'edgesRemoved'
          ] as const;
          const extras: Record<string, unknown> = {};
          for (const key of optionalKeys) {
            const v = value[key];
            if (v !== undefined && v !== null) extras[key] = v;
          }
          return {
            type: 'tool_apply_result',
            name: toolName,
            ...(typeof value.toolCallId === 'string' ? { id: value.toolCallId } : {}),
            accepted,
            ...(accepted ? extras : { error })
          };
        }
        if (name === AGUI_CUSTOM_NAME_SYNTAX_FIXER && value && typeof value === 'object') {
          const phase = value.phase;
          const contentType = typeof value.contentType === 'string' ? value.contentType : 'mermaid';
          if (phase === 'start') {
            return {
              type: 'syntax_fixer_start',
              contentType,
              triggerError: typeof value.triggerError === 'string' ? value.triggerError : ''
            };
          }
          if (phase === 'result') {
            const outcome = value.outcome;
            if (outcome !== 'repaired' && outcome !== 'fixer_failed' && outcome !== 'store_rejected') {
              return null;
            }
            return {
              type: 'syntax_fixer_result',
              contentType,
              outcome,
              error: typeof value.error === 'string' ? value.error : '',
              detail: typeof value.detail === 'string' ? value.detail : ''
            };
          }
        }
        return null;
      }
      default:
        return evt as LegacyStreamEvent;
    }
  };
}
