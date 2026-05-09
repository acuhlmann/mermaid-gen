import { describe, expect, it } from 'vitest';
import { deriveOptimisticState, submitCoAuthorIntent } from '../src/state/diagramStore.js';

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

describe('submitCoAuthorIntent', () => {
  it('sends a manual co-author trigger', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    try {
      globalThis.fetch = async (_url, options) => {
        requestBody = options.body;
        return {
          ok: true,
          async json() {
            return {
              state: { revisionId: 1 },
              metadata: { agent: 'coauthor' }
            };
          }
        };
      };

      await submitCoAuthorIntent({
        prompt: 'Surprise me',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]',
        settings: {}
      });

      const sent = JSON.parse(requestBody);
      expect(sent.trigger).toBe('manual');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
