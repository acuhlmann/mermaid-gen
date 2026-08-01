// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { setDeskSlotElement } from '../src/state/deskSlotStore.js';
import {
  _resetForTests as resetOfficeMoments,
  pushOfficeEmail,
  pushOfficeImPing
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';

const SCRIPT = {
  scriptVersion: 1,
  title: 'WG: Fridge Sync',
  beats: [
    { speakerId: 'facilities', kind: 'procedural', text: 'Thanks for hopping on.' },
    {
      speakerId: 'facilities',
      kind: 'substantive',
      text: 'Label the fridge node.',
      actionPrompt: 'Label the fridge node'
    },
    { speakerId: 'gilfoyle', kind: 'procedural', text: 'Parking lot. Done.' }
  ]
};

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

function BottomNavSlot() {
  return (
    <div
      id="office-desk-bottom-slot"
      className="bottom-office-desk-slot"
      ref={(el) => setDeskSlotElement(el)}
    />
  );
}

function renderOffice() {
  return render(
    <>
      <OfficeLayer {...BASE_PROPS} />
      <BottomNavSlot />
    </>
  );
}

describe('OfficeLayer meeting starts', () => {
  beforeEach(() => {
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ script: SCRIPT })
        })
      )
    );
  });

  afterEach(() => {
    cleanup();
    resetOfficeMoments();
    _resetOfficeViewModeForTests();
    setDeskSlotElement(null);
    vi.unstubAllGlobals();
  });

  it('starts a remote headset meeting from inbox without throwing', async () => {
    pushOfficeEmail({
      colleagueId: 'facilities',
      subject: 'FRIDGE CLEANOUT FRIDAY',
      body: 'The fridge is a crime scene.'
    });

    renderOffice();

    fireEvent.click(screen.getByTestId('desk-comms-inbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hop on a call \(1\)/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hop on a call \(1\)/i }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-floating-window="office-meeting"]')).toBeTruthy();
    });
    expect(getOfficeViewMode()).toBe('desk');
    expect(String(globalThis.fetch.mock.calls[0]?.[0] ?? '')).toContain('/api/office/meeting');
  });

  it('starts a remote headset meeting from Slop Chat', async () => {
    pushOfficeImPing({
      colleagueId: 'intern',
      body: 'quick question about the diagram'
    });

    renderOffice();

    fireEvent.click(screen.getByTestId('desk-comms-slopChat'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hop on a call/i })).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hop on a call/i }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-floating-window="office-meeting"]')).toBeTruthy();
    });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('stands into the glass room for a physical desk meeting', async () => {
    renderOffice();

    fireEvent.click(screen.getByTestId('desk-comms-meeting'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Your team/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Your team/i }));
    fireEvent.click(screen.getByRole('button', { name: /Book it|Start meeting|Dial in/i }));

    await waitFor(() => {
      expect(getOfficeViewMode()).toBe('floor');
    });
    expect(document.querySelector('[data-floating-window="office-meeting"]')).toBeNull();
    expect(screen.getByTestId('office-floor')).toBeTruthy();
  });

  it('paints headsets when you stand up during a remote call', async () => {
    pushOfficeEmail({
      colleagueId: 'facilities',
      subject: 'FRIDGE CLEANOUT FRIDAY',
      body: 'The fridge is a crime scene.'
    });

    renderOffice();

    fireEvent.click(screen.getByTestId('desk-comms-inbox'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Hop on a call \(1\)/i })).toBeTruthy();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Hop on a call \(1\)/i }));
    });
    await waitFor(() => {
      expect(document.querySelector('[data-floating-window="office-meeting"]')).toBeTruthy();
    });

    act(() => standUp());

    expect(getOfficeViewMode()).toBe('floor');
    expect(document.querySelector('[data-floating-window="office-meeting"]')).toBeNull();
    expect(document.querySelector('[data-on-call="true"]')).toBeTruthy();
  });
});
