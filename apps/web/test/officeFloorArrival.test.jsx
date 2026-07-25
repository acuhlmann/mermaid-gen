// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloorArrival from '../src/components/officeFloor/FloorArrival.jsx';
import { readOfficeDirectorySeen } from '../src/utils/officeAmbienceStorage.js';

// The narrator hits Cloud TTS; the ceremony's pacing is what we're testing.
vi.mock('../src/hooks/useIntroNarrator.js', () => ({
  useIntroNarrator: () => ({
    speakingId: null,
    play: () => Promise.resolve({ spoken: false }),
    stop: () => {}
  })
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('FloorArrival (isometric first run)', () => {
  it('opens at reception with the name badge, not at your desk', () => {
    render(<FloorArrival />);

    expect(screen.getByTestId('office-floor-arrival')).toBeTruthy();
    expect(screen.getByText(/RECEPTION/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Check in/i })).toBeTruthy();
    // You are standing at reception, so your desk is empty.
    expect(screen.getByTestId('office-floor-arrival-player')).toBeTruthy();
    const yourSeat = document.querySelector('[data-seat="you"]');
    expect(yourSeat?.dataset.vacant).toBe('true');
  });

  it('does not speak before the check-in gesture', () => {
    render(<FloorArrival />);
    // Nobody is introducing themselves until you check in — the gesture is
    // what unlocks speech, so a crawler can never burn the TTS budget.
    expect(document.querySelector('.office-floor-person.is-speaking')).toBeNull();
  });

  it('introduces the floor after check-in, starting with Linda', async () => {
    render(<FloorArrival />);
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    await waitFor(() => {
      expect(document.querySelector('.office-floor-person.is-speaking')).toBeTruthy();
    });
    expect(screen.getByText(/I'm Linda, from People Ops/)).toBeTruthy();
  });

  it('treats the cast as scenery during the ceremony', () => {
    render(<FloorArrival />);
    const chad = screen.getByRole('button', { name: /Chad/ });
    expect(chad.disabled).toBe(true);
  });

  it('skipping marks orientation seen and hands back to the canvas', () => {
    const onComplete = vi.fn();
    const onSkipToBuild = vi.fn();
    render(<FloorArrival onComplete={onComplete} onSkipToBuild={onSkipToBuild} />);

    fireEvent.click(screen.getByRole('button', { name: /Skip the ceremony/i }));

    expect(onComplete).toHaveBeenCalledWith({ skipDeskTour: true });
    expect(onSkipToBuild).toHaveBeenCalled();
    expect(readOfficeDirectorySeen()).toBe(true);
  });

  it('clocking in walks you to your desk and completes boot', async () => {
    const onComplete = vi.fn();
    render(<FloorArrival onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));

    fireEvent.click(await screen.findByRole('button', { name: /take my desk|clock in/i }));

    // Without an animation engine the walk resolves immediately (also the
    // reduced-motion path), so boot completes and the desk tour follows.
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({ startDeskTour: true });
    });
    expect(readOfficeDirectorySeen()).toBe(true);
  });
});
