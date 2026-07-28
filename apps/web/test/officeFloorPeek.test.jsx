// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { deskWorkFor } from '../src/utils/officeDeskWork.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions, setOfficeNarration } from '../src/state/officeMomentStore.js';

/**
 * Without a WAAPI engine (jsdom) `useWalkAnimation` settles immediately, which
 * is also the reduced-motion behaviour: the walk happens, it just doesn't
 * travel. So clicking "their screen" lands you at their desk in one tick.
 */
function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

function walkOverTo(name) {
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: /Their screen/i }));
}

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
  setOfficeCaptions(false);
  setOfficeNarration(true);
});

beforeEach(() => {
  localStorage.clear();
  setOfficeCaptions(false);
  setOfficeNarration(true);
});

describe('desk peeking (slice 6)', () => {
  it('walks you over and leaves your own desk empty while you are up', () => {
    const view = renderFloor();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();

    walkOverTo(/Ulrich/);

    expect(screen.getByTestId('office-floor-peek-player')).toBeTruthy();
    // § 6 rule 5: the furniture stays, the person doesn't — and the person is you.
    expect(view.container.querySelector('[data-seat="you"]')).toBeTruthy();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBe('true');
    // They do not move: you went to them.
    expect(view.container.querySelector('[data-seat="greybeard"]')?.dataset.vacant).toBeUndefined();
  });

  it('says their line over their shoulder and glows the speaker', async () => {
    const view = renderFloor({
      sceneHandlers: { narrateLine: vi.fn(() => Promise.resolve({ spoken: false })) }
    });
    walkOverTo(/Ulrich/);

    const bubble = await screen.findByTestId('office-floor-peek-line');
    expect(bubble.textContent).toContain(deskWorkFor('greybeard').line);
    expect(bubble.textContent).toMatch(/Ulrich/);
    const speaking = view.container.querySelectorAll('.office-floor-person.is-speaking');
    expect(speaking).toHaveLength(1);
    expect(speaking[0].closest('[data-seat]')?.dataset.seat).toBe('greybeard');
  });

  it('speaks peek lines aloud and hides the bubble when CC is off and narration works', async () => {
    const line = deskWorkFor('greybeard').line;
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    renderFloor({ sceneHandlers: { narrateLine } });
    walkOverTo(/Ulrich/);

    await waitFor(() =>
      expect(narrateLine).toHaveBeenCalledWith({ speakerId: 'greybeard', text: line })
    );
    await waitFor(() => expect(screen.queryByText(line)).toBeNull());
  });

  it('captions what is on the screen in the card slot, not over the pod', () => {
    renderFloor();
    walkOverTo(/Ulrich/);

    // § 6 rule 12 again: chrome for a crowded room goes in the card slot.
    const card = screen.getByTestId('office-floor-peek-card');
    expect(card.textContent).toMatch(/green on black/i);
    expect(screen.queryByTestId('office-floor-panel')).toBeNull();
    // The card slot is single-occupancy: the peek replaces the person card.
    expect(screen.queryByText(/We tried that in 2009/)).toBeNull();
  });

  it('walks you home again and sits nobody down on the way', () => {
    const view = renderFloor();
    walkOverTo(/Ulrich/);

    fireEvent.click(screen.getByRole('button', { name: /Back to my desk/i }));

    expect(screen.queryByTestId('office-floor-peek-player')).toBeNull();
    expect(screen.queryByTestId('office-floor-peek-card')).toBeNull();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();
    // You are back at your desk on the floor, not back at your screen.
    expect(getOfficeViewMode()).toBe('floor');
  });

  it('walks you home on Escape before it sits you down', () => {
    renderFloor();
    walkOverTo(/Ulrich/);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('office-floor-peek-player')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('offers no peek where there is nowhere to stand', () => {
    renderFloor({ onMessage: vi.fn() });

    // Leadership sit behind glass; the card says so instead.
    fireEvent.click(screen.getByRole('button', { name: /Gavin Belson/ }));
    expect(screen.queryByRole('button', { name: /Their screen/i })).toBeNull();
    expect(screen.getByText(/Not without a calendar invite/i)).toBeTruthy();

    // Gary has no desk to look at, but he is still on the office tier.
    fireEvent.click(screen.getByRole('button', { name: /Gary/ }));
    expect(screen.queryByRole('button', { name: /Their screen/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Message/ })).toBeTruthy();
  });

  it('offers both verbs to a floor colleague who has a desk', () => {
    renderFloor({ onMessage: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));

    expect(screen.getByRole('button', { name: /Message/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Their screen/i })).toBeTruthy();
  });

  it('drops the peek when a meeting takes the room', () => {
    const meeting = {
      state: 'playing',
      title: 'Architecture Review Board',
      attendees: ['scrumMaster', 'gilfoyle'],
      facilitatorId: 'scrumMaster',
      transcript: [{ speakerId: 'gilfoyle', kind: 'substantive', text: 'The gateway is fine.' }],
      interjectionsLeft: 2
    };
    const view = renderFloor();
    walkOverTo(/Ulrich/);

    view.rerender(<OfficeFloor meeting={meeting} />);

    // Two of you on the floor at once would give the game away.
    expect(screen.queryByTestId('office-floor-peek-player')).toBeNull();
    expect(screen.queryByTestId('office-floor-peek-card')).toBeNull();
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
  });

  it('draws what everybody is working on whether or not you walk over', () => {
    // The fiction is ambience on every monitor; peeking is only how you get
    // close enough to read it.
    const view = renderFloor();
    const screens = view.container.querySelectorAll('.floor-screen');
    expect(screens.length).toBeGreaterThan(10);
  });
});
