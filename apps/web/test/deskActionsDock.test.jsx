// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskActionsDock from '../src/components/DeskActionsDock.jsx';

function open(props = {}) {
  const handlers = {
    onGetCoffee: vi.fn(),
    onWalkTheFloor: vi.fn(),
    onCheckInbox: vi.fn(),
    onOpenSlopChat: vi.fn(),
    onCheckHrProgression: vi.fn(),
    onOpenOutbox: vi.fn(),
    onToggleEditor: vi.fn(),
    onInviteAgent: vi.fn(),
    onToggleThinking: vi.fn(),
    onSelectModelProfile: vi.fn(),
    canOpenOutbox: true,
    canToggleThinking: true,
    canToggleEditor: true,
    modelProfile: 'fast',
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
        onCheckInbox={vi.fn()}
        onOpenSlopChat={vi.fn()}
        onCheckHrProgression={vi.fn()}
        onOpenOutbox={vi.fn()}
        onToggleEditor={vi.fn()}
        onInviteAgent={vi.fn()}
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

  it('groups desk verbs by seat / get up / under the desk without Meet the Office', () => {
    open();
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items.join('\n')).not.toMatch(/Meet the Office/);
    expect(screen.getByText('Your seat')).toBeTruthy();
    expect(screen.getByText('Get up')).toBeTruthy();
    expect(screen.getByText('Under the desk')).toBeTruthy();
    expect(items[0]).toMatch(/Open your notebook/);
    expect(screen.getByRole('menuitem', { name: /Check your mail/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Talk to your team/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Call a meeting/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Ship from the Outbox/ })).toBeTruthy();
    for (const label of [
      'Open Slop Chat',
      'Walk the floor',
      'Get a coffee',
      'Open code drawer',
      'Onboard a contractor',
      'Check my HR progression'
    ]) {
      expect(screen.getByRole('menuitem', { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.queryByRole('menuitem', { name: /Message someone/ })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Adjust your workstation/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Rush job' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deep work' })).toBeTruthy();
  });

  it('runs code drawer and contractor verbs and closes the menu', () => {
    const handlers = open({ canToggleEditor: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Open code drawer/ }));
    expect(handlers.onToggleEditor).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Your desk/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Onboard a contractor/ }));
    expect(handlers.onInviteAgent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles Notebook from the desk menu', () => {
    cleanup();
    const handlers = open({ canToggleThinking: true });
    fireEvent.click(screen.getByRole('menuitem', { name: /Open your notebook/ }));
    expect(handlers.onToggleThinking).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('selects Deep work concentration without closing the menu', () => {
    const handlers = open({ modelProfile: 'fast' });
    fireEvent.click(screen.getByRole('button', { name: 'Deep work' }));
    expect(handlers.onSelectModelProfile).toHaveBeenCalledWith('quality');
    expect(screen.getByRole('menu')).toBeTruthy();
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
    open({ blockedReason: 'meeting' });
    const coffee = screen.getByRole('menuitem', { name: /Get a coffee/ });
    expect(coffee.disabled).toBe(true);
    expect(coffee.getAttribute('title')).toMatch(/in a meeting/i);
    expect(screen.getByRole('menuitem', { name: /Check your mail/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Onboard a contractor/ }).disabled).toBe(false);
    expect(screen.getByRole('menuitem', { name: /Check my HR progression/ }).disabled).toBe(false);
  });

  it('blocks Outbox, Notebook, and code drawer when there is nothing to open', () => {
    open({ canOpenOutbox: false, canToggleThinking: false, canToggleEditor: false });
    const outbox = screen.getByRole('menuitem', { name: /Ship from the Outbox/ });
    const thinking = screen.getByRole('menuitem', { name: /Open your notebook/ });
    const code = screen.getByRole('menuitem', { name: /Open code drawer/ });
    expect(outbox.disabled).toBe(true);
    expect(thinking.disabled).toBe(true);
    expect(code.disabled).toBe(true);
    expect(outbox.getAttribute('title')).toMatch(/Nothing to ship/i);
    expect(thinking.getAttribute('title')).toMatch(/empty/i);
    expect(code.getAttribute('title')).toMatch(/Generate something first/i);
  });
});
