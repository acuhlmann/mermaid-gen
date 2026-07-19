// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeDirectory from '../src/components/OfficeDirectory.jsx';
import {
  readOfficeDirectorySeen,
  OFFICE_DIRECTORY_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES } from '../src/utils/officeCast.js';
import { _resetUserIdentityForTests, setUserName } from '../src/state/userIdentityStore.js';
import {
  _resetOfficeDirectoryUiForTests,
  requestOfficeDirectoryOpen
} from '../src/state/officeDirectoryUiStore.js';

// Derived from the live roster so this test doesn't need a manual update every
// time a colleague is added or removed (see docs/office-parody.md roster).
const COLLEAGUE_COUNT = Object.keys(OFFICE_COLLEAGUES).length;

beforeEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
  _resetOfficeDirectoryUiForTests();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  _resetUserIdentityForTests();
  _resetOfficeDirectoryUiForTests();
});

describe('OfficeDirectory', () => {
  it('opens a cinematic game-intro title card on first run', () => {
    render(<OfficeDirectory />);
    expect(screen.getByTestId('office-directory-tour')).toBeTruthy();
    expect(screen.getByTestId('office-directory-title')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Press Start/i })).toBeTruthy();
    expect(screen.getByText(/Meet the Office/i)).toBeTruthy();
    expect(screen.queryByTestId('office-directory-welcome')).toBeNull();
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
  });

  it('moves from Press Start into the name-badge welcome beat', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByText(/newest architect/i)).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
  });

  it('greets the user by the name on their badge (default when blank)', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    cleanup();
    setUserName('Gavin');
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByText('Welcome aboard, Gavin.')).toBeTruthy();
  });

  it('offers a click-only voice control on the welcome step (never autoplays)', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    const hear = screen.getByRole('button', { name: /Hear Linda/i });
    expect(hear.getAttribute('aria-pressed')).toBe('false');
  });

  it('introduces colleagues one at a time, then clocks in', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    fireEvent.click(screen.getByRole('button', { name: 'Meet the Office →' }));
    expect(screen.getByTestId('office-directory-spotlight')).toBeTruthy();
    expect(screen.getByText('Chad')).toBeTruthy();
    expect(screen.getByText(`1 of ${COLLEAGUE_COUNT}`)).toBeTruthy();
    expect(screen.getByText(/CHARACTER UNLOCKED/i)).toBeTruthy();
    expect(screen.queryByText('Pam')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Next colleague/ }));
    expect(screen.getByText('Pam')).toBeTruthy();
    expect(screen.getByText(`2 of ${COLLEAGUE_COUNT}`)).toBeTruthy();

    // Title → welcome → Chad → Pam already done; click through the rest.
    for (let i = 0; i < COLLEAGUE_COUNT; i += 1) {
      const next = screen.queryByRole('button', { name: /Next colleague/ });
      if (next) fireEvent.click(next);
    }
    fireEvent.click(screen.getByRole('button', { name: /Clock in/ }));
    expect(screen.queryByText('Facilities & Fridge Czar')).toBeNull();
    expect(screen.getByTestId('office-directory-chip')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Meet the Office/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY)).toBe('1');
  });

  it('skips the ceremony straight to the canvas and marks the tour seen', () => {
    const onSkipToBuild = vi.fn();
    render(<OfficeDirectory onSkipToBuild={onSkipToBuild} />);
    fireEvent.click(screen.getByTestId('office-directory-skip-build'));
    expect(onSkipToBuild).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Meet the Office/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
  });

  it('reopens the full roster for returning users, with replay intro', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    render(<OfficeDirectory />);
    expect(screen.queryByText(/Day one at ArchiSlop/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Meet the Office/ }));
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    for (const name of ['Chad', 'Pam', 'Ticket Bot Dave', 'Gary', 'Linda', 'Ulrich', 'Sasha']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText('Facilities & Fridge Czar')).toBeTruthy();
    expect(screen.getAllByTestId('intro-voice-button').length).toBe(COLLEAGUE_COUNT);
    fireEvent.click(screen.getByRole('button', { name: /Replay intro/ }));
    expect(screen.getByTestId('office-directory-title')).toBeTruthy();
  });

  it('opens from an external desk/UI signal even when the chip is hidden', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    render(<OfficeDirectory showChip={false} placement="overlay" />);
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
    act(() => {
      requestOfficeDirectoryOpen('roster');
    });
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
  });
});
