import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOrCreateBrowserSessionId,
  SESSION_HEADER,
  submitCoAuthorIntent,
  syncClientDiagramState
} from '../src/state/diagramStore.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('submitCoAuthorIntent', () => {
  it('surfaces message and details from non-OK responses', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        async json() {
          return {
            error: 'Co-author did not apply a diagram patch.',
            message: 'Model returned text only.'
          };
        }
      });

      await expect(
        submitCoAuthorIntent({
          prompt: 'Surprise me',
          revisionId: 0,
          mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
          settings: { surpriseScale: 3 }
        })
      ).rejects.toThrow(/Co-author did not apply[\s\S]*Model returned text only/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('sends a manual co-author trigger with surpriseScale', async () => {
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
        mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
        settings: { surpriseScale: 4 }
      });

      const sent = JSON.parse(requestBody);
      expect(sent.trigger).toBe('manual');
      expect(sent.settings.surpriseScale).toBe(4);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('times out a stalled co-author request', async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });

      const request = submitCoAuthorIntent({
        prompt: 'Surprise me',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]',
        settings: { surpriseScale: 3 }
      });
      const assertion = expect(request).rejects.toThrow('Surprise me agent request timed out. Please try again.');

      await vi.advanceTimersByTimeAsync(60_000);
      await assertion;
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
    let requestHeaders;
    try {
      globalThis.fetch = async (url, options) => {
        requestUrl = url;
        requestBody = options.body;
        requestHeaders = options.headers;
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
      expect(requestHeaders[SESSION_HEADER]).toBeTruthy();
      expect(payload.revisionId).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('getOrCreateBrowserSessionId', () => {
  it('returns a stable session id per browser storage', () => {
    const first = getOrCreateBrowserSessionId();
    const second = getOrCreateBrowserSessionId();
    expect(first).toBe(second);
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);
  });
});
