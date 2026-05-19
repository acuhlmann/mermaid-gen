import { describe, expect, it } from 'vitest';
import { resolveAdvisorAcceptOperation } from '../src/utils/advisorAcceptRouting.js';

describe('resolveAdvisorAcceptOperation', () => {
  it('routes transform personas when a diagram exists', () => {
    expect(resolveAdvisorAcceptOperation('exec', true)).toBe('transform');
    expect(resolveAdvisorAcceptOperation('refine', true)).toBe('transform');
  });

  it('routes critique and explain to analyze, not intent', () => {
    expect(resolveAdvisorAcceptOperation('critique', true)).toBe('analyze');
    expect(resolveAdvisorAcceptOperation('explain', true)).toBe('analyze');
  });

  it('falls back to intent without a diagram', () => {
    expect(resolveAdvisorAcceptOperation('critique', false)).toBe('intent');
    expect(resolveAdvisorAcceptOperation('exec', false)).toBe('intent');
  });
});
