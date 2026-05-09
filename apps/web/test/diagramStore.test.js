import { describe, expect, it } from 'vitest';
import {
  deriveOptimisticState,
  submitCoAuthorIntent,
  submitStyleIntent,
  syncClientDiagramState
} from '../src/state/diagramStore.js';

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

describe('submitStyleIntent', () => {
  it('posts style prompts to the style endpoint', async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl;
    let requestBody;
    try {
      globalThis.fetch = async (url, options) => {
        requestUrl = url;
        requestBody = options.body;
        return {
          ok: true,
          async json() {
            return {
              state: { revisionId: 1 },
              metadata: { agent: 'style' }
            };
          }
        };
      };

      await submitStyleIntent({
        prompt: 'Make it dark and rounded',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  Start[Start] --> End[End]',
        settings: {}
      });

      const sent = JSON.parse(requestBody);
      expect(requestUrl).toContain('/api/copilotkit/style');
      expect(sent.stylePrompt).toBe('Make it dark and rounded');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('syncClientDiagramState', () => {
  it('posts local editor source to backend state endpoint', async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl;
    let requestBody;
    try {
      globalThis.fetch = async (url, options) => {
        requestUrl = url;
        requestBody = options.body;
        return {
          ok: true,
          async json() {
            return {
              revisionId: 3,
              mermaidSource: JSON.parse(options.body).mermaidSource
            };
          }
        };
      };

      const payload = await syncClientDiagramState({
        mermaidSource: 'flowchart TD\n  A --> B',
        styleConfig: {
          theme: 'forest',
          look: 'classic',
          themeVariables: {},
          themeCSS: '',
          flowchart: { curve: 'linear' }
        }
      });

      expect(requestUrl).toContain('/api/copilotkit/state');
      expect(JSON.parse(requestBody).mermaidSource).toContain('A --> B');
      expect(JSON.parse(requestBody).styleConfig.theme).toBe('forest');
      expect(payload.revisionId).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
