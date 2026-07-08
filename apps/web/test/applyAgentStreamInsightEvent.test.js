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
    applyAgentStreamInsightEvent(
      { text: '' },
      ctx,
      {
        type: 'tool_apply_result',
        name: 'apply_chart_patch',
        id: 'tool_42',
        accepted: false,
        error: 'Chart DSL must include archislopVersion'
      }
    );
    expect(annotateTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'apply_chart_patch', {
      validationError: 'Chart DSL must include archislopVersion',
      toolCallId: 'tool_42'
    });
  });
});

describe('applyAgentStreamInsightEvent syntax_fixer', () => {
  it('starts a syntax fixer technical action with trigger context', () => {
    const appendTechnicalAction = vi.fn();
    const ctx = createCtx({ appendTechnicalAction });
    applyAgentStreamInsightEvent(
      { text: '' },
      ctx,
      {
        type: 'syntax_fixer_start',
        contentType: 'chart',
        triggerError: 'Vega-Lite compile failed: missing field'
      }
    );
    expect(appendTechnicalAction).toHaveBeenCalledWith('sec-1', 'syntax_fixer', 'running', {
      contextNote: 'Vega-Lite compile failed: missing field'
    });
  });

  it('finalizes syntax fixer success with outcome detail', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent(
      { text: '' },
      ctx,
      {
        type: 'syntax_fixer_result',
        contentType: 'chart',
        outcome: 'repaired',
        detail: 'Repaired invalid chart DSL and applied the patch.'
      }
    );
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'syntax_fixer', {
      status: 'done',
      outcomeDetail: 'Repaired invalid chart DSL and applied the patch.'
    });
  });

  it('finalizes syntax fixer failure with validation error', () => {
    const finalizeTechnicalActionResult = vi.fn();
    const ctx = createCtx({ finalizeTechnicalActionResult });
    applyAgentStreamInsightEvent(
      { text: '' },
      ctx,
      {
        type: 'syntax_fixer_result',
        contentType: 'chart',
        outcome: 'fixer_failed',
        error: 'Could not repair chart DSL'
      }
    );
    expect(finalizeTechnicalActionResult).toHaveBeenCalledWith('sec-1', 'syntax_fixer', {
      status: 'rejected',
      validationError: 'Could not repair chart DSL'
    });
  });
});
