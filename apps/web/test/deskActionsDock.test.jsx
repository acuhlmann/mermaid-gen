// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function open(props = {}) {
  const handlers = {
    onGetCoffee: vi.fn(),
    onWalkTheFloor: vi.fn(),
    onImSomeone: vi.fn(),
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onCallMeeting: vi.fn(),
    onTalkToTeam: vi.fn(),
    onCheckHrProgression: vi.fn(),
    onOpenOutbox: vi.fn(),
    onOpenSettings: vi.fn(),
    onToggleThinking: vi.fn(),
    canOpenOutbox: true,
    canToggleThinking: true,
    ...props
  };
  render(<DeskActionsDock {...handlers} />);
  fireEvent.click(screen.getByRole('button', { name: /Your desk/i }));
  return handlers;
}

describe('DeskActionsDock', () => {
  afterEach(() => cleanup());

  it('shows the ArchiSlop mark on the desk stamp', () => {
    render(
      <DeskActionsDock
        onGetCoffee={vi.fn()}
        onWalkTheFloor={vi.fn()}
        onImSomeone={vi.fn()}
        onCheckInbox={vi.fn()}
        onOpenSlopChat={vi.fn()}
        onCallMeeting={vi.fn()}
        onTalkToTeam={vi.fn()}
        onCheckHrProgression={vi.fn()}
        onOpenOutbox={vi.fn()}
        onOpenSettings={vi.fn()}
        onToggleThinking={vi.fn()}
      />
    );
    const trigger = screen.getByTestId('bottom-brand-mark');
    expect(trigger.querySelector('.brand-helmet-svg')).toBeTruthy();
  });

  it('shows an unread badge on the desk button and inbox verb', () => {
    open({ unreadCount: 3 });
    expect(screen.getByRole('button', { name: /Your desk/i }).textContent).toContain('3');
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).textContent).toContain('3');
  });

  it('offers desk verbs in priority order without Meet the Office', () => {
    open();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items.join('\n')).not.toMatch(/Meet the Office/);
    expect(items[0]).toMatch(/Talk to your team/);
    expect(items[1]).toMatch(/Call a meeting/);
    expect(items[2]).toMatch(/Check your mail/);
    expect(items[3]).toMatch(/Ship from the Outbox/);
    for (const label of [
      'Open Slop Chat',
      'Message someone',
      'Walk the floor',
      'Get a coffee',
      'Open the Thinking board',
      'Adjust your workstation',
      'Check my HR progression'
    ]) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it('runs Settings and Thinking verbs and closes the menu', () => {
    const handlers = open({ canToggleThinking: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Adjust your workstation/ }));
    expect(handlers.onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles Thinking from the desk menu', () => {
    cleanup();
    const handlers = open({ canToggleThinking: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Open the Thinking board/ }));
    expect(handlers.onToggleThinking).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens Outbox from the desk menu', () => {
    const handlers = open({ canOpenOutbox: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Ship from the Outbox/ }));
    expect(handlers.onOpenOutbox).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows an unread badge on Slop Chat when IMs are waiting', () => {
    open({ imUnreadCount: 2 });
    expect(screen.getByRole('menuitem', { name: /Open Slop Chat/ }).textContent).toContain('2');
  });

  it('opens Slop Chat from the desk menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Open Slop Chat/ }));
    expect(handlers.onOpenSlopChat).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs HR progression and closes the menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Check my HR progression/ }));
    expect(handlers.onCheckHrProgression).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs the verb and closes the menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Get a coffee/ }));
    expect(handlers.onGetCoffee).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables verbs with an in-fiction reason while blocked, but never inbox, settings, or HR', () => {
    open({ blockedReason: 'meeting' });
    const coffee = screen.getByRole('menuitem', { name: /Get a coffee/ });
    expect(coffee.disabled).toBe(true);
    expect(coffee.getAttribute('title')).toMatch(/in a meeting/i);
    // Reading your mail / tweaking the desk is always allowed — popovers, not
    // another office surface on screen.
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Adjust your workstation/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Check my HR progression/ }).disabled).toBe(false);
  });

  it('blocks Call a meeting on an empty canvas with the agenda gag', () => {
    open({ canCallMeeting: false });
    const meeting = screen.getByRole('menuitem', { name: /Call a meeting/ });
    expect(meeting.disabled).toBe(true);
    expect(meeting.getAttribute('title')).toMatch(/agenda/i);
  });

  it('blocks Talk to your team on an empty canvas so it never silently no-ops', () => {
    open({ canTalkToTeam: false });
    const team = screen.getByRole('menuitem', { name: /Talk to your team/ });
    expect(team.disabled).toBe(true);
    expect(team.getAttribute('title')).toMatch(/nothing to react to/i);
  });

  it('enables Talk to your team once there is a diagram', () => {
    const handlers = open({ canTalkToTeam: true });
    const team = screen.getByRole('menuitem', { name: /Talk to your team/ });
    expect(team.disabled).toBe(false);
    fireEvent.click(team);
    expect(handlers.onTalkToTeam).toHaveBeenCalledTimes(1);
  });

  it('blocks Outbox and Thinking when there is nothing to open', () => {
    open({ canOpenOutbox: false, canToggleThinking: false });
    const outbox = screen.getByRole('menuitem', { name: /Ship from the Outbox/ });
    const thinking = screen.getByRole('menuitem', { name: /Open the Thinking board/ });
    expect(outbox.disabled).toBe(true);
    expect(thinking.disabled).toBe(true);
    expect(outbox.getAttribute('title')).toMatch(/Nothing to ship/i);
    expect(thinking.getAttribute('title')).toMatch(/empty/i);
  });
});
