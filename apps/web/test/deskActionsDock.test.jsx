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
    onCallMeeting: vi.fn(),
    onTalkToTeam: vi.fn(),
    ...props
  };
  render(<DeskActionsDock {...handlers} />);
  fireEvent.click(screen.getByRole('button', { name: /Your desk/i }));
  return handlers;
}

describe('DeskActionsDock', () => {
  afterEach(() => cleanup());

  it('shows an unread badge on the desk button and inbox verb', () => {
    open({ unreadCount: 3 });
    expect(screen.getByRole('button', { name: /Your desk/i }).textContent).toContain('3');
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).textContent).toContain('3');
  });

  it('offers the six desk verbs once opened', () => {
    open();
    for (const label of [
      'Get a coffee',
      'Walk the floor',
      'Message someone',
      'Check your mail',
      'Call a meeting',
      'Talk to your team'
    ]) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it('runs the verb and closes the menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Get a coffee/ }));
    expect(handlers.onGetCoffee).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables verbs with an in-fiction reason while blocked, but never the inbox', () => {
    open({ blockedReason: 'meeting' });
    const coffee = screen.getByRole('menuitem', { name: /Get a coffee/ });
    expect(coffee.disabled).toBe(true);
    expect(coffee.getAttribute('title')).toMatch(/in a meeting/i);
    // Reading your mail is always allowed — it opens a popover, it doesn't
    // put another office surface on screen.
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
  });

  it('blocks Call a meeting on an empty canvas with the agenda gag', () => {
    open({ canCallMeeting: false });
    const meeting = screen.getByRole('menuitem', { name: /Call a meeting/ });
    expect(meeting.disabled).toBe(true);
    expect(meeting.getAttribute('title')).toMatch(/agenda/i);
  });
});
