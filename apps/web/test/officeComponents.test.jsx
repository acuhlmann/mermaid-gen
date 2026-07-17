// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CoffeeBreakOverlay from '../src/components/CoffeeBreakOverlay.jsx';
import MeetingInviteToast from '../src/components/MeetingInviteToast.jsx';
import MeetingOverlay from '../src/components/MeetingOverlay.jsx';
import OfficeImPing from '../src/components/OfficeImPing.jsx';
import OfficeInboxDock from '../src/components/OfficeInboxDock.jsx';

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
        onToggleFocusTime={vi.fn()}
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
        onToggleFocusTime={vi.fn()}
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

  it('toggles Focus Time and gates the Call a meeting button', () => {
    const onToggleFocusTime = vi.fn();
    render(
      <OfficeInboxDock
        emails={[]}
        unreadCount={0}
        focusTime={false}
        onToggleFocusTime={onToggleFocusTime}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    fireEvent.click(screen.getByLabelText(/Focus Time/i));
    expect(onToggleFocusTime).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: /Call a meeting/ }).disabled).toBe(true);
  });

  it('toggles the office soundscape', () => {
    const onToggleSoundscape = vi.fn();
    render(
      <OfficeInboxDock
        emails={[]}
        unreadCount={0}
        focusTime={false}
        soundscape
        onToggleFocusTime={vi.fn()}
        onToggleSoundscape={onToggleSoundscape}
        onMarkRead={vi.fn()}
        onMarkAllRead={vi.fn()}
        onAdoptPrompt={vi.fn()}
        onCallMeeting={vi.fn()}
        canCallMeeting={false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /no unread/ }));
    const toggle = screen.getByLabelText(/Soundscape/i);
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(onToggleSoundscape).toHaveBeenCalledWith(false);
  });
});

describe('office who-is-who chrome', () => {
  it('shows the sender name AND role on inbox rows', () => {
    render(
      <OfficeInboxDock
        emails={EMAILS}
        unreadCount={1}
        focusTime={false}
        onToggleFocusTime={vi.fn()}
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
  it('runs invite → accept → done and grants the break on Back to it', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Back to it' }));
    expect(onDone).toHaveBeenCalled();
  });
});

describe('MeetingOverlay', () => {
  const PLAYING_MEETING = {
    state: 'playing',
    title: 'WG: Diagram Governance Sync (recurring)',
    attendees: ['scrumMaster', 'exec', 'greybeard'],
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

  it('shows minutes with Do it action items once the meeting ends', () => {
    const onAdoptPrompt = vi.fn();
    const ended = {
      ...PLAYING_MEETING,
      state: 'ended',
      completed: true,
      transcript: [
        ...PLAYING_MEETING.transcript,
        {
          speakerId: 'exec',
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
        onAdoptPrompt={onAdoptPrompt}
      />
    );
    expect(screen.getByText('Meeting minutes')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Do it' })[0]);
    expect(onAdoptPrompt).toHaveBeenCalledWith('Merge the Discovery and Research nodes', 'exec');
  });
});
