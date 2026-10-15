// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UX_CLIENT_ERROR_CAP,
  UX_SIGNAL_SESSION_CAP,
  _resetUxSignalsForTests,
  flushUxSignals,
  installUxSignals,
  isUsageSignalsEnabled,
  noteManualEdit,
  noteRunOutcome,
  recordClientError,
  recordUxSignal,
  setUsageSignalsEnabled
} from '../src/state/uxSignalsClient.js';
import { USAGE_SIGNALS_KEY } from '../src/utils/usageSignalsStorage.ts';

const retry = { kind: 'retry', contentType: 'mermaid', failureClass: 'timeout' };

function install({ now = () => 1_000_000 } = {}) {
  const fetchImpl = vi.fn(() => Promise.resolve({ ok: true }));
  const sendBeacon = vi.fn(() => true);
  installUxSignals({ fetchImpl, sendBeacon, now, intervalMs: 60_000 });
  return { fetchImpl, sendBeacon };
}

/** Every signal sent so far, across fetch bodies and beacon blobs. */
async function sentSignals({ fetchImpl, sendBeacon }) {
  const bodies = fetchImpl.mock.calls.map(([, init]) => init.body);
  for (const [, blob] of sendBeacon.mock.calls) bodies.push(await blob.text());
  return bodies.flatMap((body) => JSON.parse(body).signals);
}

