// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function open(props = {}) {
  const handlers = {
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onToggleFocusTime: vi.fn(),
    onToggleHeadphones: vi.fn(),
    ...props
  };
  render(<DeskActionsDock {...handlers} />);
  fireEvent.click(screen.getByRole('button', { name: /Your desk/i }));
  return handlers;
}

describe('DeskActionsDock', () => {
  afterEach(() => cleanup());

  it('opens the desk menu on first render when initialOpen is set', () => {
    render(<DeskActionsDock initialOpen onCheckInbox={vi.fn()} onOpenSlopChat={vi.fn()} />);
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByText('Get up')).toBeNull();
  });

  it('shows the ArchiSlop mark on the desk stamp', () => {
    render(<DeskActionsDock onCheckInbox={vi.fn()} onOpenSlopChat={vi.fn()} />);
    const trigger = screen.getByTestId('bottom-brand-mark');
    expect(trigger.querySelector('.brand-helmet-svg')).toBeTruthy();
  });

  it('shows an unread badge on the desk button and inbox verb', () => {
    open({ unreadCount: 3 });
    expect(screen.getByRole('button', { name: /Your desk/i }).textContent).toContain('3');
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).textContent).toContain('3');
  });

  // Slice 2: the desk menu is now *only* the three ways the office reaches you,
  // plus the two ambience postures. Stand up moved to the taskbar's leading
  // corner; the mailroom, contractor, HR and language moved to the menu bar;
  // Concentration moved to the taskbar tray.
  it('lists only office verbs — everything relocated in slice 2 is gone', () => {
    open({ focusTime: false, headphones: false });
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items[0]).toMatch(/Check your mail/);
    for (const label of ['Open Slop Chat', 'Have a meeting']) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
    for (const gone of [
      /Take it to the mailroom/,
      /Onboard a contractor/,
      /Check my HR progression/,
      /Stand up/,
      /Walk the floor/,
      /Open your notebook/,
      /Get a coffee/
    ]) {
      expect(screen.queryByRole('menuitem', { name: gone })).toBeNull();
    }
    expect(screen.queryByTestId('desk-standup-button')).toBeNull();
    expect(screen.queryByTestId('desk-actions-outbox')).toBeNull();
    expect(screen.queryByTestId('concentration-control')).toBeNull();
    expect(screen.queryByTestId('desk-language-pack')).toBeNull();
  });

  it('keeps the two ambience postures in the menu footer', () => {
    open({ focusTime: false, headphones: false });
    const ambience = screen.getByTestId('desk-ambience-pack');
    // Two postures replaced the old four checkboxes (Focus / Noise / Voice / CC):
    // Headphones is how the office reaches you, Focus is whether it does.
    expect(screen.getByTestId('desk-ambience-headphones').textContent).toContain('Headphones');
    expect(screen.getByTestId('desk-ambience-focus').textContent).toContain('Focus');
    expect(ambience.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(ambience.textContent).not.toContain('Noise');
    expect(ambience.textContent).not.toContain('Voice');
    expect(ambience.textContent).not.toContain('CC');
  });

  it('toggles Headphones and Focus from the desk menu footer', () => {
    const handlers = open({ focusTime: false, headphones: false });
    fireEvent.click(screen.getByTestId('desk-ambience-headphones').querySelector('input'));
    expect(handlers.onToggleHeadphones).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('desk-ambience-focus').querySelector('input'));
    expect(handlers.onToggleFocusTime).toHaveBeenCalledWith(true);
  });

  it('reflects headphones-on so the posture survives a reload', () => {
    open({ headphones: true });
    expect(screen.getByTestId('desk-ambience-headphones').querySelector('input').checked).toBe(
      true
    );
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

  it('opens Have a meeting from the desk menu', () => {
    const handlers = open({ onSummonSync: vi.fn(), canSummonSync: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Have a meeting/ }));
    expect(handlers.onSummonSync).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('blocks Have a meeting while already in a meeting', () => {
    open({ onSummonSync: vi.fn(), canSummonSync: false });
    expect(screen.getByRole('menuitem', { name: /Have a meeting/ }).disabled).toBe(true);
  });

  it('never disables inbox while blocked', () => {
    open({ blockedReason: 'meeting' });
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
  });

  it('shows vendor attribution links at the bottom of the desk menu', () => {
    open();
    const strip = screen.getByTestId('desk-attribution-strip');
    expect(strip.textContent).toMatch(/Approved vendors/);
    expect(strip.textContent).toMatch(/fan parody/i);
    const elevenLabs = screen.getByRole('link', { name: 'ElevenLabs' });
    expect(elevenLabs.getAttribute('href')).toBe('https://elevenlabs.io');
    expect(elevenLabs.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Silicon Valley' }).getAttribute('href')).toContain(
      'hbo.com/silicon-valley'
    );
    expect(screen.getByRole('link', { name: 'Mermaid' }).getAttribute('href')).toContain(
      'mermaid.js.org'
    );
  });
});
