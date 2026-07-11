import { describe, expect, it, vi } from 'vitest';
import { applyAgentStreamInsightEvent } from '../src/state/applyAgentStreamInsightEvent.js';

function createCtx(overrides = {}) {
  const patchInsightEntry = vi.fn((id, fn) => fn({ technicalActions: [], planBeats: [] }));
  return {
    sectionId: 'sec-1',
    patchInsightEntry,
    appendToInsight: vi.fn(),
    setInsightStatus: vi.fn(),
    appendTechnicalAction: vi.fn(),
    annotateTechnicalActionResult: vi.fn(),
    finalizeTechnicalActionResult: vi.fn(),
    enrichTechnicalActionDetail: vi.fn(),
    lastTokenSoundAtRef: { current: 0 },
    goMadTokenTickIndexRef: { current: 0 },
    lastDraftTickAtRef: { current: 0 },
    tryAgentSound: vi.fn(),
    setLiveDraftSource: vi.fn(),
    setLiveDraftContentType: vi.fn(),
    animateAcceptedSource: vi.fn(),
    pendingAutoDiagramHighlightRef: { current: null },
    pendingAutoDiagramHighlightTimeoutRef: { current: null },
    triggerCompletionDelight: vi.fn(),
    ...overrides
  };
}

describe('applyAgentStreamInsightEvent tool_apply_result', () => {
  it('annotates the matching technical action with validation error', () => {
    const annotateTechnicalActionResult = vi.fn();
    const ctx = createCtx({ annotateTechnicalActionResult });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'tool_apply_result',
      name: 'apply_chart_patch',
      id: 'tool_42',
      accepted: false,
      error: 'Chart DSL must include archislopVersion'
    });
    expect(annotateTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'apply_chart_patch', {
      validationError: 'Chart DSL must include archislopVersion',
      toolCallId: 'tool_42'
    });
  });

  it('enriches accepted patch actions with outcome detail', () => {
    const enrichTechnicalActionDetail = vi.fn();
    const ctx = createCtx({ enrichTechnicalActionDetail });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'tool_apply_result',
      name: 'apply_mermaid_patch',
      id: 'tool_1',
      accepted: true,
      revisionId: 8,
      nodesAdded: 2,
      reason: 'Add cache layer'
    });
    expect(enrichTechnicalActionDetail).toHaveBeenCalledWith(
      'sec-1',
      'apply_mermaid_patch',
      expect.objectContaining({
        toolCallId: 'tool_1',
        patchStats: expect.objectContaining({
          revisionId: 8,
          nodesAdded: 2,
          reason: 'Add cache layer'
        })
      })
    );
  });
});

describe('applyAgentStreamInsightEvent phase timing', () => {
  it('stamps new phases with a start time and closes the previous open phase', () => {
    let entry = {
      technicalActions: [],
      planBeats: [],
      phases: [{ id: 'planning', label: 'Planning…', at: 100 }]
    };
    const patchInsightEntry = vi.fn((id, fn) => {
      entry = fn(entry);
    });
    const ctx = createCtx({ patchInsightEntry });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'phase',
      id: 'agent_run',
      label: 'Planning and executing tools…',
      timestamp: 5000
    });
    expect(entry.phases).toHaveLength(2);
    expect(entry.phases[0].endAt).toEqual(expect.any(Number));
    expect(entry.phases[1]).toMatchObject({
      id: 'agent_run',
      at: expect.any(Number),
      serverAt: 5000
    });
    expect(entry.phases[1].endAt).toBeUndefined();
  });

  it('closes the matching open phase on phase_end', () => {
    let entry = {
      technicalActions: [],
      planBeats: [],
      phases: [
        { id: 'planning', label: 'Planning…', at: 100, endAt: 200 },
        { id: 'agent_run', label: 'Tools…', at: 200, serverAt: 5000 }
      ]
    };
    const patchInsightEntry = vi.fn((id, fn) => {
      entry = fn(entry);
    });
    const ctx = createCtx({ patchInsightEntry });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'phase_end',
      id: 'agent_run',
      timestamp: 9000
    });
    expect(entry.phases[1].endAt).toEqual(expect.any(Number));
    expect(entry.phases[1].serverEndAt).toBe(9000);
    expect(entry.phases[0].endAt).toBe(200);
  });
});

describe('applyAgentStreamInsightEvent model_call', () => {
  it('starts a model-call technical action with the model name', () => {
    const appendTechnicalAction = vi.fn();
    const ctx = createCtx({ appendTechnicalAction });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'model_call_start',
      callId: 'run-42',
      model: 'deepseek-chat'
    });
    expect(appendTechnicalAction).toHaveBeenCalledWith('sec-1', 'model_call', 'running', {
      toolCallId: 'run-42',
      modelName: 'deepseek-chat'
    });
  });

  it('finalizes a model-call action with token usage detail', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'model_call_end',
      callId: 'run-42',
      model: 'deepseek-chat',
      inputTokens: 1204,
      outputTokens: 512
    });
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'model_call', {
      status: 'done',
      toolCallId: 'run-42',
      outcomeDetail: '1204 tokens in · 512 tokens out'
    });
  });

  it('finalizes a model-call action without usage when the provider reports none', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'model_call_end',
      callId: 'run-43'
    });
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'model_call', {
      status: 'done',
      toolCallId: 'run-43'
    });
  });
});

describe('applyAgentStreamInsightEvent syntax_fixer', () => {
  it('starts a syntax fixer technical action with trigger context', () => {
    const appendTechnicalAction = vi.fn();
    const ctx = createCtx({ appendTechnicalAction });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'syntax_fixer_start',
      contentType: 'chart',
      triggerError: 'Vega-Lite compile failed: missing field'
    });
    expect(appendTechnicalAction).toHaveBeenCalledWith('sec-1', 'syntax_fixer', 'running', {
      contextNote: 'Vega-Lite compile failed: missing field'
    });
  });

  it('finalizes syntax fixer success with outcome detail', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'syntax_fixer_result',
      contentType: 'chart',
      outcome: 'repaired',
      detail: 'Repaired invalid chart DSL and applied the patch.'
    });
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'syntax_fixer', {
      status: 'done',
      outcomeDetail: 'Repaired invalid chart DSL and applied the patch.'
    });
  });

  it('finalizes syntax fixer failure with validation error', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent({ text: '' }, ctx, {
      type: 'syntax_fixer_result',
      contentType: 'chart',
      outcome: 'fixer_failed',
      error: 'Could not repair chart DSL'
    });
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'syntax_fixer', {
      status: 'rejected',
      validationError: 'Could not repair chart DSL'
    });
  });
});
