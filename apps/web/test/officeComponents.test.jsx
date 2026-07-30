// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CoffeeBreakOverlay from '../src/components/CoffeeBreakOverlay.jsx';
import CallMeetingPicker from '../src/components/CallMeetingPicker.jsx';
import MeetingInviteToast from '../src/components/MeetingInviteToast.jsx';
import MeetingOverlay from '../src/components/MeetingOverlay.jsx';
import OfficeImPing from '../src/components/OfficeImPing.jsx';
import OfficeInboxDock from '../src/components/OfficeInboxDock.jsx';
import OfficeMessenger from '../src/components/OfficeMessenger.jsx';
import { setOfficeCaptions } from '../src/state/officeMomentStore.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const EMAILS = [
  {
    id: 'email-1',
    colleagueId: 'facilities',
    subject: 'FRIDGE CLEANOUT FRIDAY',
    body: 'Anything unlabelled becomes property of Facilities.',
    createdAt: 1,
    read: false
  },
  {
    id: 'email-2',
    colleagueId: 'scrumMaster',
    subject: 'Story-point your diagram',
    body: 'Great energy!',
    actionPrompt: 'Split the most complex node into two smaller steps',
    createdAt: 2,
    read: true
  }
];

describe('OfficeInboxDock', () => {
  it('shows the unread badge, opens the list, and marks an email read', () => {
    const onMarkRead = vi.fn();
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={1}
        focusTime={false}
        onMarkRead={onMarkRead}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /1 unread/ }));
    fireEvent.click(screen.getByText('FRIDGE CLEANOUT FRIDAY'));
    expect(onMarkRead).toHaveBeenCalledWith('email-1');
    expect(screen.getByText(/property of Facilities/)).toBeTruthy();
  });

  it('surfaces the Do it button for actionable emails and adopts the prompt', () => {
    const onAdoptPrompt = vi.fn();
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={0}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={onAdoptPrompt}
        onCallMeeting={vi.fn()}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    fireEvent.click(screen.getByText('Story-point your diagram'));
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(onAdoptPrompt).toHaveBeenCalledWith(
      'Split the most complex node into two smaller steps',
      'scrumMaster'
    );
  });

  it('gates Hop on a call when meetings are unavailable', () => {
    render(
      <OfficeInboxDock
        emails={[]}
        unreadCount={0}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    expect(screen.queryByLabelText(/Focus/i)).toBeNull();
    expect(screen.queryByLabelText(/Noise|Soundscape/i)).toBeNull();
    expect(screen.queryByLabelText(/Voice|Narration/i)).toBeNull();
    expect(screen.queryByLabelText(/CC|Captions/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Hop on a call/ }).disabled).toBe(true);
  });

  it('calls a meeting with a single email without requiring a checkbox tap', () => {
    const onCallMeeting = vi.fn();
    render(
      <OfficeInboxDock
        emails={[EMAILS[0]]}
        unreadCount={1}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={onCallMeeting}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /1 unread/ }));
    fireEvent.click(screen.getByRole('button', { name: /Hop on a call \(1\)/ }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities'],
      topic: 'FRIDGE CLEANOUT FRIDAY',
      source: 'email',
      modality: 'remote',
      contextSource: 'email',
      contextDetail: expect.stringContaining('FRIDGE CLEANOUT FRIDAY')
    });
  });

  it('calls a meeting with selected email senders and subjects', () => {
    const onCallMeeting = vi.fn();
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={1}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={onCallMeeting}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /1 unread/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Select email from Gary/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Select email from Pam/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hop on a call \(2\)/ }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities', 'scrumMaster'],
      topic: 'FRIDGE CLEANOUT FRIDAY; Story-point your diagram',
      source: 'email',
      modality: 'remote',
      contextSource: 'email',
      contextDetail: expect.stringContaining('FRIDGE CLEANOUT FRIDAY')
    });
  });

  it('calls a meeting about the open email from the reading pane', () => {
    const onCallMeeting = vi.fn();
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={0}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={onCallMeeting}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    fireEvent.click(screen.getByText('FRIDGE CLEANOUT FRIDAY'));
    fireEvent.click(screen.getByRole('button', { name: /Hop on a call about this/i }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities'],
      topic: 'FRIDGE CLEANOUT FRIDAY',
      source: 'email',
      modality: 'remote',
      contextSource: 'email',
      contextDetail: expect.stringContaining('FRIDGE CLEANOUT FRIDAY')
    });
  });
});

