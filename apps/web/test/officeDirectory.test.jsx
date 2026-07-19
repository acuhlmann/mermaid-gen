// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfficeDirectory from '../src/components/OfficeDirectory.jsx';
import {
  readOfficeDirectorySeen,
  OFFICE_DIRECTORY_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES } from '../src/utils/officeCast.js';
import { _resetUserIdentityForTests, setUserName } from '../src/state/userIdentityStore.js';
import {
  _resetOfficeDirectoryUiForTests,
  getOfficeDirectoryUi,
  requestOfficeDirectoryOpen
} from '../src/state/officeDirectoryUiStore.js';

const playMock = vi.fn(() => Promise.resolve({ spoken: true, source: 'cloud' }));
const stopMock = vi.fn();

vi.mock('../src/hooks/useIntroNarrator.js', () => ({
  useIntroNarrator: () => ({
    speakingId: null,
    play: playMock,
    stop: stopMock
  })
}));

// Derived from the live roster so this test doesn't need a manual update every
// time a colleague is added or removed (see docs/office-parody.md roster).
const COLLEAGUE_COUNT = Object.keys(OFFICE_COLLEAGUES).length;

beforeEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
  _resetOfficeDirectoryUiForTests();
  playMock.mockClear();
  stopMock.mockClear();
  playMock.mockImplementation(() => Promise.resolve({ spoken: true, source: 'cloud' }));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  _resetUserIdentityForTests();
  _resetOfficeDirectoryUiForTests();
});

describe('OfficeDirectory', () => {
  it('opens a cinematic game-intro title card on first run as a modal', async () => {
    render(<OfficeDirectory />);
    expect(screen.getByTestId('office-directory-modal')).toBeTruthy();
    expect(screen.getByTestId('office-directory-tour')).toBeTruthy();
    expect(screen.getByTestId('office-directory-title')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Press Start/i })).toBeTruthy();
    expect(screen.getByText(/Meet the Office/i)).toBeTruthy();
    expect(screen.queryByTestId('office-directory-welcome')).toBeNull();
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
    await waitFor(() => expect(getOfficeDirectoryUi().open).toBe(true));
  });

  it('does not speak on the title card before Press Start', () => {
    render(<OfficeDirectory />);
    expect(playMock).not.toHaveBeenCalled();
  });

  it('moves from Press Start into the name-badge welcome beat and auto-plays Linda', async () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByText(/newest architect/i)).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(playMock.mock.calls[0][0]).toBe('welcome');
  });

  it('greets the user by the name on their badge (default when blank)', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    cleanup();
    playMock.mockClear();
    setUserName('Gavin');
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    expect(screen.getByText('Welcome aboard, Gavin.')).toBeTruthy();
  });

  it('auto-introduces colleagues by voice after Meet the team, then clocks in', async () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByTestId('office-directory-press-start'));
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    expect(screen.getByTestId('office-directory-spotlight')).toBeTruthy();
    expect(screen.getByText('Chad')).toBeTruthy();
    expect(screen.getByText(`1 of ${COLLEAGUE_COUNT}`)).toBeTruthy();
    expect(screen.getByText(/CHARACTER UNLOCKED/i)).toBeTruthy();

    await waitFor(() => {
      expect(playMock.mock.calls.some((c) => c[0] === 'intern')).toBe(true);
    });

    // Cinematic auto-advance walks the full cast without per-card ▶ clicks.
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Clock in/ })).toBeTruthy();
      },
      { timeout: 4000 }
    );

    fireEvent.click(screen.getByRole('button', { name: /Clock in/ }));
    expect(screen.queryByText('Facilities & Fridge Czar')).toBeNull();
    expect(screen.getByTestId('office-directory-chip')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Meet the Office/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY)).toBe('1');
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('skips the ceremony straight to the canvas and marks the tour seen', () => {
    const onSkipToBuild = vi.fn();
    render(<OfficeDirectory onSkipToBuild={onSkipToBuild} />);
    fireEvent.click(screen.getByTestId('office-directory-skip-build'));
    expect(onSkipToBuild).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Meet the Office/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
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
    expect(getOfficeDirectoryUi().open).toBe(true);
  });
});
