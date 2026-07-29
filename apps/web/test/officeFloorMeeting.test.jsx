// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions, setOfficeNarration } from '../src/state/officeMomentStore.js';

/** The shape useMeetingPlayback exposes — the floor only ever reads it. */
const PLAYING = {
  state: 'playing',
  title: 'Architecture Review Board (steering)',
  attendees: ['scrumMaster', 'gilfoyle', 'cfo'],
  facilitatorId: 'scrumMaster',
  transcript: [
    { speakerId: 'gilfoyle', kind: 'substantive', text: 'The gateway is the bottleneck.' },
    { speakerId: 'cfo', kind: 'substantive', text: 'What does the gateway cost per quarter?' }
  ],
  completed: false,
  interjectionsLeft: 2
};

function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

beforeEach(() => {
  // These suites assert on-screen dialogue. Captions on keeps balloons visible
  // even when the shared narration preference defaults to voice-first.
  setOfficeCaptions(true);
  setOfficeNarration(true);
});

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
  setOfficeCaptions(false);
});

describe('meetings in the glass room (slice 5)', () => {
  it('seats every attendee plus you, and empties their desks', () => {
    const view = renderFloor({ meeting: PLAYING });
    const seat = (id) => view.container.querySelector(`[data-seat="${id}"]`);

    for (const id of PLAYING.attendees) {
      expect(screen.getByTestId(`office-floor-meeting-seat-${id}`)).toBeTruthy();
      expect(seat(id)?.dataset.vacant, `${id} is in two places at once`).toBe('true');
    }
    // The meeting is the one place "you" stand up from your own desk.
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
    expect(seat('you')?.dataset.vacant).toBe('true');
    // Everyone who was not invited is still working.
    expect(seat('greybeard')?.dataset.vacant).toBeUndefined();
  });

  it('leaves desks occupied and paints headsets for a remote sync', () => {
    const remote = {
      ...PLAYING,
      modality: 'remote',
      transcript: [{ speakerId: 'gilfoyle', kind: 'substantive', text: 'Still blank?' }]
    };
    const view = renderFloor({ meeting: remote });
    const seat = (id) => view.container.querySelector(`[data-seat="${id}"]`);

    expect(screen.queryByTestId('office-floor-meeting-seat-gilfoyle')).toBeNull();
    expect(seat('gilfoyle')?.dataset.vacant).toBeUndefined();
    expect(seat('you')?.dataset.vacant).toBeUndefined();
    expect(view.container.querySelector('[data-on-call="true"]')).toBeTruthy();
    expect(screen.getByTestId('office-floor-meeting-card').dataset.modality).toBe('remote');
    expect(screen.getByTestId('office-floor-meeting-bubble').textContent).toMatch(/Still blank/);
  });

  it('shows only the newest beat, attributed to whoever said it', () => {
    renderFloor({ meeting: PLAYING });

    const bubble = screen.getByTestId('office-floor-meeting-bubble');
    expect(bubble.textContent).toMatch(/What does the gateway cost/);
    expect(bubble.textContent).toMatch(/Diane/);
    // The transcript history belongs on a screen, not in the room.
    expect(screen.queryByText(/gateway is the bottleneck/)).toBeNull();
  });

  it('keeps the controls out of the room and in the card slot', () => {
    // Measured, not guessed: a counter-scaled panel over the table is wider
    // than the glass room and hid all nine people in it.
    renderFloor({ meeting: PLAYING });

    expect(screen.getByTestId('office-floor-meeting-card')).toBeTruthy();
    // The card slot is single-occupancy: a meeting outranks the person card.
    expect(screen.queryByText(/Click somebody to see who they are/)).toBeNull();
  });

  it('glows the speaker rather than their tile', () => {
    const view = renderFloor({ meeting: PLAYING });
    const speaking = view.container.querySelectorAll('.office-floor-meeting-actor.is-speaking');
    expect(speaking).toHaveLength(1);
    expect(speaking[0].dataset.testid).toBe('office-floor-meeting-seat-cfo');
  });

  it('raises a hand through the same capped interjection handler', () => {
    const onInterject = vi.fn();
    renderFloor({ meeting: PLAYING, meetingHandlers: { onInterject } });

    const input = screen.getByRole('textbox', { name: /raise hand/i });
    fireEvent.change(input, { target: { value: 'Can we name the bottleneck?' } });
    fireEvent.click(screen.getByRole('button', { name: /Raise hand/i }));

    expect(onInterject).toHaveBeenCalledWith('Can we name the bottleneck?');
    expect(input.value).toBe('');
  });

  it('refuses to raise a hand once the room is at time', () => {
    renderFloor({ meeting: { ...PLAYING, interjectionsLeft: 0 } });

    expect(screen.getByRole('textbox', { name: /raise hand/i }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /At time/i }).disabled).toBe(true);
  });

  it('leaves through the same handler the call window uses', () => {
    const onLeave = vi.fn();
    renderFloor({ meeting: PLAYING, meetingHandlers: { onLeave } });

    fireEvent.click(screen.getByRole('button', { name: /Leave/i }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('sitting down leaves the meeting running and hands it back to the window', () => {
    const onLeave = vi.fn();
    renderFloor({ meeting: PLAYING, meetingHandlers: { onLeave } });

    fireEvent.click(screen.getByRole('button', { name: /My screen/i }));

    // The floor's equivalent of the overlay's docked mode: you are back at your
    // screen, the meeting is untouched.
    expect(getOfficeViewMode()).toBe('desk');
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('waits to be admitted before anyone says anything', () => {
    renderFloor({
      meeting: {
        ...PLAYING,
        state: 'joining',
        title: 'Architecture Review Board (steering)',
        transcript: []
      }
    });

    expect(screen.getByText(/Waiting for the organizer to admit you/)).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: /raise hand/i })).toBeNull();
  });

  it('sends you back to your desk to read the minutes when it wraps', () => {
    const onLeave = vi.fn();
    renderFloor({
      meeting: { ...PLAYING, state: 'ended', completed: true },
      meetingHandlers: { onLeave }
    });

    // Minutes are paperwork: they stay on the screen renderer, reached by
    // sitting down, which keeps the ended meeting alive for the overlay.
    fireEvent.click(screen.getByRole('button', { name: /Read the minutes/i }));
    expect(getOfficeViewMode()).toBe('desk');
    expect(onLeave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: /raise hand/i })).toBeNull();
  });

  it('renders nothing about meetings when there is no meeting', () => {
    renderFloor();
    expect(screen.queryByTestId('office-floor-meeting-card')).toBeNull();
    expect(screen.queryByTestId('office-floor-meeting-seat-you')).toBeNull();
  });
});