describe('uxSignalsClient', () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetUxSignalsForTests();
  });

  afterEach(() => {
    _resetUxSignalsForTests();
    vi.restoreAllMocks();
  });

  it('records nothing until installed, so component tests stay inert', () => {
    expect(recordUxSignal(retry)).toBe(false);
  });

  it('batches valid signals into a keepalive POST of { v: 1, signals }', async () => {
    const io = install();
    expect(recordUxSignal(retry)).toBe(true);
    flushUxSignals();
    expect(io.fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = io.fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/api\/signals$/);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'same-origin' });
    expect(JSON.parse(init.body)).toEqual({ v: 1, signals: [retry] });
  });

  it('drops anything the shared schema rejects — free text never rides along', () => {
    install();
    expect(recordUxSignal({ ...retry, prompt: 'my secret org chart' })).toBe(false);
    expect(recordUxSignal({ kind: 'graph_edit', contentType: 'mermaid', afterAgent: true })).toBe(
      false
    );
    expect(recordUxSignal('retry')).toBe(false);
  });

  it('stops at the per-page cap', () => {
    install();
    for (let i = 0; i < UX_SIGNAL_SESSION_CAP; i++) expect(recordUxSignal(retry)).toBe(true);
    expect(recordUxSignal(retry)).toBe(false);
  });

  it('opting out persists, stops collection and drops the unsent queue', () => {
    const io = install();
    recordUxSignal(retry);
    setUsageSignalsEnabled(false);
    expect(window.localStorage.getItem(USAGE_SIGNALS_KEY)).toBe('off');
    expect(recordUxSignal(retry)).toBe(false);
    flushUxSignals();
    expect(io.fetchImpl).not.toHaveBeenCalled();
  });

  it('defaults off under Global Privacy Control until the user opts in', () => {
    Object.defineProperty(window.navigator, 'globalPrivacyControl', {
      configurable: true,
      value: true
    });
    try {
      install();
      expect(isUsageSignalsEnabled()).toBe(false);
      expect(recordUxSignal(retry)).toBe(false);
      setUsageSignalsEnabled(true);
      expect(recordUxSignal(retry)).toBe(true);
    } finally {
      delete window.navigator.globalPrivacyControl;
    }
  });

  it('on pagehide sends a session summary by text/plain beacon, once', async () => {
    let clock = 1_000_000;
    const io = install({ now: () => clock });
    noteRunOutcome({ contentType: 'mermaid', profile: 'fast', status: 'done', startedAt: clock });
    noteRunOutcome({
      contentType: 'chart',
      profile: 'quality',
      status: 'failed',
      failureClass: 'timeout',
      startedAt: clock
    });
    clock += 6 * 60_000;
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pagehide'));
    const blob = io.sendBeacon.mock.calls[0][1];
    expect(blob.type).toBe('text/plain');
    const signals = await sentSignals(io);
    const summaries = signals.filter((s) => s.kind === 'session_summary');
    expect(summaries).toEqual([
      {
        kind: 'session_summary',
        duration: '5m_15m',
        runs: 2,
        accepted: 1,
        failed: 1,
        lastRunFailed: true
      }
    ]);
    expect(signals).toContainEqual({
      kind: 'run_failed',
      contentType: 'chart',
      failureClass: 'timeout',
      profile: 'quality'
    });
  });

  it('flushes by beacon when the tab is hidden', () => {
    const io = install();
    recordUxSignal(retry);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
      expect(io.sendBeacon).toHaveBeenCalledTimes(1);
    } finally {
      delete document.visibilityState;
    }
  });

  it('a cancelled run is bucketed by how long it ran; an unknown failure class reads generic', async () => {
    let clock = 0;
    const io = install({ now: () => clock });
    clock = 45_000;
    noteRunOutcome({ contentType: 'anything', profile: 'fast', status: 'cancelled', startedAt: 0 });
    noteRunOutcome({
      contentType: 'anything',
      profile: 'fast',
      status: 'failed',
      failureClass: 'gremlins',
      startedAt: 0
    });
    flushUxSignals();
    expect(await sentSignals(io)).toEqual([
      { kind: 'run_cancelled', contentType: 'anything', after: '30s_2m' },
      { kind: 'run_failed', contentType: 'anything', failureClass: 'generic', profile: 'fast' }
    ]);
  });

  it('counts the first manual edit after accepted agent output, once per output', async () => {
    let clock = 0;
    const io = install({ now: () => clock });
    noteManualEdit('mermaid');
    noteRunOutcome({ contentType: 'mermaid', profile: 'fast', status: 'done', startedAt: 0 });
    clock = 5_000;
    noteManualEdit('mermaid');
    noteManualEdit('mermaid');
    noteManualEdit('chart');
    flushUxSignals();
    expect(await sentSignals(io)).toEqual([
      { kind: 'manual_edit_after_agent', contentType: 'mermaid', within: 'lt_10s' }
    ]);
  });

  it('keeps an error constructor name, never its message, and caps error floods', async () => {
    const io = install();
    recordClientError('boundary', new TypeError('contains the user prompt'));
    for (let i = 0; i < UX_CLIENT_ERROR_CAP + 5; i++) recordClientError('window', new Error('x'));
    flushUxSignals();
    const signals = await sentSignals(io);
    expect(signals[0]).toEqual({
      kind: 'client_error',
      source: 'boundary',
      errorName: 'TypeError'
    });
    expect(signals).toHaveLength(UX_CLIENT_ERROR_CAP);
    expect(JSON.stringify(signals)).not.toContain('user prompt');
  });

  it('records same-origin uncaught errors and real rejections, not extensions or aborts', async () => {
    const io = install();
    window.dispatchEvent(
      new ErrorEvent('error', {
        filename: 'chrome-extension://abc/content.js',
        error: new TypeError('x')
      })
    );
    window.dispatchEvent(
      new ErrorEvent('error', {
        filename: `${window.location.origin}/assets/index.js`,
        error: new RangeError('x')
      })
    );
    const abort = new Event('unhandledrejection');
    abort.reason = Object.assign(new Error('aborted'), { name: 'AbortError' });
    window.dispatchEvent(abort);
    const real = new Event('unhandledrejection');
    real.reason = new TypeError('y');
    window.dispatchEvent(real);
    flushUxSignals();
    expect(await sentSignals(io)).toEqual([
      { kind: 'client_error', source: 'window', errorName: 'RangeError' },
      { kind: 'client_error', source: 'unhandledrejection', errorName: 'TypeError' }
    ]);
  });
});
