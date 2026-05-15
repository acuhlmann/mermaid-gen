import { describe, expect, it } from 'vitest';
import { resolveAgentStreamFailureStatus } from '../src/utils/agentStreamFailureStatus.js';

describe('resolveAgentStreamFailureStatus', () => {
  it('classifies parse errors as syntax_exhausted', () => {
    const r = resolveAgentStreamFailureStatus({
      message: 'Infographic update failed: Infographic DSL parse error: Unknown top-level key.'
    });
    expect(r.failureClass).toBe('syntax_exhausted');
    expect(r.statusText).toMatch(/syntax/i);
    expect(r.detail).toMatch(/Unknown top-level key/);
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
});