describe('CallMeetingPicker', () => {
  it('seeds senders, applies a quick group, and confirms a normalized roster', () => {
    const onConfirm = vi.fn();
    render(
      <CallMeetingPicker
        open
        seedAttendees={['facilities']}
        topic="FRIDGE CLEANOUT FRIDAY"
        source="email"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('FRIDGE CLEANOUT FRIDAY')).toBeTruthy();
    expect(screen.getByText(/From your inbox/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Slap on headsets/i }).getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Your team' }));
    fireEvent.click(screen.getByRole('button', { name: /Dial in|Book it|Start/ }));
    expect(onConfirm).toHaveBeenCalled();
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.attendees).toEqual(
      expect.arrayContaining(['gilfoyle', 'erlich', 'russ', 'jared', 'richard'])
    );
    expect(payload.attendees).not.toContain('scrumMaster');
    expect(payload.topic).toBe('FRIDGE CLEANOUT FRIDAY');
    expect(payload.modality).toBe('remote');
  });

  it('includes Pam when the steering preset is chosen and defaults desk to glass room', () => {
    const onConfirm = vi.fn();
    render(
      <CallMeetingPicker
        open
        seedAttendees={[]}
        source="desk"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /Book the glass room/i }).getAttribute('aria-pressed')
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Steering' }));
    fireEvent.click(screen.getByRole('button', { name: /Dial in|Book it|Start/ }));
    expect(onConfirm).toHaveBeenCalled();
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.attendees[0]).toBe('scrumMaster');
    expect(payload.modality).toBe('physical');
  });

  it('lets the user cancel without starting', () => {
    const onCancel = vi.fn();
    render(
      <CallMeetingPicker
        open
        seedAttendees={['intern']}
        source="chat"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Never mind' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('OfficeMessenger hop-on-a-call', () => {
  it('seeds the active thread into a remote headset meeting', () => {
    const onCallMeeting = vi.fn();
    render(
      <OfficeMessenger
        open
        messages={[
          {
            id: 'im-1',
            colleagueId: 'intern',
            body: 'quick question',
            createdAt: 1,
            read: true,
            outbound: false
          }
        ]}
        onClose={vi.fn()}
        onMarkRead={vi.fn()}
        onSend={vi.fn()}
        onCallMeeting={onCallMeeting}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Hop on a call/i }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['intern'],
      source: 'chat',
      modality: 'remote',
      topic: 'quick question',
      contextSource: 'chat',
      contextDetail: expect.stringContaining('quick question')
    });
  });
});

describe('office who-is-who chrome', () => {
  it('shows the sender name AND role on inbox rows', () => {
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={1}
        focusTime={false}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /1 unread/ }));
    expect(screen.getByText(/Facilities & Fridge Czar/)).toBeTruthy();
    expect(screen.getByText(/Agile Coach/)).toBeTruthy();
  });

  it('announces IM pings briefly without showing the full message body', () => {
    const onOpenMessage = vi.fn();
    render(
      <OfficeImPing
        pings={[{ id: 'im-1', colleagueId: 'greybeard', body: 'We tried that in 1979.' }]}
        onDismiss={vi.fn()}
        onOpenMessage={onOpenMessage}
      />
    );
    expect(screen.getByText('Slop Chat™ · Instant message')).toBeTruthy();
    expect(screen.getByText('Ulrich')).toBeTruthy();
    expect(screen.getByText(/Staff Engineer Emeritus/)).toBeTruthy();
    expect(screen.getByText('Ulrich messaged you')).toBeTruthy();
    expect(screen.queryByText('We tried that in 1979.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    expect(onOpenMessage).toHaveBeenCalledWith('greybeard', 'im-1');
  });

  it('shows a Slop Chat history chip when unread messages remain after toasts expire', () => {
    const onOpenHistory = vi.fn();
    render(<OfficeImPing pings={[]} imUnreadCount={3} onOpenHistory={onOpenHistory} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Slop Chat \(3 unread\)/ }));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('names every attendee on a meeting invite instead of bare emoji', () => {
    render(
      <MeetingInviteToast
        invite={{
          id: 'meeting-1',
          colleagueId: 'scrumMaster',
          title: 'WG: Diagram Alignment Sync (recurring)',
          body: 'Agenda: alignment.',
          attendees: ['scrumMaster', 'intern', 'greybeard']
        }}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );
    expect(screen.getByText('Chad')).toBeTruthy();
    expect(screen.getByText('Ulrich')).toBeTruthy();
    expect(screen.getByTitle(/The Intern \(Unpaid, Strategic\)/)).toBeTruthy();
  });

  it('labels each meeting seat with the attendee name', () => {
    render(
      <MeetingOverlay
        meeting={{
          state: 'playing',
          title: 'WG',
          attendees: ['scrumMaster', 'greybeard'],
          facilitatorId: 'scrumMaster',
          completed: false,
          interjectionsLeft: 2,
          transcript: []
        }}
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.getByText('Pam')).toBeTruthy();
    expect(screen.getByText('Ulrich')).toBeTruthy();
  });
});

