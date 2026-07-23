// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeWindowBar from '../src/components/OfficeWindowBar.jsx';
import {
  getFocusedOverlayId,
  registerOverlay,
  resetOverlayStackForTests
} from '../src/state/overlayStack.js';
import {
  getResetVersion,
  resetFloatingWindowControlForTests
} from '../src/state/floatingWindowControl.js';

beforeEach(() => {
  resetOverlayStackForTests();
  resetFloatingWindowControlForTests();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('OfficeWindowBar', () => {
  it('renders nothing when no manageable window is open', () => {
    const { container } = render(<OfficeWindowBar />);
    expect(container.querySelector('.office-window-bar')).toBeNull();
  });

  it('lists managed windows with their kind label and who they are from', () => {
    registerOverlay('office-inbox', 'officeModal', { kind: 'inbox', manageable: true });
    registerOverlay('office-walkby', 'officeChrome', {
      kind: 'walkby',
      senderId: 'facilities',
      manageable: true
    });
    render(<OfficeWindowBar />);

    expect(screen.getByText('Inbox')).toBeTruthy();
    // Walk-by chip shows the colleague's actual name, not a bare "Walk-by".
    expect(screen.getByText('Gary')).toBeTruthy();
  });

  it('excludes non-manageable toasts (coffee/battle invites)', () => {
    registerOverlay('office-coffee-invite', 'officeChrome', { kind: 'coffee', manageable: false });
    const { container } = render(<OfficeWindowBar />);
    expect(container.querySelector('.office-window-bar')).toBeNull();
  });

  it('brings a window to the front when its chip is clicked', () => {
    registerOverlay('office-inbox', 'officeModal', { kind: 'inbox', manageable: true });
    registerOverlay('office-messenger', 'officeModal', { kind: 'messenger', manageable: true });
    render(<OfficeWindowBar />);

    fireEvent.click(screen.getByText('Inbox'));
    expect(getFocusedOverlayId()).toBe('office-inbox');
  });

  it('recall resets the window position and focuses it', () => {
    registerOverlay('office-inbox', 'officeModal', { kind: 'inbox', manageable: true });
    render(<OfficeWindowBar />);

    const before = getResetVersion('office-inbox');
    fireEvent.click(screen.getByRole('button', { name: /Snap Inbox back/i }));

    expect(getResetVersion('office-inbox')).toBe(before + 1);
    expect(getFocusedOverlayId()).toBe('office-inbox');
  });

  it('offers Tidy up only when more than one window is open', () => {
    registerOverlay('office-inbox', 'officeModal', { kind: 'inbox', manageable: true });
    const single = render(<OfficeWindowBar />);
    expect(single.queryByText(/Tidy up/)).toBeNull();
    cleanup();

    registerOverlay('office-messenger', 'officeModal', { kind: 'messenger', manageable: true });
    render(<OfficeWindowBar />);
    expect(screen.getByText(/Tidy up/)).toBeTruthy();
  });
});
