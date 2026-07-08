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