describe('CoffeeBreakOverlay', () => {
  it('runs invite → accept → done and grants the break on bail-out', () => {
    setOfficeCaptions(true);
    const onAccept = vi.fn();
    const onDone = vi.fn();
    const coffee = {
      id: 'coffee-1',
      accepted: false,
      lines: [{ speakerId: 'facilities', text: 'New machine. Twelve decorative buttons.' }]
    };
    const { rerender } = render(
      <CoffeeBreakOverlay coffee={coffee} onAccept={onAccept} onDecline={vi.fn()} onDone={onDone} />
    );
    expect(screen.getByText('Up for coffee?')).toBeTruthy();
    expect(screen.getByTestId('office-coffee-invite')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Take 5' }));
    expect(onAccept).toHaveBeenCalled();
    rerender(
      <CoffeeBreakOverlay
        coffee={{ ...coffee, accepted: true }}
        onAccept={onAccept}
        onDecline={vi.fn()}
        onDone={onDone}
      />
    );
    expect(screen.getByTestId('office-coffee-scene')).toBeTruthy();
    expect(screen.getByText(/Twelve decorative buttons/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: "I've got a deploy" }));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('MeetingOverlay', () => {
  const PLAYING_MEETING = {
    state: 'playing',
    title: 'WG: Diagram Governance Sync (recurring)',
    attendees: ['scrumMaster', 'barker', 'greybeard'],
    facilitatorId: 'scrumMaster',
    completed: false,
    interjectionsLeft: 2,
    transcript: [
      { speakerId: 'scrumMaster', kind: 'procedural', text: 'Welcome! Time-boxed to 15.' },
      { speakerId: 'greybeard', kind: 'offRails', text: 'We had this diagram in 1979.' }
    ]
  };

  it('renders the transcript and submits a raise-hand interjection', () => {
    const onInterject = vi.fn();
    render(
      <MeetingOverlay
        meeting={PLAYING_MEETING}
        narration={false}
        onInterject={onInterject}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.getByText(/We had this diagram in 1979/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Speak to the room'), {
      target: { value: 'What about the budget?' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Speak \(2\)/ }));
    expect(onInterject).toHaveBeenCalledWith('What about the budget?');
  });

  it('dismisses the meeting when Close is clicked', () => {
    const onClose = vi.fn();
    render(
      <MeetingOverlay
        meeting={PLAYING_MEETING}
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={onClose}
        onAdoptPrompt={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the transcript in speaker view when captions are off and voice is active', () => {
    render(
      <MeetingOverlay
        meeting={{
          ...PLAYING_MEETING,
          voiceSpeaking: true
        }}
        captions={false}
        narration
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.queryByText(/We had this diagram in 1979/)).toBeNull();
    expect(screen.getAllByText('Ulrich').length).toBeGreaterThan(0);
    expect(screen.queryByText(/turn on CC/i)).toBeNull();
  });

  it('keeps speaker view between narration beats when captions are off', () => {
    render(
      <MeetingOverlay
        meeting={{
          ...PLAYING_MEETING,
          voiceSpeaking: false
        }}
        captions={false}
        narration
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.queryByText(/We had this diagram in 1979/)).toBeNull();
    expect(screen.getAllByText('Ulrich').length).toBeGreaterThan(0);
  });

  it('shows the transcript when captions are on even while voice plays', () => {
    render(
      <MeetingOverlay
        meeting={{
          ...PLAYING_MEETING,
          voiceSpeaking: true
        }}
        captions
        narration
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.getByText(/We had this diagram in 1979/)).toBeTruthy();
  });

  it('shows minutes with Do selected / Do it all once the meeting ends', () => {
    const onAdoptAllPrompts = vi.fn();
    const onClose = vi.fn();
    const ended = {
      ...PLAYING_MEETING,
      state: 'ended',
      completed: true,
      transcript: [
        ...PLAYING_MEETING.transcript,
        {
          speakerId: 'barker',
          kind: 'substantive',
          text: 'Merge Discovery and Research.',
          actionPrompt: 'Merge the Discovery and Research nodes'
        }
      ]
    };
    render(
      <MeetingOverlay
        meeting={ended}
        onInterject={vi.fn()}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onAdoptAllPrompts={onAdoptAllPrompts}
        onClose={onClose}
      />
    );
    expect(screen.getByText('Meeting minutes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Do it all' }));
    expect(onAdoptAllPrompts).toHaveBeenCalledWith(['Merge the Discovery and Research nodes']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
