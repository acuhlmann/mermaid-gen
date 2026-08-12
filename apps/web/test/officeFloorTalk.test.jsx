// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { FloorTalkCard } from '../src/components/officeFloor/FloorTalk.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
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

/**
 * A line somebody **said** to you — `channel: 'talk'`, which is what these tests
 * have always meant and never stated. The channel was implicit while the floor
 * narrated whatever was newest; it is load-bearing now that it only narrates
 * speech, because a fixture without it is a *typed* Slop Chat™ message and the
 * floor must refuse to put one in somebody's mouth (`officeVoiceMedium.test.jsx`).
 */
function imFrom(colleagueId, body, outbound = false) {
  return {
    id: `${colleagueId}-${body}`,
    colleagueId,
    body,
    channel: 'talk',
    createdAt: Date.now(),
    outbound
  };
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

  it('does not auto-greet when you arrive — you speak first', async () => {
    const onTalkGreet = vi.fn().mockResolvedValue(undefined);
    const view = renderFloor({ onTalkGreet });

    expect(onTalkGreet).not.toHaveBeenCalled();
    walkOverToTalk();

    await screen.findByTestId('office-floor-talk-card');
    expect(onTalkGreet).not.toHaveBeenCalled();
    view.rerender(<OfficeFloor onTalkGreet={onTalkGreet} />);
    expect(onTalkGreet).not.toHaveBeenCalled();
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
    // Voice-first: the stage bubble hides; the talk *card* may still show the
    // recent-turns strip (chrome, not a speech balloon).
    await waitFor(() => expect(screen.queryByTestId('office-floor-talk-line')).toBeNull());
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

    expect(await screen.findByTestId('office-floor-talk-line')).toBeTruthy();
    expect(screen.getByTestId('office-floor-talk-line').textContent).toContain(line);
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

  it('exposes a mic on the floor composer, same as Slop Chat', async () => {
    renderFloor({ onTalkGreet: vi.fn() });
    walkOverToTalk();

    await screen.findByTestId('office-floor-talk-card');
    const mic = screen.getByRole('button', { name: /hold to speak|tap to dictate|mic/i });
    expect(mic.className).toContain('office-floor-talk-mic');
  });

  it('focuses the prompt when you arrive — no opener chips crowding the card', async () => {
    renderFloor({ onTalkGreet: vi.fn() });
    walkOverToTalk();

    const input = await screen.findByPlaceholderText(/Say something/i);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByTestId('office-floor-talk-opener')).toBeNull();
  });

  it('sends on Enter from the prompt', async () => {
    const onTalkReply = vi.fn().mockResolvedValue(undefined);
    renderFloor({ onTalkGreet: vi.fn(), onTalkReply });
    walkOverToTalk();

    const input = await screen.findByPlaceholderText(/Say something/i);
    fireEvent.change(input, { target: { value: 'quick one about the gateway' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() =>
      expect(onTalkReply).toHaveBeenCalledWith(CHAD, 'quick one about the gateway')
    );
  });

  it('shows recent thread turns in Slop Chat, not on the floor card', async () => {
    const imHistory = [
      imFrom(CHAD, 'is the gateway meant to talk to itself?'),
      imFrom(CHAD, 'maybe we should check the edges', true)
    ];
    renderFloor({ imHistory, onTalkGreet: vi.fn() });
    walkOverToTalk();

    await screen.findByTestId('office-floor-talk-card');
    expect(screen.queryByTestId('office-floor-talk-thread')).toBeNull();
  });

  it('offers Go and talk to your team, not leadership', () => {
    renderFloor({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Gilfoyle/ }));
    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
  });

  it('double-clicks a colleague to walk over and talk', async () => {
    const onTalkGreet = vi.fn().mockResolvedValue(undefined);
    renderFloor({ onTalkGreet });

    fireEvent.doubleClick(screen.getByRole('button', { name: /Chad/ }));

    await screen.findByTestId('office-floor-talk-card');
    expect(onTalkGreet).not.toHaveBeenCalled();
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

/**
 * Slice 4 shipped pitches from the whole cast and every surface honoured it
 * except this one, so the same suggestion carried a Do-it at your desk and
 * nothing standing up. ADR-0012 recorded that as a debt rather than a decision.
 */
describe('adopting a pitch on the floor (ADR-0012)', () => {
  const PITCH = 'add a retry queue between the gateway and the workers';
  const SAID = 'the gateway has no backpressure';

  function pitchFrom(colleagueId, body, actionPrompt, outbound = false) {
    return { ...imFrom(colleagueId, body, outbound), actionPrompt };
  }

  it('offers Do it when their newest line carries one, and runs it attributed to them', async () => {
    const onAdoptPrompt = vi.fn();
    renderFloor({
      imHistory: [pitchFrom(CHAD, SAID, PITCH)],
      onTalkGreet: vi.fn(),
      onAdoptPrompt
    });
    walkOverToTalk();

    fireEvent.click(await screen.findByTestId('office-floor-talk-adopt'));
    expect(onAdoptPrompt).toHaveBeenCalledWith(PITCH, CHAD);
  });

  it('offers nothing when they were only making conversation', async () => {
    renderFloor({
      imHistory: [imFrom(CHAD, 'is that the new architecture diagram?')],
      onTalkGreet: vi.fn(),
      onAdoptPrompt: vi.fn()
    });
    walkOverToTalk();

    await screen.findByTestId('office-floor-talk-card');
    expect(screen.queryByTestId('office-floor-talk-adopt')).toBeNull();
  });

  /*
   * The reason the button is card chrome rather than bubble furniture.
   * `FloorDeskSpeech` returns null outright under `hideBody`, so a Do-it on the
   * balloon would come and go with a captions preference that has nothing to do
   * with whether somebody had an idea.
   */
  it('keeps the offer when narration hides the bubble — a pitch is not a caption', async () => {
    renderFloor({
      imHistory: [pitchFrom(CHAD, SAID, PITCH)],
      onTalkGreet: vi.fn(),
      onAdoptPrompt: vi.fn(),
      sceneHandlers: { narrateLine: vi.fn(() => Promise.resolve({ spoken: true })) }
    });
    walkOverToTalk();

    await waitFor(() => expect(screen.queryByTestId('office-floor-talk-line')).toBeNull());
    expect(screen.getByTestId('office-floor-talk-adopt')).toBeTruthy();
  });

  it('reads their suggestion, never one attached to your own message', async () => {
    const onAdoptPrompt = vi.fn();
    renderFloor({
      imHistory: [
        pitchFrom(CHAD, SAID, PITCH),
        pitchFrom(CHAD, 'good idea, I will try that', 'a prompt on your own words', true)
      ],
      onTalkGreet: vi.fn(),
      onAdoptPrompt
    });
    walkOverToTalk();

    fireEvent.click(await screen.findByTestId('office-floor-talk-adopt'));
    expect(onAdoptPrompt).toHaveBeenCalledWith(PITCH, CHAD);
  });

  /*
   * Rendered directly because a walk settles in one tick under jsdom, so the
   * integration path above can never hold the 'walking' phase long enough to
   * assert on it.
   */
  it('offers nothing on the walk over — their last line may be from last week', () => {
    render(
      <FloorTalkCard
        talk={{ colleagueId: CHAD, phase: 'walking' }}
        copy={officeChromeCopy().floor}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        pitch={PITCH}
        onAdopt={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.queryByTestId('office-floor-talk-adopt')).toBeNull();
  });

  it('offers nothing when no adopt handler is wired — a dead trigger is worse than none', () => {
    render(
      <FloorTalkCard
        talk={{ colleagueId: CHAD, phase: 'talking' }}
        copy={officeChromeCopy().floor}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        pitch={PITCH}
        onLeave={vi.fn()}
      />
    );

    expect(screen.queryByTestId('office-floor-talk-adopt')).toBeNull();
  });

  it('labels the button with the shared Do-it copy, not a floor-only synonym', async () => {
    renderFloor({
      imHistory: [pitchFrom(CHAD, SAID, PITCH)],
      onTalkGreet: vi.fn(),
      onAdoptPrompt: vi.fn()
    });
    walkOverToTalk();

    const button = await screen.findByTestId('office-floor-talk-adopt');
    expect(button.textContent).toBe(officeChromeCopy().doIt);
  });
});
