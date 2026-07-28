// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { approachTileFor } from '../src/utils/officeFloorMovement.js';
import { projectIso } from '../src/utils/officeFloorPlan.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions, setOfficeNarration } from '../src/state/officeMomentStore.js';

/**
 * Talking on the floor (slice 8). The conversation *is* the Slop Chat™ thread —
 * these tests hand the floor an `imHistory` and assert it renders it, which is
 * ADR-0011 rule 1 stated as a test: the floor reads office state, it never owns
 * any. Walks settle in one tick without a WAAPI engine, so arriving is synchronous.
 */
const CHAD = 'intern';

function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

function walkOverToTalk(name = /Chad/) {
  fireEvent.click(screen.getByRole('button', { name }));
  fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));
}

function imFrom(colleagueId, body, outbound = false) {
  return { id: `${colleagueId}-${body}`, colleagueId, body, createdAt: Date.now(), outbound };
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

describe('talking on the floor (slice 8)', () => {
  it('offers the verb to a colleague you can reach, and walks you to them', () => {
    const view = renderFloor({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    const mark = approachTileFor(CHAD);
    const { left, top } = projectIso(mark.x, mark.y);
    expect(screen.getByTestId('office-floor-player').style.transform).toBe(
      `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`
    );
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBe('true');
    // They do not move — you went to them.
    expect(view.container.querySelector(`[data-seat="${CHAD}"]`)?.dataset.vacant).toBeUndefined();
  });

  it('opens with a live line once, when you actually get there', async () => {
    const onTalkGreet = vi.fn().mockResolvedValue(undefined);
    const view = renderFloor({ onTalkGreet });

    expect(onTalkGreet).not.toHaveBeenCalled();
    walkOverToTalk();

    await waitFor(() => expect(onTalkGreet).toHaveBeenCalledWith(CHAD));
    // Re-rendering must not re-fire a live LLM call.
    view.rerender(<OfficeFloor onTalkGreet={onTalkGreet} />);
    expect(onTalkGreet).toHaveBeenCalledTimes(1);
  });

  it('renders their newest line as a bubble over them, and glows them', async () => {
    const imHistory = [imFrom(CHAD, 'Quick one — is that the new architecture diagram?')];
    const view = renderFloor({
      imHistory,
      onTalkGreet: vi.fn(),
      sceneHandlers: { narrateLine: vi.fn(() => Promise.resolve({ spoken: false })) }
    });
    walkOverToTalk();

    const bubble = await screen.findByTestId('office-floor-talk-line');
    expect(bubble.textContent).toContain('is that the new architecture diagram?');
    const speaking = view.container.querySelectorAll('.office-floor-person.is-speaking');
    expect(speaking).toHaveLength(1);
    expect(speaking[0].closest('[data-seat]')?.dataset.seat).toBe(CHAD);
  });

  it('speaks floor talk aloud and hides the bubble when CC is off and narration works', async () => {
    const line = 'Quick one — is that the new architecture diagram?';
    const imHistory = [imFrom(CHAD, line)];
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    renderFloor({
      imHistory,
      onTalkGreet: vi.fn(),
      sceneHandlers: { narrateLine }
    });
    walkOverToTalk();

    await waitFor(() => expect(narrateLine).toHaveBeenCalledWith({ speakerId: CHAD, text: line }));
    await waitFor(() => expect(screen.queryByText(line)).toBeNull());
  });

  it('shows the bubble when captions are on even while narration speaks', async () => {
    setOfficeCaptions(true);
    const line = 'Quick one — is that the new architecture diagram?';
    const imHistory = [imFrom(CHAD, line)];
    renderFloor({
      imHistory,
      onTalkGreet: vi.fn(),
      sceneHandlers: { narrateLine: vi.fn(() => Promise.resolve({ spoken: true })) }
    });
    walkOverToTalk();

    expect(await screen.findByText(line)).toBeTruthy();
  });

  it('shows what they said, not what you said', () => {
    const imHistory = [
      imFrom(CHAD, 'they said this'),
      imFrom(CHAD, 'you said this', true) // outbound — your own words
    ];
    renderFloor({ imHistory, onTalkGreet: vi.fn() });
    walkOverToTalk();

    expect(screen.getByTestId('office-floor-talk-line').textContent).toContain('they said this');
    expect(screen.getByTestId('office-floor-talk-line').textContent).not.toContain('you said this');
  });

  it('sends a typed reply through the shared IM path', async () => {
    const onTalkReply = vi.fn().mockResolvedValue(undefined);
    renderFloor({ onTalkGreet: vi.fn(), onTalkReply });
    walkOverToTalk();

    const input = await screen.findByPlaceholderText(/Say something/i);
    fireEvent.change(input, { target: { value: 'we should discuss the gateway' } });
    fireEvent.click(screen.getByRole('button', { name: /Say it/i }));

    await waitFor(() =>
      expect(onTalkReply).toHaveBeenCalledWith(CHAD, 'we should discuss the gateway')
    );
  });

  it('offers the same canned quick replies Slop Chat does', async () => {
    const onTalkReply = vi.fn().mockResolvedValue(undefined);
    renderFloor({ onTalkGreet: vi.fn(), onTalkReply });
    walkOverToTalk();

    await screen.findByTestId('office-floor-talk-card');
    fireEvent.click(screen.getByRole('button', { name: 'in a meeting' }));
    await waitFor(() => expect(onTalkReply).toHaveBeenCalledWith(CHAD, 'in a meeting'));
  });

  it('tells renderer #1 who you are stood in front of, so it can hold the toast', async () => {
    const onTalkingChange = vi.fn();
    renderFloor({ onTalkGreet: vi.fn(), onTalkingChange });

    expect(onTalkingChange).toHaveBeenLastCalledWith(null);
    walkOverToTalk();
    await waitFor(() => expect(onTalkingChange).toHaveBeenLastCalledWith(CHAD));

    fireEvent.click(screen.getByRole('button', { name: /Back to my desk/i }));
    await waitFor(() => expect(onTalkingChange).toHaveBeenLastCalledWith(null));
  });

  it('walks you home when you leave, and stays on the floor', () => {
    const view = renderFloor({ onTalkGreet: vi.fn() });
    walkOverToTalk();

    fireEvent.click(screen.getByRole('button', { name: /Back to my desk/i }));

    expect(screen.queryByTestId('office-floor-talk-card')).toBeNull();
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();
    expect(getOfficeViewMode()).toBe('floor');
  });

  it('offers no conversation to somebody behind glass', () => {
    renderFloor({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Gavin Belson/ }));

    expect(screen.queryByRole('button', { name: /Go and talk/i })).toBeNull();
    expect(screen.getByText(/Not without a calendar invite/i)).toBeTruthy();
  });

  it('offers a conversation to Gary, who has no desk to peek at', () => {
    renderFloor({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Gary/ }));

    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Their screen/i })).toBeNull();
  });

  /*
   * § 6 rule 20, caught by a capture. `--over-seat` clears 30 px of seat lift,
   * which somebody standing at their own tile never gets — Gary's balloon
   * floated a clear tile above his head while everybody else's sat on theirs.
   */
  it('lifts a bubble by the figure, not the furniture, over somebody standing', () => {
    const imHistory = [imFrom('facilities', 'the fridge is a shared responsibility')];
    renderFloor({ imHistory, onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Gary/ }));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    const anchor = screen
      .getByTestId('office-floor-talk-line')
      .querySelector('.office-floor-walker-anchor');
    expect(anchor.className).toContain('office-floor-walker-anchor--over-standing');
    expect(anchor.className).not.toContain('office-floor-walker-anchor--over-seat');
  });

  it('still lifts by seat + figure over somebody who is sitting down', () => {
    const imHistory = [imFrom(CHAD, 'is the gateway meant to talk to itself?')];
    renderFloor({ imHistory, onTalkGreet: vi.fn() });
    walkOverToTalk();

    const anchor = screen
      .getByTestId('office-floor-talk-line')
      .querySelector('.office-floor-walker-anchor');
    expect(anchor.className).toContain('office-floor-walker-anchor--over-seat');
  });
});
