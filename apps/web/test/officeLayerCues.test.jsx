// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Why this file exists.
 *
 * `cue-chairs-gather.mp3` shipped in slice 2 with a `SAMPLES` row, a
 * `SYNTH_CUE_PLAYERS` row, a manifest line, 30 spent credits and a sentence in
 * docs/office-parody.md §6 saying it fires when a mob huddle seats — and no
 * call site anywhere in apps/web. It never made a sound.
 *
 * Both assertions in officeCuePlayers.test.js passed the whole time, because
 * both ask whether a cue *could* play. Nothing asked whether anything plays it.
 * That gap is only closable at the call site, so the cue name is what this test
 * asserts on: `officeCueChime` is mocked to record which cue it was handed.
 */
vi.mock('../src/utils/officeCuePlayers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    officeCueChime: vi.fn(() => () => {})
  };
});

import { act, fireEvent, waitFor } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { officeCueChime } from '../src/utils/officeCuePlayers.js';
import { setDeskSlotElement } from '../src/state/deskSlotStore.js';
import { _resetForTests as resetOfficeMoments } from '../src/state/officeMomentStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';
import { deliverCannedMoment } from '../src/utils/officeMomentDelivery.js';

const BASE_PROPS = {
  pause: false,
  advisorBusy: false,
  getDiagramSource: () => 'flowchart LR\n  A-->B',
  getContentType: () => 'mermaid',
  getSessionId: () => 'test-session',
  getSvgRoot: () => document,
  getUserTitle: () => 'Intern Architect',
  onUsage: () => {},
  onAdoptPrompt: () => {},
  onMeetingMinutes: () => {},
  onOfficeEvent: () => {},
  onCheckHrProgression: () => {},
  playChime: () => {},
  deskActionsAnchorReady: true
};

/** Cue names handed to `officeCueChime` since the last reset, in order. */
function cuesPlayed() {
  return officeCueChime.mock.calls.map(([cue]) => cue);
}

function renderWithHuddleSignal(signal) {
  return render(
    <>
      <OfficeLayer {...BASE_PROPS} huddleSignal={signal} />
      <div
        id="office-desk-bottom-slot"
        className="bottom-office-desk-slot"
        ref={(el) => setDeskSlotElement(el)}
      />
    </>
  );
}

describe('seating a huddle is audible', () => {
  beforeEach(() => {
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    officeCueChime.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ beats: [] }) }))
    );
  });

  afterEach(() => {
    cleanup();
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    vi.unstubAllGlobals();
  });

  it('drags several chairs over for a mob', () => {
    renderWithHuddleSignal({ seq: 1, mode: 'mob' });
    expect(cuesPlayed()).toContain('chairsGather');
  });

  it('pulls up exactly one for a pair', () => {
    // The distinction is the whole point of having bought a second asset: a
    // pair that sounds like a mob is a mob with the wrong number of faces.
    renderWithHuddleSignal({ seq: 1, mode: 'pair', colleagueId: 'gilfoyle' });
    expect(cuesPlayed()).toContain('chair');
    expect(cuesPlayed()).not.toContain('chairsGather');
  });

  it('stays silent for a pair of nobody, which is not a huddle', () => {
    // `handleStartHuddle` bails before `startHuddle` when a pair names no
    // colleague. The cue has to sit behind that guard, not in front of it, or
    // the office makes the sound of a thing that did not happen.
    renderWithHuddleSignal({ seq: 1, mode: 'pair', colleagueId: null });
    expect(cuesPlayed()).not.toContain('chair');
    expect(cuesPlayed()).not.toContain('chairsGather');
  });
});

describe('an all-hands sounds like one', () => {
  beforeEach(() => {
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    officeCueChime.mockClear();
    vi.stubGlobal(
      'fetch',
      // The crowd cue fires off the synchronous `state: 'playing'` write in
      // `startMeeting`, before this ever resolves — a never-settling promise
      // keeps the test off the script-playback timing entirely.
      vi.fn(() => new Promise(() => {}))
    );
  });

  afterEach(() => {
    cleanup();
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    vi.unstubAllGlobals();
  });

  const CTX = { label: 'paymentGateway', userTitle: 'Associate Slopitect', userName: 'Alex' };

  /**
   * Deliver a canned invite and accept it from the toast. `handleAcceptInvite`
   * calls `startMeeting` directly, which writes `state: 'playing'` before it
   * awaits anything — so the crowd cue is decided synchronously here, with no
   * script playback or walk animation in the way.
   */
  async function acceptInvite(kind) {
    deliverCannedMoment(kind, CTX, { memory: { lastFiredAt: 0, seenTemplateIds: [] } });
    const { container } = render(
      <>
        <OfficeLayer {...BASE_PROPS} />
        <div
          id="office-desk-bottom-slot"
          className="bottom-office-desk-slot"
          ref={(el) => setDeskSlotElement(el)}
        />
      </>
    );
    const accept = await waitFor(() => {
      const el = container.ownerDocument.querySelector('.office-meeting-accept');
      expect(el).not.toBeNull();
      return el;
    });
    await act(async () => {
      fireEvent.click(accept);
    });
  }

  it('fills the room when the meeting has an audience', async () => {
    await acceptInvite('all-hands');
    expect(cuesPlayed()).toContain('crowdSettle');
  });

  it('leaves an ordinary two-person sync alone', async () => {
    // The whole value of the cue is the contrast. If every meeting sounds like
    // forty people, the all-hands sounds like nothing in particular — the same
    // reasoning that gates the confetti on `audience.length`.
    await acceptInvite('meeting-invite');
    expect(cuesPlayed()).not.toContain('crowdSettle');
  });
});
