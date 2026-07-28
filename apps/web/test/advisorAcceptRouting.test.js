import { describe, expect, it } from 'vitest';
import { resolveAdvisorAcceptOperation } from '../src/utils/advisorAcceptRouting.js';

describe('resolveAdvisorAcceptOperation', () => {
  it('routes transform personas when a diagram exists', () => {
    expect(resolveAdvisorAcceptOperation('barker', true)).toBe('transform');
    expect(resolveAdvisorAcceptOperation('gilfoyle', true)).toBe('transform');
  });

  it('routes critique and explain to analyze, not intent', () => {
    expect(resolveAdvisorAcceptOperation('jared', true)).toBe('analyze');
    expect(resolveAdvisorAcceptOperation('explain', true)).toBe('analyze');
  });

  it('falls back to intent without a diagram', () => {
    expect(resolveAdvisorAcceptOperation('jared', false)).toBe('intent');
    expect(resolveAdvisorAcceptOperation('barker', false)).toBe('intent');
  });
});
