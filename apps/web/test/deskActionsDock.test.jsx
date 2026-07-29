// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function open(props = {}) {
  const handlers = {
    onStandUp: vi.fn(),
    onSitDown: vi.fn(),
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onCheckHrProgression: vi.fn(),
    onOpenOutbox: vi.fn(),
    onInviteAgent: vi.fn(),
    canOpenOutbox: true,
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
    render(
      <DeskActionsDock
        initialOpen
        onStandUp={vi.fn()}
        onCheckInbox={vi.fn()}
        onOpenSlopChat={vi.fn()}
        onCheckHrProgression={vi.fn()}
        onOpenOutbox={vi.fn()}
        onInviteAgent={vi.fn()}
      />
    );
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByText('Get up')).toBeNull();
  });

  it('shows the ArchiSlop mark on the desk stamp', () => {
    render(
      <DeskActionsDock
        onStandUp={vi.fn()}
        onCheckInbox={vi.fn()}
        onOpenSlopChat={vi.fn()}
        onCheckHrProgression={vi.fn()}
        onOpenOutbox={vi.fn()}
        onInviteAgent={vi.fn()}
      />
    );
    const trigger = screen.getByTestId('bottom-brand-mark');
    expect(trigger.querySelector('.brand-helmet-svg')).toBeTruthy();
  });

  it('exposes Stand up as a primary bottom-nav control, not a menu item', () => {
    const handlers = open({ placement: 'bottom' });
    const standUp = screen.getByTestId('desk-standup-button');
    expect(standUp).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Stand up and look around/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Walk the floor/ })).toBeNull();
    fireEvent.click(standUp);
    expect(handlers.onStandUp).toHaveBeenCalledTimes(1);
  });

  it('toggles sit-down on the primary control while standing', () => {
    const handlers = open({ placement: 'bottom', standing: true });
    fireEvent.click(screen.getByTestId('desk-standup-button'));
    expect(handlers.onSitDown).toHaveBeenCalledTimes(1);
    expect(handlers.onStandUp).not.toHaveBeenCalled();
  });

  it('shows an unread badge on the desk button and inbox verb', () => {
    open({ unreadCount: 3 });
    expect(screen.getByRole('button', { name: /Your desk/i }).textContent).toContain('3');
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).textContent).toContain('3');
  });

  it('lists desk verbs with concentration above compact ambience toggles', () => {
    open({
      modelProfile: 'fast',
      onSelectModelProfile: vi.fn(),
      focusTime: false,
      soundscape: true,
      captions: false,
      narration: true
    });
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items.join('\n')).not.toMatch(/Meet the Office/);
    expect(screen.queryByText('Get up')).toBeNull();
    expect(screen.queryByText('Under the desk')).toBeNull();
    expect(items[0]).toMatch(/Check your mail/);
    expect(screen.queryByRole('menuitem', { name: /Open your notebook/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Talk to your team/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Call a meeting/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Get a coffee/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Ship from the Outbox/ })).toBeTruthy();
    for (const label of ['Open Slop Chat', 'Onboard a contractor', 'Check my HR progression']) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.queryByRole('menuitem', { name: /Walk the floor/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Stand up/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Open code drawer/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Message someone/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Adjust your workstation/ })).toBeNull();
    const concentration = screen.getByTestId('concentration-control');
    expect(concentration.className).toContain('concentration-control--menu');
    expect(screen.getByText('Concentration')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rush job' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deep work' })).toBeTruthy();
    const ambience = screen.getByTestId('desk-ambience-pack');
    expect(ambience.compareDocumentPosition(concentration) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
      Node.DOCUMENT_POSITION_PRECEDING
    );
    // Two postures replaced the old four checkboxes (Focus / Noise / Voice / CC):
    // Headphones is how the office reaches you, Focus is whether it does.
    expect(screen.getByTestId('desk-ambience-headphones').textContent).toContain('Headphones');
    expect(screen.getByTestId('desk-ambience-focus').textContent).toContain('Focus');
    expect(ambience.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(ambience.textContent).not.toContain('Noise');
    expect(ambience.textContent).not.toContain('Voice');
    expect(ambience.textContent).not.toContain('CC');
    expect(screen.getByTestId('desk-language-pack')).toBeTruthy();
    expect(screen.getByText('Language pack')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: /language/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /English/i })).toBeTruthy();
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

  it('runs contractor verb and closes the menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Onboard a contractor/ }));
    expect(handlers.onInviteAgent).toHaveBeenCalledTimes(1);
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

  it('never disables inbox, contractor, or HR while blocked', () => {
    open({ blockedReason: 'meeting' });
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Onboard a contractor/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Check my HR progression/ }).disabled).toBe(false);
  });

  it('blocks Outbox when there is nothing to ship', () => {
    open({ canOpenOutbox: false });
    const outbox = screen.getByRole('menuitem', { name: /Ship from the Outbox/ });
    expect(outbox.disabled).toBe(true);
    expect(outbox.getAttribute('title')).toMatch(/Nothing to ship/i);
  });
});
