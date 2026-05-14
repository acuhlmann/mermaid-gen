// @vitest-environment jsdom
import { createInitialDiagramState } from '@archislop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildIntentPeerContext,
  getOrCreateBrowserSessionId,
  normalizeSessionId,
  readDiagramCache,
  SESSION_HEADER,
  shouldAutoSubmitModeSwitchIntent,
  streamDiagramAgent,
  submitDiagramTransform,
  syncClientDiagramState,
  writeDiagramCache
} from '../src/state/diagramStore.js';

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
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
          diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
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
        diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
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
        diagramSource: 'flowchart TD\n  A --> B',
        modelProfile: 'quality'
      });

      expect(JSON.parse(requestBody).modelProfile).toBe('quality');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('includes goMadDepth when provided', async () => {
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
        mode: 'goMad',
        revisionId: 0,
        diagramSource: 'flowchart TD\n  A --> B',
        goMadDepth: 3
      });

      expect(JSON.parse(requestBody).goMadDepth).toBe(3);
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
        diagramSource: 'flowchart TD\n  Start[Start] --> EndNode[End]'
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
              diagramSource: JSON.parse(options.body).diagramSource
            };
          }
        };
      };

      const payload = await syncClientDiagramState({
        diagramSource: 'flowchart TD\n  A --> B',
        styleConfig: {
          theme: 'forest',
          look: 'classic',
          themeVariables: {},
          themeCSS: '',
          flowchart: { curve: 'linear' }
        }
      });

      expect(requestUrl).toContain('/api/copilotkit/state');
      expect(JSON.parse(requestBody).diagramSource).toContain('A --> B');
      expect(JSON.parse(requestBody).styleConfig.theme).toBe('forest');
      expect(requestHeaders[SESSION_HEADER]).toBeTruthy();
      expect(payload.revisionId).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses an explicit URL session id when syncing state', async () => {
    const originalFetch = globalThis.fetch;
    let requestHeaders;
    try {
      globalThis.fetch = async (_url, options) => {
        requestHeaders = options.headers;
        return {
          ok: true,
          async json() {
            return {
              revisionId: 3,
              diagramSource: JSON.parse(options.body).diagramSource
            };
          }
        };
      };

      await syncClientDiagramState({
        sessionId: 'shared-session-123',
        diagramSource: 'flowchart TD\n  A --> B'
      });

      expect(requestHeaders[SESSION_HEADER]).toBe('shared-session-123');
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
              diagramSource: ''
            };
          }
        };
      };

      const payload = await syncClientDiagramState({ diagramSource: '' });
      expect(JSON.parse(requestBody).diagramSource).toBe('');
      expect(payload.diagramSource).toBe('');
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

describe('normalizeSessionId', () => {
  it('keeps URL-safe session ids bounded', () => {
    expect(normalizeSessionId(' shared/session id ')).toBe('shared-session-id');
    expect(normalizeSessionId('x'.repeat(140))).toHaveLength(128);
    expect(normalizeSessionId('')).toBeNull();
  });
});

