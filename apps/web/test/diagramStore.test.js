// @vitest-environment jsdom
import { createInitialDiagramState } from '@archislop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildIntentPeerContext,
  clearAllDiagramCachesFromStorage,
  getOrCreateBrowserSessionId,
  normalizeSessionId,
  readDiagramCache,
  SESSION_HEADER,
  isPeerSlotAhead,
  isSlotCustomized,
  isSlotInSyncForTopic,
  needsModeSwitchPeerSync,
  peerRequiresModeSwitchTranslation,
  resolveModeSwitchCandidate,
  shouldAutoSubmitModeSwitchIntent,
  slotLastTopic,
  streamDiagramAgent,
  submitDiagramTransform,
  syncClientDiagramState,
  clearAllArchislopAppStorage,
  isDiagramCacheSubstantial,
  isServerSessionPristine,
  wipeClientCachesAfterLostServerSession,
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
      const assertion = expect(request).rejects.toThrow(
        'Transform agent request timed out. Please try again.'
      );

      // Timeout mirrors the server run budget for the mode/profile (Go Mad fast: 105s)
      // plus the client grace window, instead of a flat 60s.
      await vi.advanceTimersByTimeAsync(121_000);
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

describe('lost server session cache wipe', () => {
  it('clearAllDiagramCachesFromStorage removes all diagram cache keys and leaves unrelated keys', () => {
    writeDiagramCache({ diagramSource: 'a' }, 'room-a');
    writeDiagramCache({ diagramSource: 'b' }, 'room-b');
    window.localStorage.setItem('unrelated-key', 'keep');
    clearAllDiagramCachesFromStorage();
    expect(readDiagramCache('room-a')).toBeNull();
    expect(readDiagramCache('room-b')).toBeNull();
    expect(window.localStorage.getItem('unrelated-key')).toBe('keep');
  });

  it('wipeClientCachesAfterLostServerSession clears all archislop app storage keys', () => {
    writeDiagramCache({ diagramSource: 'x' }, 's1');
    window.localStorage.setItem('archislop:session-id', 'legacy-backup');
    window.localStorage.setItem('archislop:model-profile', 'quality');
    window.localStorage.setItem('archislop-stream-debug', '1');
    wipeClientCachesAfterLostServerSession();
    expect(readDiagramCache('s1')).toBeNull();
    expect(window.localStorage.getItem('archislop:session-id')).toBeNull();
    expect(window.localStorage.getItem('archislop:model-profile')).toBeNull();
    expect(window.localStorage.getItem('archislop-stream-debug')).toBeNull();
  });

  it('clearAllArchislopAppStorage removes archislop-prefixed keys only', () => {
    writeDiagramCache({ diagramSource: 'a' }, 'room');
    window.localStorage.setItem('archislop:content-mode', 'infographic');
    window.localStorage.setItem('other-app', 'keep');
    clearAllArchislopAppStorage();
    expect(readDiagramCache('room')).toBeNull();
    expect(window.localStorage.getItem('archislop:content-mode')).toBeNull();
    expect(window.localStorage.getItem('other-app')).toBe('keep');
  });
});

