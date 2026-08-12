// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { FloorTalkCard } from '../src/components/officeFloor/FloorTalk.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { approachTileFor } from '../src/utils/officeFloorMovement.js';
import { isStandableTile, projectIso } from '../src/utils/officeFloorPlan.js';
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

/**
 * Joining a conversation you were only near (slice 23).
 *
 * The claim worth pinning is the whole of the slice, and it is a *negative* one:
 * joining is not a new verb. Pressing the offer has to land you in the same card
 * that walking up to somebody lands you in — same composer, same silence waiting
 * for you to speak — because the moment it becomes its own conversation surface
 * the exchange has started answering you back, which is what ADR-0010 and
 * `office-parody.md` § 11 keep shop talk out of.
 *
 * Driven through the whole floor rather than through `FloorJoinCard`, since the
 * half that can silently rot is the wiring: an offer that renders beautifully
 * and hands `startTalk` no mark is a button that does nothing.
 */
describe('joining shop talk (slice 23)', () => {
  /** Where 0.75 sends Chad — the floor suite's own seed (see officeFloorWander). */
  const BOARD = { x: 8, y: 4 };
  /**
   * In the ring: two tiles from the mark and two from Dinesh, who answers. Every
   * listening tile on this floor is within a tile of *some* seat — the room is
   * that dense — but never of one of the two speakers, which is the only thing
   * the ladder promises.
   */
  const LISTENING = { x: 8, y: 6 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function clickTile(tile) {
    const { left, top } = projectIso(tile.x, tile.y);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });
  }

  /**
   * Chad settled at the whiteboard with you standing where you can hear him.
   *
   * The two `expect`s are the coverage claim rather than decoration: without a
   * settled wanderer at the board there is no exchange, and every assertion
   * below would pass while examining nothing.
   */
  function floorWithinEarshot(props = {}) {
    const view = renderFloor(props);
    act(() => vi.advanceTimersByTime(9_000));
    const figure = screen.getByTestId('office-floor-wanderer');
    expect(figure.dataset.wanderer, 'the seed stopped picking Chad').toBe(CHAD);
    expect(figure.dataset.settled, 'nobody is standing at the board').toBe('true');
    expect(isStandableTile(LISTENING)).toBe(true);
    act(() => clickTile(LISTENING));
    return view;
  }

  it('offers a way in, naming both of them and the place', () => {
    floorWithinEarshot();

    const card = screen.getByTestId('office-floor-join-card');
    expect(card.textContent).toContain('Chad');
    expect(card.textContent).toContain('Dinesh');
    expect(card.textContent).toContain('the whiteboard');
  });

  it('opens the ordinary conversation card, at the speaker who is about to leave', () => {
    floorWithinEarshot({ onTalkGreet: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Join in/i }));

    const card = screen.getByTestId('office-floor-talk-card');
    expect(card.textContent).toContain('Chad');
    // The offer is spent — one card slot, and you are in the conversation now.
    expect(screen.queryByTestId('office-floor-join-card')).toBeNull();
  });

  /*
   * The composer arrives empty and nothing has been said on your behalf. Slice
   * 8's `handleTalkGreet` is an empty function with a one-line reason — you
   * speak first — and joining must not become the exception that seeds an
   * opener, or the overheard lines would have turned into something addressed
   * to you after all.
   */
  it('puts no words in your mouth on the way in', () => {
    const onTalkReply = vi.fn();
    floorWithinEarshot({ onTalkGreet: vi.fn(), onTalkReply });

    fireEvent.click(screen.getByRole('button', { name: /Join in/i }));

    expect(onTalkReply).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Say something/i).value).toBe('');
  });

  /*
   * The hold slice 19 could not have. `startTalk` sets `activity.talk`
   * immediately, which is `useFloorAway`'s `holdId`, so Chad's dwell clock stops
   * while you cross the room — nine seconds is past the longest dwell, and
   * without the hold he is back in his chair before you arrive.
   */
  it('keeps them standing there while you walk over', () => {
    floorWithinEarshot({ onTalkGreet: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Join in/i }));

    act(() => vi.advanceTimersByTime(9_000));

    expect(screen.getByTestId('office-floor-wanderer').dataset.wanderer).toBe(CHAD);
    expect(screen.getByTestId('office-floor-talk-card').textContent).toContain('Chad');
  });

  it('says so in the live region, in the card slot s own order', () => {
    floorWithinEarshot();

    const region = screen.getByTestId('office-floor-narration');
    expect(region.textContent).toContain('Chad');
    expect(region.textContent).toContain('Dinesh');
  });
});
