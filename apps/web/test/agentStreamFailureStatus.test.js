import { describe, expect, it } from 'vitest';
import { resolveAgentStreamFailureStatus } from '../src/utils/agentStreamFailureStatus.js';

describe('resolveAgentStreamFailureStatus', () => {
  it('classifies parse errors as syntax_exhausted', () => {
    const r = resolveAgentStreamFailureStatus({
      message: 'Infographic update failed: Infographic DSL parse error: Unknown top-level key.'
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.statusText).toMatch(/valid result/i);
    expect(r.detail).toMatch(/Unknown top-level key/);
  });

  it('surfaces Anything validation details despite no-mutation code', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'no_mutation_revision',
      message: 'Page update failed: Script block 1: Unexpected token (3:10)'
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.detail).toMatch(/Script block 1/);
  });

  it('surfaces chart validation details despite no-mutation code', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'no_mutation_revision',
      message: 'Chart update failed: Chart DSL is not valid JSON: Expected property name'
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.detail).toMatch(/Chart DSL is not valid JSON/);
  });

  it('classifies no_mutation_revision as no_patch', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'no_mutation_revision',
      message: 'The diagram was not updated—no valid patch was applied.'
    });
    expect(r.failureClass).toBe('no_patch');
    expect(r.statusText).toMatch(/patch/i);
  });

  it('classifies stale revision messages', () => {
    const r = resolveAgentStreamFailureStatus({
      message: 'State revision is stale. Refresh state and retry.'
    });
    expect(r.failureClass).toBe('stale_revision');
  });

  it('classifies run budget errors as timeout', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'run_budget_exceeded',
      message: 'Agent run exceeded the Quality time limit (105s). Try Fast, a smaller diagram, or retry.'
    });
    expect(r.failureClass).toBe('timeout');
    expect(r.statusText).toMatch(/timed out/i);
  });
});
