import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_ARTIFACT,
  AGUI_CUSTOM_NAME_MODEL_CALL,
  AGUI_CUSTOM_NAME_PLAN_BEAT,
  AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
  AGUI_CUSTOM_NAME_SYNTAX_FIXER,
  AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
  LEGACY_STREAM_TYPE_A2UI,
  LEGACY_STREAM_TYPE_PLAN_BEAT
} from '@archislop/shared';
import { createAgUiTranslator } from '../src/state/agUiTranslator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(
    join(__dirname, '../../../packages/shared/test/fixtures/wire/legacy-events.json'),
    'utf8'
  )
);

function fixture(name) {
  const evt = FIXTURES[name];
  if (!evt) throw new Error(`missing fixture ${name}`);
  return evt;
}

describe('wire AG-UI translator fixtures', () => {
  it('translates CUSTOM plan_beat wire back to legacy plan_beat', () => {
    const translate = createAgUiTranslator();
    const legacy = fixture('plan_beat_agent');
    expect(legacy.type).toBe(LEGACY_STREAM_TYPE_PLAN_BEAT);
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_PLAN_BEAT,
      value: { text: legacy.text, source: legacy.source }
    });
    expect(out?.type).toBe(LEGACY_STREAM_TYPE_PLAN_BEAT);
    expect(out.text).toBe(legacy.text);
    expect(out.source).toBe('agent');
  });

  it('translates STATE_DELTA patch_summary wire to legacy artifact', () => {
    const translate = createAgUiTranslator();
    const legacy = fixture('patch_summary');
    expect(legacy.kind).toBe('patch_summary');
    const out = translate({
      type: 'STATE_DELTA',
      delta: [
        { op: 'replace', path: '/mermaid/revisionId', value: legacy.revisionId },
        {
          op: 'add',
          path: AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
          value: {
            revisionId: legacy.revisionId,
            linesAdded: legacy.linesAdded,
            linesRemoved: legacy.linesRemoved
          }
        }
      ]
    });
    expect(out?.type).toBe('artifact');
    expect(out.kind).toBe('patch_summary');
    expect(out.revisionId).toBe(3);
  });

  it('translates CUSTOM a2ui wire to legacy a2ui messages', () => {
    const translate = createAgUiTranslator();
    const legacy = fixture('a2ui_critique_minimal');
    expect(legacy.type).toBe(LEGACY_STREAM_TYPE_A2UI);
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_A2UI,
      value: { messages: legacy.messages }
    });
    expect(out?.type).toBe(LEGACY_STREAM_TYPE_A2UI);
    expect(out.messages).toEqual(legacy.messages);
  });

  it('translates CUSTOM artifact wire for explain_sections fixture', () => {
    const translate = createAgUiTranslator();
    const legacy = fixture('explain_sections');
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_ARTIFACT,
      value: legacy
    });
    expect(out).toEqual(legacy);
  });

  it('translates CUSTOM accepted tool_apply_result wire to legacy tool_apply_result', () => {
    const translate = createAgUiTranslator();
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
      value: {
        name: 'apply_mermaid_patch',
        toolCallId: 'tool_9',
        accepted: true,
        revisionId: 6,
        nodesAdded: 1,
        reason: 'Add gateway'
      }
    });
    expect(out).toEqual({
      type: 'tool_apply_result',
      name: 'apply_mermaid_patch',
      id: 'tool_9',
      accepted: true,
      revisionId: 6,
      nodesAdded: 1,
      reason: 'Add gateway'
    });
  });

  it('translates CUSTOM tool_apply_result wire to legacy tool_apply_result', () => {
    const translate = createAgUiTranslator();
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_TOOL_APPLY_RESULT,
      value: {
        name: 'apply_chart_patch',
        toolCallId: 'tool_7',
        accepted: false,
        error: 'Vega-Lite compile failed: missing field'
      }
    });
    expect(out).toEqual({
      type: 'tool_apply_result',
      name: 'apply_chart_patch',
      id: 'tool_7',
      accepted: false,
      error: 'Vega-Lite compile failed: missing field'
    });
  });

  it('translates STEP_STARTED/STEP_FINISHED pairs into phase and phase_end events', () => {
    const translate = createAgUiTranslator();
    const started = translate({
      type: 'STEP_STARTED',
      stepName: 'agent_run\x1fPlanning and executing tools…',
      timestamp: 1111
    });
    expect(started).toMatchObject({
      type: 'phase',
      id: 'agent_run',
      label: 'Planning and executing tools…',
      timestamp: 1111
    });
    const finished = translate({
      type: 'STEP_FINISHED',
      stepName: 'agent_run\x1fPlanning and executing tools…',
      timestamp: 2222
    });
    expect(finished).toEqual({ type: 'phase_end', id: 'agent_run', timestamp: 2222 });
  });

  it('carries wire timestamps onto translated events', () => {
    const translate = createAgUiTranslator();
    const out = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_PLAN_BEAT,
      value: { text: 'Scoping the update.', source: 'server' },
      timestamp: 4242
    });
    expect(out?.timestamp).toBe(4242);
  });

  it('translates CUSTOM model_call wire to legacy model call events', () => {
    const translate = createAgUiTranslator();
    const start = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_MODEL_CALL,
      value: { phase: 'start', callId: 'run-9', model: 'deepseek-chat' }
    });
    expect(start).toEqual({
      type: 'model_call_start',
      callId: 'run-9',
      model: 'deepseek-chat'
    });
    const end = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_MODEL_CALL,
      value: {
        phase: 'end',
        callId: 'run-9',
        model: 'deepseek-chat',
        inputTokens: 900,
        outputTokens: 120
      }
    });
    expect(end).toEqual({
      type: 'model_call_end',
      callId: 'run-9',
      model: 'deepseek-chat',
      inputTokens: 900,
      outputTokens: 120
    });
  });

  it('translates CUSTOM syntax_fixer wire to legacy start/result events', () => {
    const translate = createAgUiTranslator();
    const start = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_SYNTAX_FIXER,
      value: {
        phase: 'start',
        contentType: 'chart',
        triggerError: 'bad field'
      }
    });
    expect(start).toEqual({
      type: 'syntax_fixer_start',
      contentType: 'chart',
      triggerError: 'bad field'
    });
    const result = translate({
      type: 'CUSTOM',
      name: AGUI_CUSTOM_NAME_SYNTAX_FIXER,
      value: {
        phase: 'result',
        contentType: 'chart',
        outcome: 'repaired',
        detail: 'fixed'
      }
    });
    expect(result).toEqual({
      type: 'syntax_fixer_result',
      contentType: 'chart',
      outcome: 'repaired',
      error: '',
      detail: 'fixed'
    });
  });
});