describe('stale session detection helpers', () => {
  it('isServerSessionPristine is true for empty dual-slot payloads', () => {
    expect(
      isServerSessionPristine({
        mermaid: { revisionId: 0, diagramSource: '', lastUserPrompt: null },
        infographic: { revisionId: 0, diagramSource: '', lastUserPrompt: null }
      })
    ).toBe(true);
  });

  it('isDiagramCacheSubstantial detects cached insights and diagrams', () => {
    expect(isDiagramCacheSubstantial(null)).toBe(false);
    expect(isDiagramCacheSubstantial({ insightsEntries: [{ id: '1' }] })).toBe(true);
    expect(isDiagramCacheSubstantial({ diagramSource: 'flowchart TD\n  A --> B' })).toBe(true);
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

  it('buildIntentPeerContext includes peer when peer has no lastUserPrompt but candidate is set', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 1,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: null
    };
    const i = createInitialDiagramState('infographic');
    const session = { mermaid: customMermaid, infographic: i };
    const peer = buildIntentPeerContext('infographic', session, 'Solar system');
    expect(peer).toEqual({ contentType: 'mermaid', diagramSource: customMermaid.diagramSource });
  });

  it('buildIntentPeerContext includes peer when target slot is still empty', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  A --> B',
      lastUserPrompt: 'Old topic'
    };
    const i = createInitialDiagramState('infographic');
    const session = { mermaid: customMermaid, infographic: i };
    expect(buildIntentPeerContext('infographic', session, 'Different topic')).toEqual({
      contentType: 'mermaid',
      diagramSource: customMermaid.diagramSource
    });
  });

  it('buildIntentPeerContext omits peer when both slots are customized and topics conflict', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 1,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: 'Old topic'
    };
    const i = createInitialDiagramState('infographic');
    const customInfographic = {
      ...i,
      revisionId: 2,
      diagramSource: 'infographic list\n  items\n    - Other',
      lastUserPrompt: 'Other topic'
    };
    const session = { mermaid: customMermaid, infographic: customInfographic };
    expect(buildIntentPeerContext('infographic', session, 'Solar system')).toBeUndefined();
  });

  it('buildIntentPeerContext omits peer when still default seed and revision 0', () => {
    const session = {
      mermaid: createInitialDiagramState('mermaid'),
      infographic: createInitialDiagramState('infographic')
    };
    expect(buildIntentPeerContext('infographic', session, 'Any')).toBeUndefined();
  });

  it('shouldAutoSubmitModeSwitchIntent skips when target slot is already in sync and peer not ahead', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'topic',
        textareaDirty: false,
        newSlotInSync: true,
        peerRequiresTranslation: false
      })
    ).toBe(false);
  });

  it('shouldAutoSubmitModeSwitchIntent runs when target in sync but peer requires translation', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'Solar system',
        textareaDirty: false,
        newSlotInSync: true,
        peerRequiresTranslation: true
      })
    ).toBe(true);
  });

  it('isPeerSlotAhead is true when peer has newer updatedAt and matching topic', () => {
    const m = createInitialDiagramState('mermaid');
    const staleMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  Old',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T08:30:00.000Z'
    };
    const i = createInitialDiagramState('infographic');
    const freshInfographic = {
      ...i,
      revisionId: 5,
      diagramSource: 'infographic sequence-diagram\n  title Solar',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T09:00:00.000Z'
    };
    const session = { mermaid: staleMermaid, infographic: freshInfographic };
    // Switching TO mermaid: peer infographic is newer
    expect(isPeerSlotAhead({ contentMode: 'mermaid', session, candidate: 'Solar system' })).toBe(
      true
    );
    // Switching TO infographic: peer mermaid is older
    expect(
      isPeerSlotAhead({ contentMode: 'infographic', session, candidate: 'Solar system' })
    ).toBe(false);
  });

  it('isPeerSlotAhead is false when peer topic differs from candidate', () => {
    const m = createInitialDiagramState('mermaid');
    const i = createInitialDiagramState('infographic');
    const session = {
      mermaid: { ...m, revisionId: 1, updatedAt: '2026-05-10T08:00:00.000Z' },
      infographic: {
        ...i,
        revisionId: 3,
        lastUserPrompt: 'Other topic',
        updatedAt: '2026-05-10T09:00:00.000Z'
      }
    };
    expect(isPeerSlotAhead({ contentMode: 'mermaid', session, candidate: 'Solar system' })).toBe(
      false
    );
  });

  it('isSlotCustomized detects revision or non-default source', () => {
    const seed = createInitialDiagramState('mermaid');
    expect(isSlotCustomized(seed)).toBe(false);
    expect(isSlotCustomized({ ...seed, revisionId: 1 })).toBe(true);
  });

  it('slotLastTopic returns trimmed prompt or null', () => {
    expect(slotLastTopic({ lastUserPrompt: '  hello  ' })).toBe('hello');
    expect(slotLastTopic({ lastUserPrompt: '   ' })).toBe(null);
  });

  it('shouldAutoSubmitModeSwitchIntent runs when newSlotInSync is false (target slot empty)', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'topic',
        textareaDirty: false,
        newSlotInSync: false,
        peerContext: undefined
      })
    ).toBe(true);
  });

  it('shouldAutoSubmitModeSwitchIntent skips when target slot is in sync and no peer', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate: 'topic',
        textareaDirty: false,
        newSlotInSync: true,
        peerRequiresTranslation: false
      })
    ).toBe(false);
  });

  it('isSlotInSyncForTopic requires matching topic and customized slot', () => {
    const m = createInitialDiagramState('mermaid');
    const customized = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: 'Solar system'
    };
    expect(isSlotInSyncForTopic(customized, 'Solar system')).toBe(true);
    expect(isSlotInSyncForTopic(customized, 'Other')).toBe(false);
    expect(isSlotInSyncForTopic(m, 'Solar system')).toBe(false);
  });

  it('peerRequiresModeSwitchTranslation skips when sync marker matches current revisions', () => {
    const m = createInitialDiagramState('mermaid');
    const staleMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  Old',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T08:30:00.000Z'
    };
    const i = createInitialDiagramState('infographic');
    const freshInfographic = {
      ...i,
      revisionId: 5,
      diagramSource: 'infographic sequence-diagram\n  title Solar',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T09:00:00.000Z'
    };
    const session = { mermaid: staleMermaid, infographic: freshInfographic };
    const syncMarkers = {
      mermaid: null,
      infographic: { peerMode: 'mermaid', peerRevisionId: 2, targetRevisionId: 5 }
    };
    expect(
      peerRequiresModeSwitchTranslation({
        contentMode: 'mermaid',
        session,
        candidate: 'Solar system',
        syncMarkers
      })
    ).toBe(false);
  });

  it('resolveModeSwitchCandidate uses conversion fallback when peer has diagram but no topic', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 3,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: null,
      updatedAt: '2026-05-10T10:00:00.000Z'
    };
    const i = createInitialDiagramState('infographic');
    const session = { mermaid: customMermaid, infographic: i };
    const candidate = resolveModeSwitchCandidate({
      contentMode: 'infographic',
      session,
      sessionTopic: null,
      promptAtSwitch: ''
    });
    expect(candidate).toContain('Mermaid');
  });

  it('needsModeSwitchPeerSync is true when target slot is empty and peer is customized', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  A --> B',
      lastUserPrompt: null
    };
    const session = {
      mermaid: customMermaid,
      infographic: createInitialDiagramState('infographic')
    };
    expect(
      needsModeSwitchPeerSync({
        contentMode: 'infographic',
        session,
        candidate:
          'Convert the current Mermaid architecture diagram into an equivalent infographic.',
        syncMarkers: { mermaid: null, infographic: null }
      })
    ).toBe(true);
  });

  it('shouldAutoSubmitModeSwitchIntent runs when needsPeerSync and candidate from fallback', () => {
    expect(
      shouldAutoSubmitModeSwitchIntent({
        candidate:
          'Convert the current Mermaid architecture diagram into an equivalent infographic.',
        textareaDirty: false,
        newSlotInSync: false,
        peerRequiresTranslation: false,
        needsPeerSync: true
      })
    ).toBe(true);
  });

  it('isPeerSlotAhead is true when peer customized and target empty even without topic', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  A --> B',
      updatedAt: '2026-05-10T09:00:00.000Z'
    };
    const session = {
      mermaid: customMermaid,
      infographic: createInitialDiagramState('infographic')
    };
    expect(isPeerSlotAhead({ contentMode: 'infographic', session, candidate: null })).toBe(true);
  });

  it('peerRequiresModeSwitchTranslation runs when peer revision advanced past sync marker', () => {
    const m = createInitialDiagramState('mermaid');
    const staleMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  Old',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T08:30:00.000Z'
    };
    const i = createInitialDiagramState('infographic');
    const refinedInfographic = {
      ...i,
      revisionId: 6,
      diagramSource: 'infographic sequence-diagram\n  title Solar v2',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T09:30:00.000Z'
    };
    const session = { mermaid: staleMermaid, infographic: refinedInfographic };
    const syncMarkers = {
      mermaid: null,
      infographic: { peerMode: 'mermaid', peerRevisionId: 2, targetRevisionId: 5 }
    };
    expect(
      peerRequiresModeSwitchTranslation({
        contentMode: 'mermaid',
        session,
        candidate: 'Solar system',
        syncMarkers
      })
    ).toBe(true);
  });

  it('resolveModeSwitchCandidate picks topic when switching to metaphor3d from mermaid', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 3,
      diagramSource: 'flowchart TD\n  X --> Y',
      lastUserPrompt: 'Solar system',
      updatedAt: '2026-05-10T10:00:00.000Z'
    };
    const session = {
      mermaid: customMermaid,
      infographic: createInitialDiagramState('infographic'),
      metaphor3d: createInitialDiagramState('metaphor3d')
    };
    const candidate = resolveModeSwitchCandidate({
      contentMode: 'metaphor3d',
      session,
      sessionTopic: null,
      promptAtSwitch: ''
    });
    expect(candidate).toBe('Solar system');
  });

  it('buildIntentPeerContext returns mermaid peer when switching to metaphor3d', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  API --> DB',
      lastUserPrompt: 'Order pipeline',
      updatedAt: '2026-05-10T10:00:00.000Z'
    };
    const session = {
      mermaid: customMermaid,
      infographic: createInitialDiagramState('infographic'),
      metaphor3d: createInitialDiagramState('metaphor3d')
    };
    const peer = buildIntentPeerContext('metaphor3d', session, 'Order pipeline');
    expect(peer?.contentType).toBe('mermaid');
    expect(peer?.diagramSource).toContain('API');
  });

  it('needsModeSwitchPeerSync is true when metaphor3d slot is empty and mermaid is customized', () => {
    const m = createInitialDiagramState('mermaid');
    const customMermaid = {
      ...m,
      revisionId: 2,
      diagramSource: 'flowchart TD\n  A --> B',
      lastUserPrompt: 'Solar system'
    };
    const session = {
      mermaid: customMermaid,
      infographic: createInitialDiagramState('infographic'),
      metaphor3d: createInitialDiagramState('metaphor3d')
    };
    expect(
      needsModeSwitchPeerSync({
        contentMode: 'metaphor3d',
        session,
        candidate: 'Solar system',
        syncMarkers: { mermaid: null, infographic: null, metaphor3d: null }
      })
    ).toBe(true);
  });
});
