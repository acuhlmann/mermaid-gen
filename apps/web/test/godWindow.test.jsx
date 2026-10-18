// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GodWindow from '../src/features/god/GodWindow.jsx';
import { resetGodWindow } from '../src/features/god/godWindowClient.js';

const VIEW = {
  v: 1,
  generatedAt: '2026-10-17T11:30:00.000Z',
  source: 'live',
  repo: 'acuhlmann/mermaid-gen',
  branch: 'god-log',
  months: ['2026-10'],
  ticks: 58,
  acts: 1,
  monthSpendUsd: 0.018813,
  numbersFrom: 'records',
  unproductiveActs: null,
  unproductiveUsd: null,
  lastActNarration: null,
  lastActAt: '2026-10-15T15:22:19.545Z',
  reasonTally: [{ reason: 'insufficient', count: 52 }],
  recent: [
    {
      runId: '39028591467',
      startedAt: '2026-10-17T11:27:54.087Z',
      endedAt: '2026-10-17T11:27:54.087Z',
      verdict: 'noop',
      tier: 'propose',
      usd: 0,
      gateReason: 'insufficient',
      digest: { agentTurns: 2, uxSignals: 3, sessions: 1, findings: 0, sufficient: false }
    }
  ],
  issues: [],
  lastTick: {
    runId: '39028591467',
    startedAt: '2026-10-17T11:27:54.087Z',
    endedAt: '2026-10-17T11:27:54.087Z',
    verdict: 'noop',
    tier: 'propose',
    usd: 0,
    gateReason: 'insufficient',
    digest: { agentTurns: 2, uxSignals: 3, sessions: 1, findings: 0, sufficient: false }
  }
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubFetch(handlers = () => null) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method ?? 'GET' });
      return handlers(String(url), init) ?? jsonResponse(VIEW);
    })
  );
  return calls;
}

afterEach(() => {
  cleanup();
  // The client is a module-level store, so a leaked view from one case would satisfy the next one's
  // assertions without any fetch happening. Reset it, then drop the stub.
  resetGodWindow();
  vi.unstubAllGlobals();
});

describe('GodWindow', () => {
  it('shows the month spend at real precision, not rounded to two decimals', async () => {
    stubFetch();
    render(<GodWindow />);
    // October's true figure is $0.018813; "$0.02" would be a rounded lie about money.
    expect(await screen.findByText('$0.018813')).toBeTruthy();
  });

  it('renders an unmeasured stamp as "not measured", never as a count of zero', async () => {
    stubFetch();
    render(<GodWindow />);
    await screen.findByText('$0.018813');
    // Two figures are unmeasured in this fixture (acts and usd); the real tick cost of $0 is a genuine
    // zero and must still read as "$0", so the assertion is about these two cells, not about the digit.
    const unmeasured = screen.getAllByText('not measured');
    expect(unmeasured).toHaveLength(2);
    expect(unmeasured.every((el) => el.textContent === 'not measured')).toBe(true);
  });

  it('states which source the month numbers came from', async () => {
    stubFetch(() => jsonResponse({ ...VIEW, numbersFrom: 'rollupRows' }));
    render(<GodWindow />);
    await screen.findByText('$0.018813');
    // The provenance note lives on History, not on the tab the pane opens on.
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    const note = await screen.findByText(/truncated month reads smaller/i);
    expect(note.className).toContain('is-warn');
  });

  it('lists the skip reasons newest-month-first so idle time names its cause', async () => {
    stubFetch(() => jsonResponse({ ...VIEW, numbersFrom: 'rollupRows' }));
    render(<GodWindow />);
    await screen.findByText('$0.018813');
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    await screen.findByText('Skip reasons');
    // The reason string appears twice on this tab — once as the newest tick's column, once in the
    // tally — so an exact-count assertion is the only one that proves the tally is actually rendered.
    const tally = document.querySelector('.god-tally');
    expect(tally?.textContent).toContain('insufficient');
    expect(tally?.textContent).toContain('52');
  });

  it('stamps the time on a cached read, so old numbers cannot be read as current', async () => {
    stubFetch(() => jsonResponse({ ...VIEW, source: 'stale' }));
    render(<GodWindow />);
    const stamp = await screen.findByText(/Numbers as of 2026-10-17 11:30 UTC/);
    expect(stamp.textContent).toMatch(/Cached/);
    expect(stamp.className).toContain('is-stale');
  });

  it('asks for the owner token when the gate answers 401, and reloads after a successful unlock', async () => {
    let unlocked = false;
    const calls = stubFetch((url, init) => {
      if (init.method === 'POST') {
        unlocked = true;
        return jsonResponse({ ok: true });
      }
      return unlocked ? jsonResponse(VIEW) : jsonResponse({}, 401);
    });
    render(<GodWindow />);

    const input = await screen.findByLabelText('Owner token');
    const form = input.closest('form');
    await waitFor(() => expect(calls.some((c) => c.url.includes('/api/god/status'))).toBe(true));

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(input, { target: { value: 'let-me-in' } });
    fireEvent.submit(form);

    await screen.findByText('$0.018813');
    expect(calls.some((c) => c.method === 'POST' && c.url.includes('/api/god/unlock'))).toBe(true);
    // The body posted the token the owner typed.
    expect(unlocked).toBe(true);
  });

  it('refuses to render a fake sliver when nothing has been observed', async () => {
    const empty = {
      ...VIEW,
      lastTick: {
        ...VIEW.lastTick,
        digest: { agentTurns: 0, uxSignals: 0, sessions: 0, findings: 0, sufficient: false }
      }
    };
    stubFetch(() => jsonResponse(empty));
    render(<GodWindow />);
    await screen.findByText('$0.018813');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('tab', { name: 'Signals' }));

    const meter = await screen.findByText(/^0 \/ 30 floor$/);
    expect(meter.textContent).toContain('30');
    const bar = document.querySelector('.god-meter span');
    expect(bar.style.width).toBe('0%');
  });

  it('says the Settings half is not wired rather than showing dead inputs', async () => {
    stubFetch();
    render(<GodWindow />);
    await screen.findByText('$0.018813');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText(/Not wired yet/i)).toBeTruthy();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('surfaces the read issues instead of silently showing a short month', async () => {
    stubFetch(() => jsonResponse({ ...VIEW, issues: ['rollup_rows_dropped', 'fetch_failed'] }));
    render(<GodWindow />);
    expect(await screen.findByText(/rollup_rows_dropped, fetch_failed/)).toBeTruthy();
  });

  it('reports a 503 as unconfigured, not as an empty month', async () => {
    stubFetch(() => jsonResponse({ error: 'God window access is not configured.' }, 503));
    render(<GodWindow />);
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.queryByText('$0.018813')).toBeNull();
  });

  it('reports a transport failure as unreachable with a way to retry', async () => {
    stubFetch(() => {
      throw new Error('network down');
    });
    render(<GodWindow />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Could not reach the server/);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
  });
});
