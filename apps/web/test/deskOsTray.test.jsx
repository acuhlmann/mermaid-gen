// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeskOsTray from '../src/components/DeskOsTray.jsx';
import {
  getFocusedOverlayId,
  registerOverlay,
  resetOverlayStackForTests
} from '../src/state/overlayStack.js';

beforeEach(() => {
  resetOverlayStackForTests();
});

afterEach(() => {
  cleanup();
  resetOverlayStackForTests();
});

describe('DeskOsTray', () => {
  it('lists office windows registered in the officeModal band', () => {
    // Regression guard: the tray shipped filtering `group === 'officeChrome'`,
    // but every real office window registers as `officeModal` — so the strip
    // could never list anything. See docs/office-isometric-mode.md §4.
    registerOverlay('office-inbox', 'officeModal', {
      title: 'Inbox',
      kind: 'inbox',
      manageable: true
    });

    render(<DeskOsTray />);

    expect(screen.getByRole('button', { name: /Inbox/ })).toBeTruthy();
  });

  it('lists windows from the officeChrome band too', () => {
    registerOverlay('office-panel', 'officeChrome', {
      title: 'Slop Chat',
      kind: 'messenger',
      manageable: true
    });

    render(<DeskOsTray />);

    expect(screen.getByRole('button', { name: /Slop Chat/ })).toBeTruthy();
  });

  it('leaves app modals and unmanageable or untitled surfaces out', () => {
    // A taskbar lists what you can switch back to. App modals are dismissed,
    // not left open, so `modal` stays out even when it is manageable — the
    // Thinking pane registers exactly that way.
    registerOverlay('thinking-pane', 'modal', {
      title: 'Notebook',
      kind: 'insights',
      manageable: true
    });
    registerOverlay('office-untitled', 'officeModal', { kind: 'inbox', manageable: true });
    registerOverlay('office-unmanaged', 'officeModal', {
      title: 'Walk-by',
      kind: 'walkby',
      manageable: false
    });

    render(<DeskOsTray />);

    expect(screen.queryByTestId('desk-os-tray')).toBeNull();
  });

  it('brings a window to the front when its tray item is clicked', () => {
    registerOverlay('office-inbox', 'officeModal', {
      title: 'Inbox',
      kind: 'inbox',
      manageable: true
    });
    registerOverlay('office-messenger', 'officeModal', {
      title: 'Slop Chat',
      kind: 'messenger',
      manageable: true
    });
    expect(getFocusedOverlayId()).toBe('office-messenger');

    render(<DeskOsTray />);
    fireEvent.click(screen.getByRole('button', { name: /Inbox/ }));

    expect(getFocusedOverlayId()).toBe('office-inbox');
    expect(screen.getByRole('button', { name: /Inbox/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('lists windows without an Archislop OS wordmark or Tidy up verb', () => {
    registerOverlay('office-inbox', 'officeModal', {
      title: 'Inbox',
      kind: 'inbox',
      manageable: true
    });

    render(<DeskOsTray />);

    expect(screen.getByRole('button', { name: /Inbox/ })).toBeTruthy();
    expect(screen.queryByText(/ArchiSlop OS/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Tidy up/i })).toBeNull();
  });

  it('renders nothing when closed', () => {
    registerOverlay('office-inbox', 'officeModal', {
      title: 'Inbox',
      kind: 'inbox',
      manageable: true
    });

    render(<DeskOsTray open={false} />);

    expect(screen.queryByTestId('desk-os-tray')).toBeNull();
  });
});
