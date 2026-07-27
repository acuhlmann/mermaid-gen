// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function open(props = {}) {
  const handlers = {
    onGetCoffee: vi.fn(),
    onStandUp: vi.fn(),
    onSitDown: vi.fn(),
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onCheckHrProgression: vi.fn(),
    onOpenOutbox: vi.fn(),
    onInviteAgent: vi.fn(),
    canOpenOutbox: true,
    onToggleCaptions: vi.fn(),
    onToggleNarration: vi.fn(),
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
        onGetCoffee={vi.fn()}
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
        onGetCoffee={vi.fn()}
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

  it('lists desk verbs in a flat menu with concentration and voice controls in the footer', () => {
    open({
      modelProfile: 'fast',
      onSelectModelProfile: vi.fn(),
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
    expect(screen.getByRole('menuitem', { name: /Ship from the Outbox/ })).toBeTruthy();
    for (const label of [
      'Open Slop Chat',
      'Get a coffee',
      'Onboard a contractor',
      'Check my HR progression'
    ]) {
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
    expect(screen.getByTestId('desk-language-pack')).toBeTruthy();
    expect(screen.getByText('Language pack')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: /language/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /English/i })).toBeTruthy();
    expect(screen.getByTestId('desk-voice-pack')).toBeTruthy();
    expect(screen.getByTestId('intro-transcript-button')).toBeTruthy();
    expect(screen.getByText('Narration')).toBeTruthy();
  });

  it('toggles captions and narration from the desk menu footer', () => {
    const handlers = open({ captions: false, narration: true });
    fireEvent.click(screen.getByTestId('intro-transcript-button'));
    expect(handlers.onToggleCaptions).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByLabelText('Narration'));
    expect(handlers.onToggleNarration).toHaveBeenCalledWith(false);
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

  it('runs the verb and closes the menu', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('menuitem', { name: /Get a coffee/ }));
    expect(handlers.onGetCoffee).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disables verbs with an in-fiction reason while blocked, but never inbox, contractor, or HR', () => {
    open({ blockedReason: 'meeting', ambientBlockedReason: 'meeting' });
    const coffee = screen.getByRole('menuitem', { name: /Get a coffee/ });
    expect(coffee.disabled).toBe(true);
    expect(coffee.getAttribute('title')).toMatch(/in a meeting/i);
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Onboard a contractor/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Check my HR progression/ }).disabled).toBe(false);
  });

  it('keeps coffee available while a deliverable streams', () => {
    open({ blockedReason: 'busy', ambientBlockedReason: null });
    expect(screen.getByRole('menuitem', { name: /Get a coffee/ }).disabled).toBe(false);
  });

  it('blocks Outbox when there is nothing to ship', () => {
    open({ canOpenOutbox: false });
    const outbox = screen.getByRole('menuitem', { name: /Ship from the Outbox/ });
    expect(outbox.disabled).toBe(true);
    expect(outbox.getAttribute('title')).toMatch(/Nothing to ship/i);
  });
});
