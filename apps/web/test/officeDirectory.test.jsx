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
import { DAY_ONE_INTRO_IDS, officeSenderInfo } from '../src/utils/officeCast.js';
import { DAY_ONE_WALK_IDS } from '../src/utils/officeFloorIntro.js';
import { _resetUserIdentityForTests, setUserName } from '../src/state/userIdentityStore.js';
import {
  _resetOfficeDirectoryUiForTests,
  getOfficeDirectoryUi,
  requestOfficeDirectoryOpen
} from '../src/state/officeDirectoryUiStore.js';
import { setOfficeCaptions } from '../src/state/officeMomentStore.js';

const playMock = vi.fn(() => Promise.resolve({ spoken: true, source: 'cloud' }));
const stopMock = vi.fn();

vi.mock('../src/hooks/useIntroNarrator.js', () => ({
  useIntroNarrator: () => ({
    speakingId: null,
    play: playMock,
    stop: stopMock
  })
}));

const TOUR_COUNT = DAY_ONE_WALK_IDS.length;
const ROSTER_COUNT = DAY_ONE_INTRO_IDS.length;

function renderDirectory(props = {}) {
  return render(
    <UiLocaleProvider>
      <OfficeDirectory {...props} />
    </UiLocaleProvider>
  );
}

function enableTranscript() {
  // Prefer the store over a toggle click — captions are shared app-wide, so a
  // click would flip whatever a sibling suite left behind.
  act(() => setOfficeCaptions(true));
}

beforeEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
  _resetOfficeDirectoryUiForTests();
  setOfficeCaptions(false);
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
    expect(screen.queryByRole('button', { name: /Begin Day One/i })).toBeNull();
    expect(screen.getAllByTestId('office-directory-colleague-card').length).toBe(TOUR_COUNT);
    expect(screen.queryByTestId('entry-desk-pointers')).toBeNull();
    expect(screen.queryByTestId('intro-voice-button')).toBeNull();
    await waitFor(() => expect(getOfficeDirectoryUi().open).toBe(true));
  });

  // Reception is the only screen shown before anyone commits to a language, so
  // the picker belongs in the welcome body — not behind a pill in the header a
  // non-English reader has no reason to open.
  it('offers every language up front on the welcome step', () => {
    renderDirectory({ isBoot: true });
    const strip = screen.getByTestId('intro-locale-toggle');
    expect(strip.closest('.office-directory-onboarding-intro')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Simplified Chinese' }).textContent).toContain(
      '简体中文'
    );
    expect(screen.getByRole('radio', { name: 'Traditional Chinese' }).textContent).toContain(
      '繁體中文'
    );
    expect(screen.getByRole('radio', { name: 'Aussie Slang' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'English' }).getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('hides spoken copy until transcript is enabled', () => {
    renderDirectory();
    expect(screen.queryByText(/newest architect/i)).toBeNull();
    enableTranscript();
    expect(screen.getByText(/Linda will speed-run the cast/i)).toBeTruthy();
    expect(screen.getByText('Welcome aboard, Newbie.')).toBeTruthy();
    expect(screen.getByTestId('office-directory-hr-transcript')).toBeTruthy();
  });

  it('does not speak before Meet the team is clicked', () => {
    renderDirectory();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('auto-plays Linda welcome then closing after Meet the team', async () => {
    renderDirectory({ showChip: false });
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(playMock.mock.calls[0][0]).toBe('welcome');
    await waitFor(() => expect(playMock.mock.calls.some((c) => c[0] === 'closing')).toBe(true));
    expect(playMock.mock.calls.some((c) => c[0] === 'dinesh')).toBe(false);
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

  it('does not autoplay colleague intro text during the ceremony', () => {
    renderDirectory();
    enableTranscript();
    // Idle pre-tour: cards may show intro lines for reading, but the ceremony
    // itself only voices Linda welcome/closing.
    const dineshLine = officeSenderInfo('dinesh').introLine;
    expect(screen.getAllByText(dineshLine).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(officeSenderInfo('hr').introLine)).toBeNull();
  });

  it('hands off to the desk tour after Linda welcome + closing', async () => {
    const onBootComplete = vi.fn();
    playMock.mockImplementation(() => Promise.resolve({ spoken: true, source: 'cloud' }));
    renderDirectory({ showChip: false, onBootComplete, isBoot: true });
    fireEvent.click(screen.getByRole('button', { name: 'Meet the team →' }));
    await waitFor(() => expect(playMock).toHaveBeenCalled());

    await waitFor(
      () => {
        expect(onBootComplete).toHaveBeenCalledWith({ startDeskTour: true });
      },
      { timeout: 5_000 }
    );
    expect(screen.queryByTestId('office-directory-tour')).toBeNull();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
    const spokenIds = playMock.mock.calls.map((c) => c[0]);
    expect(spokenIds).toContain('welcome');
    expect(spokenIds).toContain('closing');
    expect(spokenIds).not.toContain('dinesh');
  });

  it('skips the ceremony straight to the canvas and marks the tour seen', () => {
    const onSkipToBuild = vi.fn();
    const onBootComplete = vi.fn();
    renderDirectory({ onSkipToBuild, onBootComplete, showChip: false });
    fireEvent.click(screen.getByTestId('office-directory-skip-build'));
    expect(onSkipToBuild).toHaveBeenCalledTimes(1);
    expect(onBootComplete).toHaveBeenCalledWith({ skipDeskTour: true });
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(getOfficeDirectoryUi().open).toBe(false);
  });

  it('reopens the full roster for returning users, with replay intro', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    renderDirectory();
    fireEvent.click(screen.getByRole('button', { name: /Meet the Team/ }));
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    expect(screen.getAllByTestId('intro-voice-button').length).toBe(ROSTER_COUNT);
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
