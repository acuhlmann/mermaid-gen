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

  it('gates Call a meeting when meetings are unavailable', () => {
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
    expect(screen.getByRole('button', { name: /Call a meeting/ }).disabled).toBe(true);
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
    fireEvent.click(screen.getByRole('button', { name: /Call a meeting \(1\)/ }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities'],
      topic: 'FRIDGE CLEANOUT FRIDAY',
      source: 'email'
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
    fireEvent.click(screen.getByRole('button', { name: /Call a meeting \(2\)/ }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities', 'scrumMaster'],
      topic: 'FRIDGE CLEANOUT FRIDAY; Story-point your diagram',
      source: 'email'
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
    fireEvent.click(screen.getByRole('button', { name: /Call a meeting about this email/i }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['facilities'],
      topic: 'FRIDGE CLEANOUT FRIDAY',
      source: 'email'
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
    fireEvent.click(screen.getByRole('button', { name: 'Your team' }));
    fireEvent.click(screen.getByRole('button', { name: /Start meeting|Start huddle/ }));
    expect(onConfirm).toHaveBeenCalled();
    const payload = onConfirm.mock.calls[0][0];
    expect(payload.attendees[0]).toBe('scrumMaster');
    expect(payload.attendees).toEqual(
      expect.arrayContaining(['gilfoyle', 'erlich', 'goMad', 'jared', 'explain'])
    );
    expect(payload.topic).toBe('FRIDGE CLEANOUT FRIDAY');
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

describe('OfficeMessenger call-to-talk', () => {
  it('seeds the active thread into the meeting picker', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Call to talk/i }));
    expect(onCallMeeting).toHaveBeenCalledWith({
      seedAttendees: ['intern'],
      source: 'chat',
      forceFacilitator: true
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

  it('shows the sender name and role on IM pings', () => {
    render(
      <OfficeImPing
        pings={[{ id: 'im-1', colleagueId: 'greybeard', body: 'We tried that in 2009.' }]}
        onDismiss={vi.fn()}
        onQuickReply={vi.fn()}
      />
    );
    expect(screen.getByText('Slop Chat™ · Instant message')).toBeTruthy();
    expect(screen.getByText('Ulrich')).toBeTruthy();
    expect(screen.getByText(/Staff Engineer Emeritus/)).toBeTruthy();
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
      { speakerId: 'greybeard', kind: 'offRails', text: 'We had this diagram in 2009.' }
    ]
  };

  it('renders the transcript and submits a raise-hand interjection', () => {
    const onInterject = vi.fn();
    render(
      <MeetingOverlay
        meeting={PLAYING_MEETING}
        onInterject={onInterject}
        onLeave={vi.fn()}
        onClose={vi.fn()}
        onAdoptPrompt={vi.fn()}
      />
    );
    expect(screen.getByText(/We had this diagram in 2009/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Raise hand'), {
      target: { value: 'What about the budget?' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Raise hand/ }));
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

  it('shows minutes with Do selected / Do it all once the meeting ends', () => {
    const onAdoptAllPrompts = vi.fn();
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
      />
    );
    expect(screen.getByText('Meeting minutes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Do it all' }));
    expect(onAdoptAllPrompts).toHaveBeenCalledWith(['Merge the Discovery and Research nodes']);
  });
});
