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
import { deskDoingFor } from '../src/utils/officeFloorActivity.js';

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

  it('shows only the newest beat on remote headset syncs', () => {
    const remote = {
      ...PLAYING,
      modality: 'remote',
      transcript: [
        { speakerId: 'gilfoyle', kind: 'substantive', text: 'The gateway is the bottleneck.' },
        { speakerId: 'cfo', kind: 'substantive', text: 'What does the gateway cost per quarter?' }
      ]
    };
    renderFloor({ meeting: remote });

    const bubble = screen.getByTestId('office-floor-meeting-bubble');
    expect(bubble.textContent).toMatch(/What does the gateway cost/);
    expect(bubble.textContent).toMatch(/Diane/);
    expect(screen.queryByText(/gateway is the bottleneck/)).toBeNull();
  });

  it('shows no speech bubble in the physical glass room', () => {
    renderFloor({ meeting: PLAYING });
    expect(screen.queryByTestId('office-floor-meeting-bubble')).toBeNull();
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

  it('speaks to the room through the capped interjection handler', () => {
    const onInterject = vi.fn();
    renderFloor({ meeting: PLAYING, meetingHandlers: { onInterject } });

    const input = screen.getByRole('textbox', { name: /speak to the room/i });
    fireEvent.change(input, { target: { value: 'Can we name the bottleneck?' } });
    fireEvent.click(screen.getByRole('button', { name: /Speak \(2\)/ }));

    expect(onInterject).toHaveBeenCalledWith('Can we name the bottleneck?');
    expect(input.value).toBe('');
  });

  it('refuses another line once the room is at time', () => {
    renderFloor({ meeting: { ...PLAYING, interjectionsLeft: 0 } });

    expect(screen.getByRole('textbox', { name: /speak to the room/i }).disabled).toBe(true);
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

  it('starts speaking immediately while the script loads', () => {
    renderFloor({
      meeting: {
        ...PLAYING,
        title: 'Architecture Review Board (steering)',
        transcript: []
      }
    });

    expect(screen.queryByText(/Waiting for the organizer to admit you/)).toBeNull();
    expect(screen.getByRole('textbox', { name: /speak to the room/i })).toBeTruthy();
  });

  it('includes a mic on the floor meeting card', () => {
    const view = renderFloor({ meeting: PLAYING });
    const card = view.container.querySelector('[data-testid="office-floor-meeting-card"]');
    expect(card?.querySelector('.office-floor-card-mic')).toBeTruthy();
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
    expect(screen.queryByRole('textbox', { name: /speak to the room/i })).toBeNull();
  });

  it('renders nothing about meetings when there is no meeting', () => {
    renderFloor();
    expect(screen.queryByTestId('office-floor-meeting-card')).toBeNull();
    expect(screen.queryByTestId('office-floor-meeting-seat-you')).toBeNull();
  });
});

/**
 * The way into the glass room (§ 5 slice 27).
 *
 * jsdom has no WAAPI engine, so `useWalkAnimation` settles every walk in one
 * tick — the *walk* is not observable through a full-floor mount, and the
 * hand-off contract is asserted against `FloorMeeting` directly in
 * `officeFloorCommuters.test.jsx` where the other slice-17 surfaces are. What a
 * mount can still prove is that nobody is **lost** on the way in, which is this
 * slice's one way of breaking the room.
 */
describe('walking into the glass room (slice 27)', () => {
  /** Nobody has spoken yet: the room is still filling up. */
  const CONVENING = {
    ...PLAYING,
    attendees: ['scrumMaster', 'gilfoyle', 'jared'],
    transcript: []
  };

  it('gets every attendee into a chair, walk or no walk', () => {
    const view = renderFloor({ meeting: CONVENING });
    for (const id of CONVENING.attendees) {
      expect(
        screen.getByTestId(`office-floor-meeting-seat-${id}`),
        `${id} never made it into the room`
      ).toBeTruthy();
      expect(view.container.querySelector(`[data-seat="${id}"]`)?.dataset.vacant).toBe('true');
    }
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
  });

  /*
   * The finding that shaped the slice, asserted where it would bite. Leadership
   * are sealed in their own fishbowl with no glass-free route out, so they never
   * commute at all — and a room that gated its actors on "has arrived" would
   * erase them from the meeting rather than merely skipping their walk.
   */
  it('still seats an executive who has no way to walk there', () => {
    renderFloor({ meeting: { ...CONVENING, attendees: ['scrumMaster', 'cfo'] } });
    expect(screen.getByTestId('office-floor-meeting-seat-cfo')).toBeTruthy();
    expect(screen.getByTestId('office-floor-meeting-seat-scrumMaster')).toBeTruthy();
  });

  it('seats everyone when you stand up into a meeting already talking', () => {
    renderFloor({ meeting: PLAYING });
    for (const id of PLAYING.attendees) {
      expect(screen.getByTestId(`office-floor-meeting-seat-${id}`)).toBeTruthy();
    }
  });
});

describe('the table has something on it (slice 29)', () => {
  /**
   * These mount the floor, so the hour reaches them — and after this slice it
   * reaches the glass room too. Pinning `Date` only keeps React's scheduling
   * and the floor's poll timer alive (§ 8's standing trap).
   */
  function atHour(hour) {
    vi.setSystemTime(new Date(2026, 7, 11, hour, 0, 0));
  }

  /** The figure in a chair, which is where `data-hold` and the face live. */
  const actor = (id) =>
    screen
      .getByTestId(`office-floor-meeting-seat-${id}`)
      .querySelector('.office-floor-person-figure');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    atHour(12); // midday — the baseline, and the phase with no art
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands the agenda to whoever called it', () => {
    renderFloor({ meeting: PLAYING });
    expect(actor(PLAYING.facilitatorId).dataset.hold).toBe('papers');
    expect(actor(PLAYING.facilitatorId).className).toMatch(/is-pose-reading/);
    // Everybody else is listening at this hour, so the agenda is the one thing
    // on the table rather than a value the whole room happened to share.
    expect(actor('gilfoyle').dataset.hold).toBeUndefined();
    expect(actor('you').dataset.hold).toBeUndefined();
  });

  it('actually draws the agenda, not just the marker attribute', () => {
    // Same guard the desk drawings carry: `data-hold` would keep passing with
    // `HeldItem` rendering nothing, which is what a broken import looks like.
    renderFloor({ meeting: PLAYING });
    const layer = actor(PLAYING.facilitatorId).querySelector('.office-floor-person-hold');
    expect(layer).toBeTruthy();
    expect(layer.innerHTML.length).toBeGreaterThan(0);
  });

  it('gives the rest of the table the hour', () => {
    atHour(8); // earlyMorning — everybody has a mug
    renderFloor({ meeting: PLAYING });
    for (const id of ['gilfoyle', 'cfo', 'you']) {
      expect(actor(id).dataset.hold, `${id} came to an 8am meeting empty-handed`).toBe('mug');
    }
    // And the person running it is still running it.
    expect(actor(PLAYING.facilitatorId).dataset.hold).toBe('papers');
  });

  it('never puts a headset on somebody sitting in the room', () => {
    // 9:45 is the remote stand-up hour, whose whole-office tell is a headset.
    // A physical meeting at that hour must not draw it: a headset means "on a
    // call from your desk", and these people walked here.
    atHour(9);
    vi.setSystemTime(new Date(2026, 7, 11, 9, 45, 0));
    const view = renderFloor({ meeting: PLAYING });

    for (const id of ['gilfoyle', 'cfo', 'you']) {
      expect(actor(id).querySelector('[data-accessory="headset"]'), id).toBeNull();
      expect(actor(id).className, id).not.toMatch(/is-pose-call/);
    }

    /*
     * Both claims above are negatives, and a negative passes for free on a room
     * that draws nothing — which is precisely what this room did before the
     * slice. So they get two companions. The hour really is the headset one:
     */
    expect(view.container.querySelector('.office-floor').dataset.dayPhase).toBe('standUp');
    const deskFigure = view.container.querySelector(
      '[data-seat="greybeard"] .office-floor-person-figure'
    );
    expect(deskFigure.querySelector('[data-accessory="headset"]')).toBeTruthy();
    // …and the glass room is deriving at that hour rather than skipping it.
    expect(actor(PLAYING.facilitatorId).dataset.hold).toBe('papers');
  });

  it('leaves the desk trait row behind — nobody types through a meeting', () => {
    renderFloor({ meeting: { ...PLAYING, attendees: ['scrumMaster', 'gilfoyle', 'russ'] } });
    // Gilfoyle types and Russ takes calls, at their desks — assert that first,
    // so the two negatives below are overrides rather than rows that were
    // already blank.
    const desk = (id) =>
      screen.getByTestId(`office-floor-meeting-seat-${id}`) &&
      document.querySelector(`[data-seat="${id}"] .office-floor-person-figure`);
    expect(desk('russ')).toBeNull(); // summoned, so his desk figure is gone
    expect(deskDoingFor('russ').hold).toBe('phone');
    expect(deskDoingFor('gilfoyle').pose).toBe('typing');

    expect(actor('gilfoyle').className).not.toMatch(/is-pose-typing/);
    expect(actor('russ').dataset.hold).toBeUndefined();
    // Same companion as above: the room is deriving, not returning nothing.
    expect(actor('scrumMaster').dataset.hold).toBe('papers');
  });
});
