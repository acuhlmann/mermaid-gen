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
  it('opens HR welcome with name badge on first run', async () => {
    renderDirectory({ isBoot: true });
    expect(screen.getByTestId('office-directory-modal')).toBeTruthy();
    expect(screen.getByTestId('office-directory-tour')).toBeTruthy();
    expect(screen.getByTestId('name-tag')).toBeTruthy();
    expect(document.querySelector('.office-directory-chapter')?.textContent).toMatch(/PEOPLE OPS/i);
    expect(screen.getByTestId('office-directory-start-tour')).toBeTruthy();
    expect(screen.getAllByTestId('office-directory-colleague-card').length).toBe(COLLEAGUE_COUNT);
    expect(screen.queryByTestId('office-directory-desk')).toBeNull();
    expect(screen.queryByTestId('intro-voice-button')).toBeNull();
    await waitFor(() => expect(getOfficeDirectoryUi().open).toBe(true));
  });

  it('hides spoken copy until transcript is enabled', () => {
    renderDirectory();
    expect(screen.queryByText(/newest architect/i)).toBeNull();
    enableTranscript();
    expect(screen.getByText(/newest architect/i)).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    expect(screen.getByTestId('office-directory-hr-transcript')).toBeTruthy();
  });

  it('does not speak before Meet the team is clicked', () => {
    renderDirectory();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('auto-plays Linda then colleagues after Meet the team', async () => {
    renderDirectory({ showChip: false });
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(playMock.mock.calls[0][0]).toBe('welcome');
    await waitFor(() => expect(playMock.mock.calls.some((c) => c[0] === 'intern')).toBe(true));
    expect(screen.getByTestId('office-directory-autoplay')).toBeTruthy();
    expect(screen.queryByTestId('intro-voice-button')).toBeNull();
  });

  it('greets the user by the name on their badge when transcript is on', () => {
    renderDirectory();
    enableTranscript();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    cleanup();
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
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('skips the ceremony straight to the canvas and marks the tour seen', () => {
    const onSkipToBuild = vi.fn();
    const onBootComplete = vi.fn();
    renderDirectory({ onSkipToBuild, onBootComplete, showChip: false });
    fireEvent.click(screen.getByTestId('office-directory-skip-build'));
    expect(onSkipToBuild).toHaveBeenCalledTimes(1);
    expect(onBootComplete).toHaveBeenCalledTimes(1);
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('reopens the full roster for returning users, with replay intro', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Meet the Office/ }));
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    expect(screen.getAllByTestId('intro-voice-button').length).toBe(COLLEAGUE_COUNT);
    fireEvent.click(screen.getByRole('button', { name: /Replay intro/ }));
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByTestId('office-directory-start-tour')).toBeTruthy();
  });

  it('opens from an external desk/UI signal even when the chip is hidden', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    renderDirectory({ showChip: false, placement: 'overlay' });
    act(() => {
      requestOfficeDirectoryOpen('roster');
    });
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    expect(getOfficeDirectoryUi().open).toBe(true);
  });
});
