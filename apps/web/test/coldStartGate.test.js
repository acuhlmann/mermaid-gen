import { describe, expect, it, vi } from 'vitest';
import { COLD_START_COPY } from '../src/utils/coldStartCopy.js';
import {
  isHealthReadyResponse,
  pollHealthUntilReady,
  resolveHealthCheckUrl
} from '../src/utils/coldStartGate.js';

describe('resolveHealthCheckUrl', () => {
  it('uses same-origin health in production', () => {
    expect(
      resolveHealthCheckUrl({
        location: { hostname: 'app.example.com', port: '', origin: 'https://app.example.com' }
      })
    ).toBe('https://app.example.com/api/health');
  });

  it('targets local API server during Vite dev', () => {
    const devOrigin = 'http://127.0.0.1:5173'; // pragma: allowlist secret
    const apiPort = 4000;
    expect(
      resolveHealthCheckUrl({
        location: { hostname: '127.0.0.1', port: '5173', origin: devOrigin }
      })
    ).toBe(`http://127.0.0.1:${apiPort}/api/health`); // pragma: allowlist secret
  });

  it('honors archislop-api-base meta content', () => {
    expect(
      resolveHealthCheckUrl({
        location: { hostname: 'app.example.com', port: '', origin: 'https://app.example.com' },
        apiBaseMeta: 'https://api.example.com/'
      })
    ).toBe('https://api.example.com/api/health');
  });
});

describe('pollHealthUntilReady', () => {
  it('resolves when health returns ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const result = await pollHealthUntilReady({
      fetchImpl,
      healthUrl: 'https://example.com/api/health',
      initialDelayMs: 1,
      timeoutMs: 500
    });
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('enters timeout phase when health never succeeds', async () => {
    const phases = [];
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const result = await pollHealthUntilReady({
      fetchImpl,
      healthUrl: 'https://example.com/api/health',
      initialDelayMs: 1,
      maxDelayMs: 2,
      timeoutMs: 20,
      onPhase: (phase) => phases.push(phase)
    });
    expect(result.ok).toBe(false);
    expect(phases).toContain('checking');
    expect(phases).toContain('waking');
    expect(phases).toContain('timeout');
  });

  it('shows waking copy while the first health fetch is still pending', async () => {
    vi.useFakeTimers();
    const phases = [];
    let resolveFetch;
    const fetchImpl = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const pollPromise = pollHealthUntilReady({
      fetchImpl,
      healthUrl: 'https://example.com/api/health',
      checkingGraceMs: 15,
      initialDelayMs: 5_000,
      timeoutMs: 60_000,
      onPhase: (phase) => phases.push(phase)
    });

    await vi.advanceTimersByTimeAsync(20);
    expect(phases).toEqual(['checking', 'waking']);

    resolveFetch({ ok: true });
    const result = await pollPromise;
    expect(result.ok).toBe(true);
    vi.useRealTimers();
  });
});

describe('isHealthReadyResponse', () => {
  it('treats ok responses as ready', () => {
    expect(isHealthReadyResponse({ ok: true })).toBe(true);
    expect(isHealthReadyResponse({ ok: false })).toBe(false);
  });
});

describe('COLD_START_COPY', () => {
  it('pairs branded titles with plain hints', () => {
    expect(COLD_START_COPY.checking.title).toMatch(/Corporate IT/i);
    expect(COLD_START_COPY.checking.hint).toMatch(/wakes from idle/i);
    expect(COLD_START_COPY.waking.title).toMatch(/synergy plane/i);
    expect(COLD_START_COPY.waking.hint).toMatch(/Starting the server/i);
    expect(COLD_START_COPY.timeout.title).toMatch(/architecture slop/i);
    expect(COLD_START_COPY.timeout.hint).toMatch(/not responded yet/i);
  });
});
