import { describe, expect, it } from 'vitest';
import { deriveOptimisticState } from '../src/state/diagramStore.js';

describe('deriveOptimisticState', () => {
  it('adds a pending node snippet for optimistic UI', () => {
    const current = {
      revisionId: 1,
      mermaidSource: 'flowchart TD\n  A --> B',
      updatedAt: new Date().toISOString()
    };

    const next = deriveOptimisticState(current, 'Add cache layer');
    expect(next.mermaidSource).toContain('Pending');
    expect(next.mermaidSource).toContain('Add cache layer');
  });
});
