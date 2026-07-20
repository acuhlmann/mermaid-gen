// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OfficeDirectory from '../src/components/OfficeDirectory.jsx';
import { UiLocaleProvider } from '../src/i18n/UiLocaleContext.jsx';
import {
  readOfficeDirectorySeen,
  OFFICE_DIRECTORY_STORAGE_KEY,
  OFFICE_USER_NAME_STORAGE_KEY
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

const COLLEAGUE_COUNT = Object.keys(OFFICE_COLLEAGUES).length;

const STARTERS = [
  {
    label: 'Coffee supply chain',
    prompt: 'Break down the global coffee supply chain',
    fromId: 'exec',
    ask: 'Needs it before the board offsite.'
  }
];

function renderDirectory(props = {}) {
  return render(
    <UiLocaleProvider>
      <OfficeDirectory {...props} />
    </UiLocaleProvider>
  );
}

function enableTranscript() {
  fireEvent.click(screen.getByTestId('intro-transcript-button'));
}

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
  it('opens the single-page onboarding tour on first run', async () => {
    renderDirectory({ isBoot: true, entryStarters: { starters: STARTERS } });
    expect(screen.getByTestId('office-directory-modal')).toBeTruthy();
    expect(screen.getByTestId('office-directory-tour')).toBeTruthy();
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByTestId('office-directory-start-tour')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Check in at reception/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Hear Linda/i })).toBeNull();
    expect(screen.getAllByTestId('office-directory-colleague-card').length).toBe(COLLEAGUE_COUNT);
    expect(screen.getByTestId('office-directory-desk')).toBeTruthy();
    expect(screen.getByTestId('topic-starters')).toBeTruthy();
    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
    await waitFor(() => expect(getOfficeDirectoryUi().open).toBe(true));
  });

  it('hides spoken copy until transcript is enabled', () => {
    renderDirectory();
    expect(screen.queryByText(/newest architect/i)).toBeNull();
    expect(screen.queryByText('Welcome aboard, Newbie.')).toBeNull();
    enableTranscript();
    expect(screen.getByText(/newest architect/i)).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    expect(screen.getByText('Architect')).toBeTruthy();
  });

  it('does not speak before Meet the team is clicked', () => {
    renderDirectory();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('starts colleague intros after Meet the team is clicked', async () => {
    renderDirectory({ showChip: false });
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(playMock.mock.calls[0][0]).toBe('intern');
    expect(screen.getByTestId('office-directory-autoplay')).toBeTruthy();
  });

  it('greets the user by the name on their badge when transcript is on', async () => {
    renderDirectory();
    enableTranscript();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    cleanup();
    playMock.mockClear();
    setUserName('Gavin');
    renderDirectory();
    enableTranscript();
    expect(screen.getByText('Welcome aboard, Gavin.')).toBeTruthy();
    expect(window.localStorage.getItem(OFFICE_USER_NAME_STORAGE_KEY)).toBe('Gavin');
  });

  it('does not duplicate colleague intro text in the transcript', () => {
    renderDirectory();
    enableTranscript();
    const lindaLine = OFFICE_COLLEAGUES.hr.introLine;
    expect(screen.getAllByText(lindaLine).length).toBe(1);
  });

  it('auto-introduces colleagues by voice, then clocks in', async () => {
    renderDirectory({ showChip: false });
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    await waitFor(() => expect(playMock).toHaveBeenCalled());

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Clock in/ })).toBeTruthy();
      },
      { timeout: 4000 }
    );

    fireEvent.click(screen.getByRole('button', { name: /Clock in/ }));
    expect(screen.queryByTestId('office-directory-chip')).toBeNull();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY)).toBe('1');
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('picks a starter during boot and dismisses the tour', () => {
    const onStarterPick = vi.fn();
    const onBootComplete = vi.fn();
    renderDirectory({
      isBoot: true,
      entryStarters: { starters: STARTERS, hint: 'Pick one:', ariaLabel: 'Assignments' },
      onStarterPick,
      onBootComplete,
      showChip: false
    });
    fireEvent.click(screen.getByRole('button', { name: /Coffee supply chain/i }));
    expect(onStarterPick).toHaveBeenCalledWith(STARTERS[0].prompt);
    expect(onBootComplete).toHaveBeenCalledTimes(1);
    expect(readOfficeDirectorySeen()).toBe(true);
  });

  it('skips the ceremony straight to the canvas and marks the tour seen', () => {
    const onSkipToBuild = vi.fn();
    const onBootComplete = vi.fn();
    renderDirectory({ onSkipToBuild, onBootComplete, showChip: false });
    fireEvent.click(screen.getByTestId('office-directory-skip-build'));
    expect(onSkipToBuild).toHaveBeenCalledTimes(1);
    expect(onBootComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('office-directory-chip')).toBeNull();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('reopens the full roster for returning users, with replay intro', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    renderDirectory();
    expect(screen.queryByText(/Meet the team/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Meet the Office/ }));
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    for (const name of ['Chad', 'Pam', 'Ticket Bot Dave', 'Gary', 'Linda', 'Ulrich', 'Sasha']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText('Facilities & Fridge Czar')).toBeTruthy();
    expect(screen.getAllByTestId('intro-voice-button').length).toBe(COLLEAGUE_COUNT);
    fireEvent.click(screen.getByRole('button', { name: /Replay intro/ }));
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByTestId('office-directory-start-tour')).toBeTruthy();
    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
  });

  it('opens from an external desk/UI signal even when the chip is hidden', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    renderDirectory({ showChip: false, placement: 'overlay' });
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
    act(() => {
      requestOfficeDirectoryOpen('roster');
    });
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    expect(getOfficeDirectoryUi().open).toBe(true);
  });
});
