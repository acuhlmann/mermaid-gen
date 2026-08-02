// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function renderDock(props = {}) {
  const handlers = {
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onSummonSync: vi.fn(),
    canSummonSync: true,
    ...props
  };
  render(<DeskActionsDock placement="bottom" {...handlers} />);
  return handlers;
}

describe('DeskActionsDock', () => {
  afterEach(() => cleanup());

  it('renders three direct comms icons — no helmet menu', () => {
    renderDock();
    expect(screen.getByTestId('desk-comms-cluster')).toBeTruthy();
    expect(screen.getByTestId('desk-comms-inbox')).toBeTruthy();
    expect(screen.getByTestId('desk-comms-slopChat')).toBeTruthy();
    expect(screen.getByTestId('desk-comms-meeting')).toBeTruthy();
    expect(screen.queryByTestId('bottom-brand-mark')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByTestId('desk-ambience-pack')).toBeNull();
    expect(screen.queryByTestId('desk-attribution-strip')).toBeNull();
  });

  it('shows independent unread badges on mail and Slop Chat', () => {
    renderDock({ unreadCount: 3, imUnreadCount: 2 });
    expect(screen.getByTestId('desk-comms-inbox').textContent).toContain('3');
    expect(screen.getByTestId('desk-comms-slopChat').textContent).toContain('2');
    expect(screen.getByTestId('desk-comms-meeting').textContent).not.toMatch(/\d/);
  });

  it('caps badges at 9+', () => {
    renderDock({ unreadCount: 12, imUnreadCount: 15 });
    expect(screen.getByTestId('desk-comms-inbox').textContent).toContain('9+');
    expect(screen.getByTestId('desk-comms-slopChat').textContent).toContain('9+');
  });

  it('opens inbox and Slop Chat from the cluster', () => {
    const handlers = renderDock();
    fireEvent.click(screen.getByTestId('desk-comms-inbox'));
    fireEvent.click(screen.getByTestId('desk-comms-slopChat'));
    expect(handlers.onCheckInbox).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenSlopChat).toHaveBeenCalledTimes(1);
    expect(handlers.onCheckInbox.mock.calls[0][0]).toBeTruthy();
  });

  it('opens Have a meeting from the cluster', () => {
    const handlers = renderDock({ onSummonSync: vi.fn(), canSummonSync: true });
    fireEvent.click(screen.getByTestId('desk-comms-meeting'));
    expect(handlers.onSummonSync).toHaveBeenCalledTimes(1);
  });

  it('blocks Have a meeting while already in a meeting', () => {
    renderDock({ onSummonSync: vi.fn(), canSummonSync: false });
    expect(screen.getByTestId('desk-comms-meeting').disabled).toBe(true);
  });

  it('marks the active taskbar comms icon', () => {
    renderDock({ activePanel: 'slopChat' });
    expect(screen.getByTestId('desk-comms-slopChat').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('desk-comms-inbox').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps inbox enabled while blocked', () => {
    renderDock({ blockedReason: 'meeting' });
    expect(screen.getByTestId('desk-comms-inbox').disabled).toBe(false);
  });

  it('keeps inbox in the taskbar cluster', () => {
    render(<DeskActionsDock placement="taskbar" onCheckInbox={vi.fn()} onOpenSlopChat={vi.fn()} />);
    expect(screen.getByTestId('desk-comms-inbox')).toBeTruthy();
    expect(
      screen.getByTestId('desk-comms-inbox').querySelector('.desk-comms-mail-svg')
    ).toBeTruthy();
  });
});
