// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOrCreateBrowserSessionId,
  readDiagramCache,
  SESSION_HEADER,
  submitDiagramTransform,
  syncClientDiagramState,
  writeDiagramCache
} from '../src/state/diagramStore.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('submitDiagramTransform', () => {
  it('surfaces message and details from non-OK responses', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        async json() {
          return {
            error: 'Transform did not apply a diagram patch.',
            message: 'Model returned text only.'
          };
        }
      });

      await expect(
        submitDiagramTransform({
          mode: 'refine',
          revisionId: 0,
          mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
        })
      ).rejects.toThrow(/Transform did not apply[\s\S]*Model returned text only/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('posts refine transform payload', async () => {
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
              metadata: { agent: 'transform:refine' }
            };
          }
        };
      };

      await submitDiagramTransform({
        mode: 'innovate',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
      });

      const sent = JSON.parse(requestBody);
      expect(sent.mode).toBe('innovate');
      expect(sent.revisionId).toBe(0);
      expect(sent.modelProfile).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('includes modelProfile when provided', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    try {
      globalThis.fetch = async (_url, options) => {
        requestBody = options.body;
        return {
          ok: true,
          async json() {
            return { state: { revisionId: 1 }, metadata: {} };
          }
        };
      };

      await submitDiagramTransform({
        mode: 'refine',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  A --> B',
        modelProfile: 'quality'
      });

      expect(JSON.parse(requestBody).modelProfile).toBe('quality');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('times out a stalled transform request', async () => {
    vi.useFakeTimers();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });

      const request = submitDiagramTransform({
        mode: 'goMad',
        revisionId: 0,
        mermaidSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
      });
      const assertion = expect(request).rejects.toThrow('Transform agent request timed out. Please try again.');

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

  it('supports syncing an empty source for true clear', async () => {
    const originalFetch = globalThis.fetch;
    let requestBody;
    try {
      globalThis.fetch = async (_url, options) => {
        requestBody = options.body;
        return {
          ok: true,
          async json() {
            return {
              revisionId: 4,
              mermaidSource: ''
            };
          }
        };
      };

      const payload = await syncClientDiagramState({ mermaidSource: '' });
      expect(JSON.parse(requestBody).mermaidSource).toBe('');
      expect(payload.mermaidSource).toBe('');
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

describe('diagram cache storage', () => {
  it('roundtrips diagram cache payload', () => {
    const payload = {
      mermaidSource: 'flowchart TD\n  A --> B',
      insightsEntries: [{ id: 'i1', title: 'Critique', content: 'Needs labels' }],
      latestCritique: { text: 'Needs labels', createdAt: Date.now() }
    };
    writeDiagramCache(payload);
    expect(readDiagramCache()).toEqual(payload);
  });
});
