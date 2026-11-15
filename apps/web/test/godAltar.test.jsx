// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GodAltarPanel from '../src/features/god/GodAltarPanel.jsx';
import GodAltarHost from '../src/features/god/GodAltarModal.jsx';
import { openGodAltar, resetGodAltarForTests } from '../src/features/god/godAltarStore.js';
import { _resetUxSignalsForTests, installUxSignals } from '../src/state/uxSignalsClient.js';

const PROPOSAL = {
  worthy: true,
  title: 'god-petition: add celestial neon theme',
  branchSlug: 'add-celestial-neon-theme',
  summary: 'Grant mortals glowing dark mode without offending WCAG.',
  targetArea: 'apps/web',
  implementationPlan: ['Add CSS variables', 'Wire toggle button', 'Test contrast'],
  divineBlessing: 'Go forth and ship before standup.'
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  cleanup();
  resetGodAltarForTests();
  _resetUxSignalsForTests();
  vi.unstubAllGlobals();
});

describe('GodAltarPanel & GodAltarModal', () => {
  it('converses with ArchiSlop God, receives a PR decree, and files a PR without emitting uxSignals', async () => {
    const signalRequests = [];
    const fetchMock = vi.fn(async (url, init = {}) => {
      const u = String(url);
      if (u.includes('/api/signals')) {
        signalRequests.push(u);
        return { ok: true, status: 204 };
      }
      if (u.includes('/api/god/petition/capabilities')) {
        return jsonResponse({
          v: 1,
          llmConfigured: true,
          githubPrConfigured: true,
          repo: 'acuhlmann/mermaid-gen'
        });
      }
      if (u.includes('/api/god/petition/file-pr')) {
        return jsonResponse({
          v: 1,
          filed: true,
          mode: 'github_pr',
          prNumber: 777,
          prUrl: 'https://github.com/acuhlmann/mermaid-gen/pull/777',
          ghCommand: 'gh pr create ...',
          divineMessage: 'BEHOLD! PR #777 HATH DESCENDED FROM HEAVEN.'
        });
      }
      if (u.includes('/api/god/petition')) {
        const payload = JSON.parse(init.body);
        expect(payload.offering).toBe('kubernetes_yaml');
        expect(payload.diagramContext?.diagramSource).toContain('A-->B');
        return jsonResponse({
          v: 1,
          mode: 'llm',
          llmConfigured: true,
          reply: 'THY YAML SMOKE IS PLEASING. TAKE THIS BRANCH.',
          favorDelta: 35,
          favor: 70,
          mood: 'benevolent',
          judgment: 'WORTHY OF A BRANCH',
          prProposal: PROPOSAL
        });
      }
      return jsonResponse({});
    });
    vi.stubGlobal('fetch', fetchMock);

    // Even when uxSignals is installed on the host page, Altar usage emits 0 telemetry events.
    const uninstall = installUxSignals({
      fetchImpl: fetchMock,
      sendBeacon: () => true
    });

    render(
      <GodAltarPanel
        diagramSource="flowchart TD\nA-->B"
        contentType="mermaid"
        userName="Gilfoyle"
      />
    );

    expect(await screen.findByText(/Live Celestial LLM Connected/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Burn 400 lines of Kubernetes YAML/i }));
    fireEvent.change(screen.getByTestId('god-altar-input'), {
      target: { value: 'Please add a celestial neon theme PR' }
    });
    fireEvent.click(screen.getByTestId('god-altar-submit'));

    expect(await screen.findByText(/THY YAML SMOKE IS PLEASING/)).toBeTruthy();
    expect(screen.getByTestId('god-favor-meter').textContent).toContain('70 / 100');
    expect(screen.getByTestId('god-pr-decree')).toBeTruthy();

    fireEvent.click(screen.getByTestId('god-file-pr-button'));
    const outcome = await screen.findByTestId('god-pr-outcome');
    expect(outcome.textContent).toContain('PR #777');
    expect(screen.getByRole('link', { name: /View Pull Request #777/i }).getAttribute('href')).toBe(
      'https://github.com/acuhlmann/mermaid-gen/pull/777'
    );
    expect(signalRequests).toEqual([]);
    uninstall();
  });

  it('gracefully shows the local gh scroll when GitHub credentials are unconfigured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/api/god/petition/capabilities')) {
          return jsonResponse({ v: 1, llmConfigured: false, githubPrConfigured: false });
        }
        if (u.includes('/api/god/petition/file-pr')) {
          return jsonResponse({
            v: 1,
            filed: false,
            mode: 'unconfigured',
            ghCommand: 'git checkout -b god-petition/x && gh pr create',
            divineMessage: 'NO GITHUB TOKEN DWELLS IN THIS SERVER.'
          });
        }
        return jsonResponse({
          v: 1,
          mode: 'offline-oracle',
          llmConfigured: false,
          reply: 'STONE TABLETS ACCEPT THY WISH.',
          favorDelta: 25,
          favor: 60,
          mood: 'amused',
          judgment: 'WORTHY OF A BRANCH',
          prProposal: PROPOSAL
        });
      })
    );

    render(<GodAltarPanel />);
    fireEvent.change(screen.getByTestId('god-altar-input'), {
      target: { value: 'I wish for a PR to add tooltips' }
    });
    fireEvent.click(screen.getByTestId('god-altar-submit'));

    await screen.findByTestId('god-pr-decree');
    fireEvent.click(screen.getByTestId('god-file-pr-button'));
    const outcome = await screen.findByTestId('god-pr-outcome');
    expect(outcome.textContent).toContain('Offline PR Scroll');
    expect(outcome.textContent).toContain('gh pr create');
  });

  it('opens GodAltarModal via store, links to /god?tab=altar, and closes on Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ v: 1, llmConfigured: false, githubPrConfigured: false }))
    );

    render(
      <GodAltarHost diagramSource="flowchart TD\nA-->B" contentType="mermaid" userName="Gavin" />
    );
    expect(screen.queryByTestId('god-altar-modal')).toBeNull();

    openGodAltar();
    const modal = await screen.findByTestId('god-altar-modal');
    expect(modal).toBeTruthy();
    expect(screen.getByTestId('god-altar-ascend-link').getAttribute('href')).toBe('/god?tab=altar');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('god-altar-modal')).toBeNull());
  });
});
