// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloorArrival from '../src/components/officeFloor/FloorArrival.jsx';
import { UiLocaleProvider } from '../src/i18n/UiLocaleContext.jsx';
import { readOfficeDirectorySeen } from '../src/utils/officeAmbienceStorage.js';
import { setOfficeCaptions } from '../src/state/officeMomentStore.js';

const playMock = vi.fn(() => Promise.resolve({ spoken: false }));

// The narrator hits Cloud TTS; the ceremony's pacing is what we're testing.
vi.mock('../src/hooks/useIntroNarrator.js', () => ({
  useIntroNarrator: () => ({
    speakingId: null,
    play: (...args) => playMock(...args),
    stop: () => {}
  })
}));

function renderArrival(props = {}) {
  return render(
    <UiLocaleProvider>
      <FloorArrival {...props} />
    </UiLocaleProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  playMock.mockReset();
  playMock.mockImplementation(() => Promise.resolve({ spoken: false }));
  setOfficeCaptions(false);
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setOfficeCaptions(false);
  vi.useRealTimers();
});

describe('FloorArrival (isometric first run)', () => {
  it('opens at reception with the name badge, not at your desk', () => {
    renderArrival();

    expect(screen.getByTestId('office-floor-arrival')).toBeTruthy();
    expect(screen.getByText(/RECEPTION/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Check in/i })).toBeTruthy();
    expect(screen.getByTestId('name-tag')).toBeTruthy();
    // Spatial narration for whoever is not looking at the floor (slice 10 parity).
    expect(screen.getByTestId('office-floor-narration').textContent).toMatch(/At reception/);
    // You are standing at reception, so your desk is empty.
    expect(screen.getByTestId('office-floor-arrival-player')).toBeTruthy();
    const yourSeat = document.querySelector('[data-seat="you"]');
    expect(yourSeat?.dataset.vacant).toBe('true');
  });

  // Reception is the one screen where language and name must be chosen before
  // Linda starts talking — an auto-advance would skip both and also burn TTS
  // on cold mount (docs/office-parody.md § Language at reception).
  it('stays at reception until Check in is clicked', () => {
    vi.useFakeTimers();
    renderArrival();
    expect(screen.getByTestId('name-tag')).toBeTruthy();
    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole('button', { name: /Check in/i })).toBeTruthy();
    expect(screen.getByTestId('name-tag')).toBeTruthy();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('offers every language up front on the reception card', () => {
    renderArrival();
    const strip = screen.getByTestId('intro-locale-toggle');
    expect(strip.closest('.office-floor-card--reception')).toBeTruthy();
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

  // officeChromeCopy() is a module singleton — if UiLocaleContext only syncs it
  // in an effect, the reception card re-renders with the new locale from context
  // but the NameTag / Check in labels still read the previous English bundle.
  it('rewrites the name badge and reception labels when the language changes', () => {
    renderArrival();
    expect(screen.getByTestId('name-tag').textContent).toMatch(/HELLO/);
    expect(screen.getByTestId('name-tag').textContent).toMatch(/my name is/);
    expect(screen.getByRole('button', { name: /Check in/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Simplified Chinese' }));

    expect(screen.getByTestId('name-tag').textContent).toMatch(/你好/);
    expect(screen.getByTestId('name-tag').textContent).toMatch(/我叫/);
    expect(screen.getByRole('button', { name: /签到/ })).toBeTruthy();
    expect(screen.getByTestId('office-floor-narration').textContent).toMatch(/在前台/);

    fireEvent.click(screen.getByRole('radio', { name: '英语' }));

    expect(screen.getByTestId('name-tag').textContent).toMatch(/HELLO/);
    expect(screen.getByRole('button', { name: /Check in/i })).toBeTruthy();
    expect(screen.getByTestId('office-floor-narration').textContent).toMatch(/At reception/);
  });

  it('offers a CC toggle so voice-only users can hide balloons', () => {
    renderArrival();
    expect(screen.getByTestId('intro-transcript-button')).toBeTruthy();
  });

  it('does not speak before the check-in gesture', () => {
    renderArrival();
    // Nobody is introducing themselves until you check in — the gesture is
    // what unlocks speech, so a crawler can never burn the TTS budget.
    expect(document.querySelector('.office-floor-person.is-speaking')).toBeNull();
  });

  it('walks you onto the floor after check-in and starts with Linda', async () => {
    renderArrival();
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    expect(screen.getByTestId('office-floor-arrival').className).toMatch(/is-arrival-focused/);
    await waitFor(() => {
      expect(document.querySelector('.office-floor-person.is-speaking')).toBeTruthy();
    });
    expect(screen.getByTestId('office-floor-narration').textContent).toMatch(/Linda/);
    // Silent TTS falls back to the bubble so the line is never lost.
    expect(screen.getByText(/I'm Linda, People Ops/)).toBeTruthy();
  });

  it('hides spoken balloons when voice works and captions stay off', async () => {
    playMock.mockImplementation(() => Promise.resolve({ spoken: true }));
    renderArrival();
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    await waitFor(() => {
      expect(document.querySelector('.office-floor-person.is-speaking')).toBeTruthy();
    });
    expect(screen.queryByText(/I'm Linda, People Ops/)).toBeNull();
  });

  it('shows balloons when captions are turned on even while voice plays', async () => {
    playMock.mockImplementation(() => Promise.resolve({ spoken: true }));
    setOfficeCaptions(true);
    renderArrival();
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    await waitFor(() => {
      expect(screen.getByText(/I'm Linda, People Ops/)).toBeTruthy();
    });
  });

  it('treats the cast as scenery during the ceremony', () => {
    renderArrival();
    const chad = screen.getByRole('button', { name: /Chad/ });
    expect(chad.disabled).toBe(true);
  });

  it('skipping marks orientation seen and hands back to the canvas', () => {
    const onComplete = vi.fn();
    const onSkipToBuild = vi.fn();
    renderArrival({ onComplete, onSkipToBuild });

    fireEvent.click(screen.getByRole('button', { name: /Skip the ceremony/i }));

    expect(onComplete).toHaveBeenCalledWith({ skipDeskTour: true });
    expect(onSkipToBuild).toHaveBeenCalled();
    expect(readOfficeDirectorySeen()).toBe(true);
  });

  it('early clock-in walks you to your desk and starts the desk tour', async () => {
    const onComplete = vi.fn();
    renderArrival({ onComplete });
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    fireEvent.click(await screen.findByRole('button', { name: /take my desk/i }));

    // Without an animation engine the walk resolves immediately (also the
    // reduced-motion path), so boot completes and the desk tour follows.
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ startDeskTour: true });
    });
    expect(readOfficeDirectorySeen()).toBe(true);
  });
});
