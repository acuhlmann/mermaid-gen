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
      message:
        'Agent run exceeded the Quality time limit (105s). Try Fast, a smaller diagram, or retry.'
    });
    expect(r.failureClass).toBe('timeout');
    expect(r.statusText).toMatch(/timed out/i);
    expect(r.detail).toBeNull();
  });

  it('surfaces the last validation error on budget-exceeded runs', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'run_budget_exceeded',
      message:
        'Agent run exceeded the Fast time limit (75s). Try a smaller diagram or retry.\n' +
        "Last validation error: Mermaid parser rejected source: Parse error on line 3:\nExpecting 'SQE', got 'PS'"
    });
    expect(r.failureClass).toBe('timeout');
    expect(r.detail).toMatch(/Parse error on line 3/);
  });

  it('surfaces mermaid parser details from exhausted repair runs', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'no_mutation_revision',
      message:
        "Diagram update failed: Mermaid parser rejected source: Parse error on line 2:\nExpecting 'TAGEND', got 'SQS'"
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.detail).toMatch(/Parse error on line 2/);
  });

  it('surfaces metaphor validation details from exhausted repair runs', () => {
    const r = resolveAgentStreamFailureStatus({
      code: 'no_mutation_revision',
      message: 'Metaphor update failed: Metaphor DSL is not valid JSON: Unexpected token }'
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.detail).toMatch(/not valid JSON/);
  });
});