describe('streamDiagramAgent', () => {
  it('throws AbortError without calling fetch when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn();
      await expect(
        streamDiagramAgent(
          {
            operation: 'analyze',
            kind: 'explain',
            revisionId: 0,
            diagramSource: 'flowchart TD\n  A --> B'
          },
          vi.fn(),
          { signal: controller.signal }
        )
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('propagates abort while awaiting fetch', async () => {
    const controller = new AbortController();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (_url, options) =>
        new Promise((_resolve, reject) => {
          const reject_ = () => reject(new DOMException('Aborted', 'AbortError'));
          if (options?.signal?.aborted) {
            reject_();
            return;
          }
          options?.signal?.addEventListener('abort', reject_);
        });
      const promise = streamDiagramAgent(
        {
          operation: 'analyze',
          kind: 'explain',
          revisionId: 0,
          diagramSource: 'flowchart TD\n  A --> B'
        },
        vi.fn(),
        { signal: controller.signal }
      );
      controller.abort();
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('translates AG-UI events into legacy onEvent calls', async () => {
    const originalFetch = globalThis.fetch;
    try {
      const encoder = new TextEncoder();
      const frames = [
        { type: 'RUN_STARTED', threadId: 't1', runId: 'r1' },
        { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hello' },
        { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
        { type: 'RUN_FINISHED', threadId: 't1', runId: 'r1' }
      ];
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        body: new ReadableStream({
          start(streamController) {
            for (const frame of frames) {
              streamController.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
            }
            streamController.close();
          }
        })
      });

      const events = [];
      await streamDiagramAgent(
        {
          operation: 'analyze',
          kind: 'explain',
          revisionId: 0,
          diagramSource: 'flowchart TD\n  A --> B'
        },
        (evt) => events.push(evt)
      );

      expect(events).toEqual(
        expect.arrayContaining([
          { type: 'phase', id: 'run_started', label: 'Starting…' },
          { type: 'token', text: 'hello' },
          expect.objectContaining({ type: 'final' })
        ])
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('surfaces server error payloads on non-OK stream responses', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        async text() {
          return JSON.stringify({
            error: 'Stale revision.',
            message: 'Refresh the page and try again.'
          });
        }
      });

      await expect(
        streamDiagramAgent(
          {
            operation: 'analyze',
            kind: 'explain',
            revisionId: 0,
            diagramSource: 'flowchart TD\n  A --> B'
          },
          vi.fn()
        )
      ).rejects.toThrow(/Stale revision[\s\S]*Refresh the page/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('diagram cache storage', () => {
  it('roundtrips diagram cache payload', () => {
    const payload = {
      diagramSource: 'flowchart TD\n  A --> B',
      insightsEntries: [{ id: 'i1', title: 'Critique', content: 'Needs labels' }],
      latestCritique: { text: 'Needs labels', createdAt: Date.now() }
    };
    writeDiagramCache(payload);
    expect(readDiagramCache()).toEqual(payload);
  });

  it('isolates cached diagram payloads by session id', () => {
    const alpha = { diagramSource: 'flowchart TD\n  A --> B' };
    const beta = { diagramSource: 'flowchart TD\n  C --> D' };

    writeDiagramCache(alpha, 'alpha');
    writeDiagramCache(beta, 'beta');

    expect(readDiagramCache('alpha')).toEqual(alpha);
    expect(readDiagramCache('beta')).toEqual(beta);
  });
});

describe('mode switch peer context', () => {
  it('buildIntentPeerContext returns mermaid peer for infographic target when peer is customized and topic matches', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 1,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: 'Solar system'
    };
    const i = createInitialDiagramState('infographic');
    const session = { mermaid: customMermaid, infographic: i };
    const peer = buildIntentPeerContext('infographic', session, 'Solar system');
    expect(peer).toEqual({ contentType: 'mermaid', diagramSource: customMermaid.diagramSource });
  });

  it('buildIntentPeerContext omits peer when peer lastUserPrompt does not match candidate topic', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 1,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: 'Old topic'
    };
    const i = createInitialDiagramState('infographic');
    const session = { mermaid: customMermaid, infographic: i };
    expect(buildIntentPeerContext('infographic', session, 'Solar system')).toBeUndefined();
  });

  it('buildIntentPeerContext omits peer when still default seed and revision 0', () => {
    const session = {
      mermaid: createInitialDiagramState('mermaid'),
      infographic: createInitialDiagramState('infographic')
    };
    expect(buildIntentPeerContext('infographic', session, 'Any')).toBeUndefined();
  });

  it('shouldAutoSubmitModeSwitchIntent runs when peer forces despite newSlotInSync', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'topic',
        textareaDirty: false,
        newSlotInSync: true,
        peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' },
        session: { mermaid: {}, infographic: {} },
        contentMode: 'infographic'
      })
    ).toBe(true);
  });

  it('shouldAutoSubmitModeSwitchIntent runs when newSlotInSync but peer lacks topic-aligned custom content', () => {
    const session = {
      mermaid: createInitialDiagramState('mermaid'),
      infographic: { ...createInitialDiagramState('infographic'), lastUserPrompt: 'topic', revisionId: 1 }
    };
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'topic',
        textareaDirty: false,
        newSlotInSync: true,
        peerContext: undefined,
        session,
        contentMode: 'infographic'
      })
    ).toBe(true);
  });
});
