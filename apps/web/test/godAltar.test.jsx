// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GodAltarPanel from '../src/features/god/GodAltarPanel.jsx';
import GodAltarHost from '../src/features/god/GodAltarModal.jsx';
import {
  getGodAltarEvent,
  openGodAltar,
  resetGodAltarForTests
} from '../src/features/god/godAltarStore.js';
import {
  playGodJudgmentCue,
  speakGodDecree,
  speakGodDecreeWithCloud,
  stopGodSpeech
} from '../src/features/god/godAltarAudio.js';
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
          branch: 'god-petition/add-celestial-neon-theme-20261115',
          prNumber: 777,
          prUrl: 'https://github.com/acuhlmann/mermaid-gen/pull/777',
          ghCommand: 'gh pr create ...',
          divineMessage: 'BEHOLD! PR #777 HATH DESCENDED FROM HEAVEN.',
          workflowDispatch: {
            attempted: true,
            dispatched: true,
            status: 'dispatched',
            workflow: 'god.yml',
            ref: 'god-petition/add-celestial-neon-theme-20261115',
            focus: 'ux',
            workflowUrl: 'https://github.com/acuhlmann/mermaid-gen/actions/workflows/god.yml',
            ghWorkflowCommand: 'gh workflow run god.yml',
            message: 'Dispatched god.yml (focus: ux).'
          }
        });
      }
      if (u.includes('/api/god/petition/speak')) {
        return jsonResponse({ audio: null, reason: 'disabled' });
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
    expect(screen.getByTestId('god-workflow-dispatch').textContent).toContain(
      'Workflow Dispatched (god.yml)'
    );
    expect(getGodAltarEvent()?.kind).toBe('bless');
    expect(signalRequests).toEqual([]);
    uninstall();
  });

  it('gracefully shows the local gh scroll and workflow fallback when GitHub credentials are unconfigured', async () => {
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
            branch: 'god-petition/x',
            ghCommand: 'git checkout -b god-petition/x && gh pr create',
            divineMessage: 'NO GITHUB TOKEN DWELLS IN THIS SERVER.',
            workflowDispatch: {
              attempted: false,
              dispatched: false,
              status: 'unconfigured',
              workflow: 'god.yml',
              ref: 'god-petition/x',
              focus: 'ux',
              workflowUrl: 'https://github.com/acuhlmann/mermaid-gen/actions/workflows/god.yml',
              ghWorkflowCommand:
                'gh workflow run god.yml --repo acuhlmann/mermaid-gen --ref god-petition/x',
              message: 'No GitHub token configured.'
            }
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
    expect(screen.getByTestId('god-dispatch-checkbox').checked).toBe(true);
    fireEvent.click(screen.getByTestId('god-file-pr-button'));
    const outcome = await screen.findByTestId('god-pr-outcome');
    expect(outcome.textContent).toContain('Offline PR Scroll');
    expect(outcome.textContent).toContain('gh pr create');
    expect(screen.getByTestId('god-workflow-dispatch').textContent).toContain(
      'Manual Workflow Fallback'
    );
    expect(screen.getByTestId('god-workflow-dispatch').textContent).toContain(
      'gh workflow run god.yml'
    );
  });

  it('synthesizes thunder, organ/blessing/smite cues and speechSynthesis safely, and respects mute/voice toggles', async () => {
    const oscStart = vi.fn();
    const createOscillator = vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: oscStart,
      stop: vi.fn()
    }));
    const createGain = vi.fn(() => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn()
    }));
    globalThis.AudioContext = vi.fn(function MockCtx() {
      return {
        currentTime: 0,
        sampleRate: 44100,
        destination: {},
        createOscillator,
        createGain
      };
    });
    const speak = vi.fn();
    const cancel = vi.fn();
    globalThis.speechSynthesis = { speak, cancel };
    globalThis.SpeechSynthesisUtterance = vi.fn(function MockUtterance(text) {
      this.text = text;
    });

    try {
      const ref = { current: null };
      playGodJudgmentCue({
        audioContextRef: ref,
        kind: 'smite',
        mood: 'wrathful',
        soundEnabled: true,
        voiceEnabled: true,
        text: 'BEGONE, MORTAL.'
      });
      expect(oscStart).toHaveBeenCalled();
      expect(speak).toHaveBeenCalledTimes(1);

      expect(speakGodDecree('Muted test', { enabled: false })).toBe(false);
      stopGodSpeech();
      expect(cancel).toHaveBeenCalled();

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ v: 1, llmConfigured: false, githubPrConfigured: false }))
      );
      render(<GodAltarPanel />);
      const sfxToggle = screen.getByTestId('god-altar-sfx-toggle');
      const voiceToggle = screen.getByTestId('god-altar-voice-toggle');
      expect(sfxToggle.getAttribute('aria-pressed')).toBe('true');
      expect(voiceToggle.disabled).toBe(false);
      fireEvent.click(sfxToggle);
      expect(sfxToggle.getAttribute('aria-pressed')).toBe('false');
      expect(voiceToggle.disabled).toBe(true);
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.speechSynthesis;
      delete globalThis.SpeechSynthesisUtterance;
    }
  });

  it('prefers Chirp3-HD cloud audio through cathedral reverb, and falls back to Web Speech when silent', async () => {
    const sourceStart = vi.fn();
    const source = {
      buffer: null,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      start: sourceStart,
      stop: vi.fn(),
      onended: null
    };
    const ctx = {
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn()
      })),
      createGain: vi.fn(() => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), value: 0 },
        connect: vi.fn()
      })),
      createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(8) })),
      createConvolver: vi.fn(() => ({ buffer: null, connect: vi.fn() })),
      createBufferSource: vi.fn(() => source),
      decodeAudioData: vi.fn(async () => ({ duration: 1 }))
    };
    globalThis.AudioContext = vi.fn(function MockCtx() {
      return ctx;
    });
    const speak = vi.fn();
    globalThis.speechSynthesis = { speak, cancel: vi.fn() };
    globalThis.SpeechSynthesisUtterance = vi.fn(function MockUtterance(text) {
      this.text = text;
    });

    try {
      const ref = { current: ctx };
      const cloudAudio = {
        audioBase64: btoa('fake-mp3'),
        mimeType: 'audio/mpeg',
        voiceName: 'en-US-Chirp3-HD-Charon'
      };
      const fetchCloudAudio = vi.fn(async () => cloudAudio);
      await expect(
        speakGodDecreeWithCloud('BEHOLD, MORTAL.', {
          mood: 'wrathful',
          fetchCloudAudio,
          audioContextRef: ref
        })
      ).resolves.toBe(true);
      expect(fetchCloudAudio).toHaveBeenCalledWith({ text: 'BEHOLD, MORTAL.', mood: 'wrathful' });
      expect(ctx.decodeAudioData).toHaveBeenCalled();
      expect(sourceStart).toHaveBeenCalled();
      expect(source.playbackRate.value).toBe(0.96);
      expect(speak).not.toHaveBeenCalled();

      // Cloud silent → Web Speech fallback keeps the wrathful prosody.
      await expect(
        speakGodDecreeWithCloud('BEGONE.', {
          mood: 'wrathful',
          fetchCloudAudio: async () => null,
          audioContextRef: ref
        })
      ).resolves.toBe(true);
      expect(speak).toHaveBeenCalledTimes(1);
      const utterance = speak.mock.calls[0][0];
      expect(utterance.pitch).toBe(0.5);
      expect(utterance.rate).toBe(0.82);

      stopGodSpeech();
      expect(source.stop).toHaveBeenCalled();
    } finally {
      delete globalThis.AudioContext;
      delete globalThis.speechSynthesis;
      delete globalThis.SpeechSynthesisUtterance;
    }
  });

  it('opens GodAltarModal via store, traps focus, links to /god?tab=altar, and restores focus on close', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ v: 1, llmConfigured: false, githubPrConfigured: false }))
    );

    const trigger = document.createElement('button');
    trigger.textContent = 'Summon';
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      <GodAltarHost diagramSource="flowchart TD\nA-->B" contentType="mermaid" userName="Gavin" />
    );
    expect(screen.queryByTestId('god-altar-modal')).toBeNull();

    openGodAltar();
    const modal = await screen.findByTestId('god-altar-modal');
    expect(modal).toBeTruthy();
    expect(screen.getByTestId('god-altar-ascend-link').getAttribute('href')).toBe('/god?tab=altar');
    expect(document.activeElement).toBe(screen.getByTestId('god-altar-input'));

    const ascendLink = screen.getByTestId('god-altar-ascend-link');
    ascendLink.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(modal.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(ascendLink);

    const focusables = modal.querySelectorAll(
      'a[href], button:not(:disabled), textarea:not(:disabled)'
    );
    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(ascendLink);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('god-altar-modal')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('closes AudioContext on unmount, honors latest mute state, keeps textarea focus, caps payloads, and ignores stale completions', async () => {
    const closeCtx = vi.fn(async () => {});
    const oscStart = vi.fn();
    globalThis.AudioContext = vi.fn(function MockCtx() {
      return {
        currentTime: 0,
        sampleRate: 44100,
        destination: {},
        close: closeCtx,
        createOscillator: () => ({
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: oscStart,
          stop: vi.fn()
        }),
        createGain: () => ({
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn()
        })
      };
    });

    let resolvePrayer;
    const petitionPayloads = [];
    const filePrPayloads = [];
    const fetchMock = vi.fn((url, init = {}) => {
      const u = String(url);
      if (u.includes('/api/god/petition/capabilities')) {
        return Promise.resolve(
          jsonResponse({ v: 1, llmConfigured: true, githubPrConfigured: true })
        );
      }
      if (u.includes('/api/god/petition/file-pr')) {
        filePrPayloads.push(JSON.parse(init.body));
        return Promise.resolve(
          jsonResponse({
            v: 1,
            filed: true,
            mode: 'github_pr',
            branch: 'god-petition/x',
            prNumber: 12,
            prUrl: 'https://github.com/acuhlmann/mermaid-gen/pull/12',
            ghCommand: 'gh pr create',
            divineMessage: 'PR #12 opened.'
          })
        );
      }
      if (u.includes('/api/god/petition/speak')) {
        return Promise.resolve(jsonResponse({ audio: null, reason: 'disabled' }));
      }
      if (u.includes('/api/god/petition')) {
        petitionPayloads.push(JSON.parse(init.body));
        return new Promise((resolve) => {
          resolvePrayer = resolve;
        });
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const view = render(<GodAltarPanel />);
      const input = screen.getByTestId('god-altar-input');
      input.focus();

      const longPrayer = 'P'.repeat(1500);
      fireEvent.change(input, { target: { value: longPrayer } });
      fireEvent.click(screen.getByTestId('god-altar-submit'));

      // Mute while prayer is in flight: completion must read ref and stay silent.
      fireEvent.click(screen.getByTestId('god-altar-sfx-toggle'));
      resolvePrayer(
        jsonResponse({
          v: 1,
          mode: 'llm',
          reply: 'GRANTED.',
          favorDelta: 30,
          favor: 65,
          mood: 'benevolent',
          judgment: 'WORTHY',
          prProposal: PROPOSAL
        })
      );

      await screen.findByTestId('god-pr-decree');
      expect(oscStart).not.toHaveBeenCalled();
      expect(screen.getByTestId('god-altar-input')).toBe(input);

      // Re-enable sound and file PR -> prayerSummary is capped at 1000 chars and AudioContext closes on unmount.
      fireEvent.click(screen.getByTestId('god-altar-sfx-toggle'));
      fireEvent.click(screen.getByTestId('god-file-pr-button'));
      await screen.findByTestId('god-pr-outcome');
      expect(filePrPayloads[0].prayerSummary).toHaveLength(1000);
      expect(oscStart).toHaveBeenCalled();

      // Send 13 rounds (> 24 total messages) and confirm payload is trimmed to 24 while thread grows.
      for (let i = 0; i < 13; i += 1) {
        fireEvent.change(screen.getByTestId('god-altar-input'), {
          target: { value: `Round ${i}` }
        });
        fireEvent.click(screen.getByTestId('god-altar-submit'));
        resolvePrayer(
          jsonResponse({
            v: 1,
            mode: 'llm',
            reply: `Answer ${i}`,
            favorDelta: 1,
            favor: 70,
            mood: 'amused',
            judgment: 'NOTED',
            prProposal: null
          })
        );
        await screen.findByText(`Answer ${i}`);
      }
      expect(petitionPayloads.at(-1).messages.length).toBeLessThanOrEqual(24);
      expect(screen.getByText('Answer 12')).toBeTruthy();

      // Unmount closes AudioContext and ignores stale completions.
      fireEvent.change(screen.getByTestId('god-altar-input'), { target: { value: 'Last wish' } });
      fireEvent.click(screen.getByTestId('god-altar-submit'));
      view.unmount();
      expect(closeCtx).toHaveBeenCalledTimes(1);

      resolvePrayer(
        jsonResponse({
          v: 1,
          mode: 'llm',
          reply: 'TOO LATE.',
          favorDelta: 10,
          favor: 80,
          mood: 'smitten',
          judgment: 'LATE',
          prProposal: PROPOSAL
        })
      );
      await Promise.resolve();
      expect(getGodAltarEvent()?.kind).toBe('pray');
    } finally {
      delete globalThis.AudioContext;
    }
  });
});
