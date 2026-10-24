// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HuddleOverlay, {
  HUDDLE_LINE_PACE_MS,
  HUDDLE_TAIL_MS
} from '../src/components/HuddleOverlay.jsx';
import { useHuddleRingControls } from '../src/hooks/useHuddleRingControls.js';
import { OFFICE_NARRATION_GAP_MS } from '../src/utils/officeNarration.js';
import { setOfficeCaptions } from '../src/state/officeMomentStore.js';

const ATTENDEES = ['gilfoyle', 'dinesh', 'erlich', 'russ', 'jared', 'richard'];

const BEATS = [
  { speakerId: 'gilfoyle', text: 'The Auth box is doing two jobs.' },
  {
    speakerId: 'dinesh',
    text: 'I said that last week.',
    actionPrompt: 'Split the Auth node in two'
  },
  { speakerId: 'erlich', text: 'What if Auth were a platform?' }
];

/** One voice, several beats — the shape only a pair script has. */
const PAIR_BEATS = [
  { speakerId: 'gilfoyle', text: 'The Auth box is doing two jobs.' },
  { speakerId: 'gilfoyle', text: 'The second one is authorization.' },
  { speakerId: 'gilfoyle', text: 'Which is why Billing reads it.', actionPrompt: 'Split Auth' }
];

function huddle(overrides = {}) {
  return {
    id: 'huddle-1',
    mode: 'mob',
    attendees: ATTENDEES,
    beats: BEATS,
    suggestions: {},
    phase: 'speaking',
    createdAt: 0,
    ...overrides
  };
}

/** Advance one remark at reading pace (narrateLine reports spoken:false). */
async function advanceOneLine() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(HUDDLE_LINE_PACE_MS + 20);
  });
}

/** Advance to the next remark when narration reports spoken (short gap). */
async function advanceSpokenLine() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(OFFICE_NARRATION_GAP_MS + 40);
  });
}

describe('HuddleOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOfficeCaptions(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setOfficeCaptions(false);
  });

  it('seats every teammate around the canvas while the script is still loading', () => {
    render(<HuddleOverlay huddle={huddle({ beats: [], phase: 'gathering' })} />);
    for (const id of ATTENDEES) {
      expect(screen.getByTestId(`office-huddle-seat-${id}`)).toBeTruthy();
    }
    expect(screen.getByText('Everyone is wandering over…')).toBeTruthy();
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
  });

  it('shows Do it beside the current speaker even without actionPrompt', () => {
    const onAdoptPrompt = vi.fn();
    const beatsWithoutPrompt = [
      { speakerId: 'gilfoyle', text: 'The Auth box is doing two jobs.' },
      { speakerId: 'dinesh', text: 'Split Auth from Billing.' }
    ];
    render(
      <HuddleOverlay
        huddle={huddle({ beats: beatsWithoutPrompt, attendees: ['gilfoyle', 'dinesh'] })}
        onAdoptPrompt={onAdoptPrompt}
      />
    );
    expect(screen.getByTestId('office-huddle-do-it-gilfoyle')).toBeTruthy();
    fireEvent.click(screen.getByTestId('office-huddle-do-it-gilfoyle'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('The Auth box is doing two jobs.', 'gilfoyle');
  });

  it('clears Do it when the turn ends, and brings it back when the face is pinned', async () => {
    render(<HuddleOverlay huddle={huddle()} />);
    expect(screen.getByTestId('office-huddle-do-it-gilfoyle')).toBeTruthy();
    await advanceOneLine();
    // Dinesh has the floor; Gilfoyle's turn is over — no lingering Do it.
    expect(screen.queryByTestId('office-huddle-do-it-gilfoyle')).toBeNull();
    expect(screen.getByTestId('office-huddle-do-it-dinesh')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.getByTestId('office-huddle-do-it-gilfoyle')).toBeTruthy();
  });

  it('spreads the seats across all four sides', () => {
    const { container } = render(<HuddleOverlay huddle={huddle()} />);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(
        container.querySelectorAll(`.office-huddle-seat.is-side-${side}`).length
      ).toBeGreaterThan(0);
    }
  });

  it('lights up one teammate at a time, in order', async () => {
    const { container } = render(<HuddleOverlay huddle={huddle()} />);

    const speaking = () => container.querySelector('.office-huddle-seat[data-speaking="true"]');
    expect(speaking()?.getAttribute('data-testid')).toBe('office-huddle-seat-gilfoyle');
    expect(container.querySelectorAll('[data-speaking="true"]')).toHaveLength(1);

    await advanceOneLine();
    expect(speaking()?.getAttribute('data-testid')).toBe('office-huddle-seat-dinesh');

    await advanceOneLine();
    expect(speaking()?.getAttribute('data-testid')).toBe('office-huddle-seat-erlich');
  });

  it('shows remark text when nobody is speaking it aloud', () => {
    render(<HuddleOverlay huddle={huddle()} />);
    expect(screen.getByText(BEATS[0].text)).toBeTruthy();
  });

  // Do it used to ride the bubble, where it overlapped the canvas and repeated
  // the remark just said aloud. It lives in the bottom chrome now, so a voiced
  // line leaves no bubble at all — just the name label by their face.
  it('names the speaker when voice is on and CC is off — Do it sits in the chrome', () => {
    const { container } = render(
      <HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />
    );
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
    expect(container.querySelector('.office-huddle-bubble')).toBeNull();
    expect(container.querySelector('.office-huddle-speaking-label').textContent).toMatch(
      /Gilfoyle/
    );
    expect(
      container.querySelector('.office-huddle-chrome [data-testid="office-huddle-do-it-gilfoyle"]')
    ).toBeTruthy();
    expect(container.querySelector('[data-speaking="true"]')).toBeTruthy();
  });

  it('shows Do it beside the speaker when ring controls are lifted to OfficeLayer', async () => {
    function LiftedRingHarness({ huddle: h, onAdoptPrompt }) {
      const ring = useHuddleRingControls({
        huddle: h,
        onAdoptPrompt,
        onHardStop: vi.fn()
      });
      return <HuddleOverlay huddle={h} ringControls={ring} onAdoptPrompt={onAdoptPrompt} />;
    }

    const onAdoptPrompt = vi.fn();
    render(<LiftedRingHarness huddle={huddle()} onAdoptPrompt={onAdoptPrompt} />);
    await advanceOneLine();
    fireEvent.click(screen.getByTestId('office-huddle-do-it-dinesh'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split the Auth node in two', 'dinesh');
  });

  it('offers one Do it, outside any bubble, when voice is on and the beat has an action prompt', async () => {
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    await advanceSpokenLine();
    expect(screen.queryByText(BEATS[1].text)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Do it/i })).toHaveLength(1);
    expect(document.querySelector('.office-huddle-bubble')).toBeNull();
  });

  it('shows the remark text again once CC is on, even with voice speaking', () => {
    setOfficeCaptions(true);
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    expect(screen.getByText(BEATS[0].text)).toBeTruthy();
  });

  it('keeps remarks sequential when voice is off — never reveals the whole ring at once', async () => {
    const { container } = render(<HuddleOverlay huddle={huddle()} />);
    expect(container.querySelectorAll('.office-huddle-line')).toHaveLength(1);
    await advanceOneLine();
    // Prior speakers clear their bubble; only the live remark is on screen.
    expect(container.querySelectorAll('.office-huddle-line')).toHaveLength(1);
  });

  it('adopts a remark that came with an action prompt', async () => {
    const onAdoptPrompt = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onAdoptPrompt={onAdoptPrompt} />);
    await advanceOneLine();
    fireEvent.click(screen.getByTestId('office-huddle-do-it-dinesh'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split the Auth node in two', 'dinesh');
  });

  it('shows Do it beside the speaker when captions are on', async () => {
    setOfficeCaptions(true);
    render(<HuddleOverlay huddle={huddle()} />);
    await advanceOneLine();
    expect(screen.getByText(BEATS[1].text)).toBeTruthy();
    expect(screen.getByTestId('office-huddle-do-it-dinesh')).toBeTruthy();
  });

  it('repeats a pinned remark aloud instead of flashing stale text', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: true }));
    render(<HuddleOverlay huddle={huddle()} narrateLine={narrateLine} />);
    await advanceOneLine();
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.getByTestId('office-huddle-pinned-gilfoyle')).toBeTruthy();
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
    expect(screen.queryByText(/Gilfoyle is talking/i)).toBeNull();
    expect(screen.getByTestId('office-huddle-do-it-gilfoyle')).toBeTruthy();
    expect(narrateLine).toHaveBeenCalledWith(
      expect.objectContaining({ speakerId: 'gilfoyle', text: BEATS[0].text })
    );
  });

  it('offers Do it beside a pinned head that only has spoken text', async () => {
    const onAdoptPrompt = vi.fn();
    const narrateLine = vi.fn(async () => ({ spoken: true }));
    render(
      <HuddleOverlay huddle={huddle()} onAdoptPrompt={onAdoptPrompt} narrateLine={narrateLine} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    fireEvent.click(screen.getByTestId('office-huddle-do-it-gilfoyle'));
    expect(onAdoptPrompt).toHaveBeenCalledWith(BEATS[0].text, 'gilfoyle');
  });

  it('unpins and resumes the huddle after a repeat when Do it is not pressed', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    render(<HuddleOverlay huddle={huddle()} narrateLine={narrateLine} />);
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.getByTestId('office-huddle-pinned-gilfoyle')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUDDLE_LINE_PACE_MS + 20);
    });
    expect(screen.queryByTestId('office-huddle-pinned-gilfoyle')).toBeNull();
  });

  it('unpins when the backdrop is clicked', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    render(<HuddleOverlay huddle={huddle()} narrateLine={narrateLine} />);
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.getByTestId('office-huddle-pinned-gilfoyle')).toBeTruthy();
    fireEvent.click(screen.getByTestId('office-huddle-shade'));
    expect(screen.queryByTestId('office-huddle-pinned-gilfoyle')).toBeNull();
  });

  it('delegates from a pinned head via Do it when the beat has an action prompt', async () => {
    const onAdoptPrompt = vi.fn();
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    render(
      <HuddleOverlay huddle={huddle()} onAdoptPrompt={onAdoptPrompt} narrateLine={narrateLine} />
    );
    await advanceOneLine();
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Dinesh/i }));
    fireEvent.click(screen.getByTestId('office-huddle-do-it-dinesh'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split the Auth node in two', 'dinesh');
  });

  it('asks for an on-spot suggestion when a silent head is clicked', async () => {
    const onRequestSuggestion = vi.fn(async () => ({
      speakerId: 'russ',
      text: 'Ship a tres-commas Auth.',
      actionPrompt: 'Ship a tres-commas Auth.'
    }));
    render(
      <HuddleOverlay
        huddle={huddle({
          beats: BEATS,
          suggestions: {}
        })}
        onRequestSuggestion={onRequestSuggestion}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Russ/i }));
    expect(onRequestSuggestion).toHaveBeenCalledWith('russ');
  });

  it('keeps the ring seated while watching a delegated Do-it', () => {
    render(<HuddleOverlay huddle={huddle({ phase: 'watching' })} />);
    expect(screen.getByTestId('office-huddle').getAttribute('data-phase')).toBe('watching');
    expect(screen.getByText(/watching the notebook/i)).toBeTruthy();
    for (const id of ATTENDEES) {
      expect(screen.getByTestId(`office-huddle-seat-${id}`)).toBeTruthy();
    }
  });

  it('ends the huddle from the Hard stop button', () => {
    const onHardStop = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onHardStop={onHardStop} />);
    fireEvent.click(screen.getByRole('button', { name: /Hard stop/ }));
    expect(onHardStop).toHaveBeenCalledTimes(1);
  });

  it('ends the huddle on Escape', () => {
    const onHardStop = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onHardStop={onHardStop} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onHardStop).toHaveBeenCalledTimes(1);
  });

  it('raises a hand: the speaker holds, you ask them, and their answer plays as their line', async () => {
    setOfficeCaptions(true);
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    const onAskSpeaker = vi.fn(async () => ({
      speakerId: 'gilfoyle',
      text: 'Because it also signs the tokens.'
    }));
    render(
      <HuddleOverlay huddle={huddle()} narrateLine={narrateLine} onAskSpeaker={onAskSpeaker} />
    );
    fireEvent.click(screen.getByTestId('office-huddle-raise-hand'));
    expect(screen.getByTestId('office-huddle-pinned-gilfoyle')).toBeTruthy();
    // The hand is up: no second one to raise, and the stand-up does not move on.
    expect(screen.queryByTestId('office-huddle-raise-hand')).toBeNull();
    await advanceOneLine();
    expect(screen.queryByTestId('office-huddle-seat-dinesh')?.dataset.speaking).toBeUndefined();

    fireEvent.change(screen.getByTestId('office-huddle-ask').querySelector('input'), {
      target: { value: 'Why two jobs?' }
    });
    fireEvent.click(screen.getByTestId('office-huddle-ask-send'));
    expect(onAskSpeaker).toHaveBeenCalledWith('gilfoyle', 'Why two jobs?');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Because it also signs the tokens.')).toBeTruthy();
    expect(screen.queryByTestId('office-huddle-ask')).toBeNull();

    // Once the answer has been said, the stand-up carries on.
    await advanceOneLine();
    expect(screen.queryByTestId('office-huddle-pinned-gilfoyle')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUDDLE_LINE_PACE_MS + 500);
    });
    expect(screen.getByTestId('office-huddle-seat-dinesh').dataset.speaking).toBe('true');
  });

  it('carries on after you pin a face mid-line, instead of freezing on that line', async () => {
    let cancel = null;
    const narrateLine = vi.fn(
      () =>
        new Promise((resolve) => {
          cancel = () => resolve({ spoken: false, cancelled: true });
          setTimeout(() => resolve({ spoken: false }), 1000);
        })
    );
    render(
      <HuddleOverlay
        huddle={huddle()}
        narrateLine={narrateLine}
        onCancelNarration={() => cancel?.()}
      />
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Erlich/i }));
    // One act per step: effects (and so the pause flag) flush when each closes.
    for (let step = 0; step < 4; step += 1) await advanceOneLine();
    expect(narrateLine.mock.calls.map(([line]) => line.text)).toContain(BEATS[1].text);
  });

  it('takes a raised hand down on Escape instead of ending the stand-up', () => {
    const onHardStop = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onHardStop={onHardStop} onAskSpeaker={vi.fn()} />);
    fireEvent.click(screen.getByTestId('office-huddle-raise-hand'));
    expect(screen.getByTestId('office-huddle-ask')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('office-huddle-ask')).toBeNull();
    expect(onHardStop).not.toHaveBeenCalled();
  });

  it('offers no raised hand when there is nobody to put the question to', () => {
    render(<HuddleOverlay huddle={huddle()} />);
    expect(screen.queryByTestId('office-huddle-raise-hand')).toBeNull();
  });

  it('wraps itself up after the last remark holds', async () => {
    const onHardStop = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onHardStop={onHardStop} />);
    await advanceOneLine();
    await advanceOneLine();
    expect(onHardStop).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUDDLE_TAIL_MS + 20);
    });
    expect(onHardStop).toHaveBeenCalledTimes(1);
  });
});

describe('HuddleOverlay in pair mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOfficeCaptions(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setOfficeCaptions(false);
  });

  function pair(overrides = {}) {
    return huddle({
      mode: 'pair',
      attendees: ['gilfoyle'],
      beats: PAIR_BEATS,
      ...overrides
    });
  }

  it('seats one chair and walks that one voice through its own remarks', async () => {
    const { container } = render(<HuddleOverlay huddle={pair()} />);
    expect(container.querySelectorAll('.office-huddle-seat')).toHaveLength(1);
    expect(screen.getByText(PAIR_BEATS[0].text)).toBeTruthy();
    await advanceOneLine();
    expect(screen.getByText(PAIR_BEATS[1].text)).toBeTruthy();
  });

  // The defining difference. A mob dissolves on the tail timer; somebody who
  // pulled up a chair does not evaporate because they finished a sentence.
  it('stays put after the last remark instead of wrapping itself up', async () => {
    const onHardStop = vi.fn();
    const { container } = render(<HuddleOverlay huddle={pair()} onHardStop={onHardStop} />);
    await advanceOneLine();
    await advanceOneLine();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(HUDDLE_TAIL_MS * 4);
    });
    expect(onHardStop).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="office-huddle"][data-mode="pair"]')).toBeTruthy();
  });

  it('still ends explicitly, and the way out does not sound like a meeting', () => {
    const onHardStop = vi.fn();
    render(<HuddleOverlay huddle={pair()} onHardStop={onHardStop} />);
    const end = screen.getByTestId('office-huddle-end');
    expect(end.textContent).not.toMatch(/Hard stop/);
    fireEvent.click(end);
    expect(onHardStop).toHaveBeenCalledTimes(1);
  });

  it('names the person in the chair while they are still arriving', () => {
    render(<HuddleOverlay huddle={pair({ beats: [], phase: 'gathering' })} />);
    expect(screen.getByRole('status').textContent).toMatch(/Gilfoyle/);
    expect(screen.queryByText('Everyone is wandering over…')).toBeNull();
  });

  // The other half of pairing: they said something, and now it is your turn.
  it('holds the last remark and offers a way back while listening', () => {
    const onPairReply = vi.fn();
    const { container } = render(
      <HuddleOverlay huddle={pair({ phase: 'listening' })} onPairReply={onPairReply} />
    );

    // The line that was just said stays up — blanking it at the moment they are
    // waiting for your answer would be the worst possible time to lose it.
    expect(screen.getByText(PAIR_BEATS[PAIR_BEATS.length - 1].text)).toBeTruthy();
    // And it is not still claiming to be mid-sentence.
    expect(screen.queryByText('Everyone is wandering over…')).toBeNull();
    expect(screen.getByTestId('office-pair-reply')).toBeTruthy();
    expect(container.querySelector('.office-huddle-listening').textContent).toMatch(
      /Bertram Gilfoyle/
    );

    fireEvent.change(screen.getByLabelText(/Answer Bertram Gilfoyle/), {
      target: { value: 'Why does Billing read it?' }
    });
    fireEvent.click(screen.getByTestId('office-pair-reply-send'));
    // Three points were made, so the reply says which one it answers.
    expect(onPairReply).toHaveBeenCalledWith(
      'Why does Billing read it? (about your point: "Which is why Billing reads it.")'
    );
  });

  it('lists their points as topics, and steers the strip and their face to the one you pick', async () => {
    const onPairReply = vi.fn();
    const onAdoptPrompt = vi.fn();
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    setOfficeCaptions(true);
    render(
      <HuddleOverlay
        huddle={pair({ phase: 'listening' })}
        onPairReply={onPairReply}
        onAdoptPrompt={onAdoptPrompt}
        narrateLine={narrateLine}
      />
    );
    const topics = screen.getByTestId('office-pair-reply-topics');
    expect(topics.querySelectorAll('button')).toHaveLength(PAIR_BEATS.length);
    // Their last point is the one in play until you pick another.
    expect(screen.getByTestId('office-pair-reply-topic-2').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByTestId('office-pair-reply-topic-0').textContent).toBe('The Auth box is…');

    fireEvent.click(screen.getByTestId('office-pair-reply-topic-0'));
    expect(screen.getByText(PAIR_BEATS[0].text)).toBeTruthy();
    fireEvent.click(screen.getByTestId('office-pair-reply-chip-why'));
    expect(onPairReply).toHaveBeenCalledWith(
      `Why that? (about your point: "${PAIR_BEATS[0].text}")`
    );
    fireEvent.click(screen.getByTestId('office-pair-reply-do-it'));
    expect(onAdoptPrompt).toHaveBeenCalledWith(PAIR_BEATS[0].text, 'gilfoyle');

    // A click on their face repeats the picked point, not their first or last.
    fireEvent.click(screen.getByTestId('office-pair-reply-topic-1'));
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(narrateLine).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: PAIR_BEATS[1].text })
    );
  });

  it('offers no topics after a one-line turn, where there is nothing to choose between', () => {
    render(
      <HuddleOverlay
        huddle={pair({ phase: 'listening', beats: PAIR_BEATS.slice(0, 1) })}
        onPairReply={vi.fn()}
      />
    );
    expect(screen.queryByTestId('office-pair-reply-topics')).toBeNull();
  });

  it('lets a chip answer without typing, and clears the box after sending', () => {
    const onPairReply = vi.fn();
    render(<HuddleOverlay huddle={pair({ phase: 'listening' })} onPairReply={onPairReply} />);
    const input = screen.getByLabelText(/Answer Bertram Gilfoyle/);

    fireEvent.change(input, { target: { value: 'half a thought' } });
    fireEvent.click(screen.getByTestId('office-pair-reply-chip-show'));
    // A chip is the faster route, so it sends its own words rather than
    // appending to whatever was already in the box.
    expect(onPairReply).toHaveBeenCalledWith(expect.stringMatching(/^Show me \(about your point/));
    expect(input.value).toBe('');
  });

  it('stops accepting answers while their reply is in flight', () => {
    const onPairReply = vi.fn();
    const { container } = render(
      <HuddleOverlay
        huddle={pair({ phase: 'listening', awaitingReply: true })}
        onPairReply={onPairReply}
      />
    );
    expect(screen.getByTestId('office-pair-reply').dataset.busy).toBe('true');
    expect(screen.getByTestId('office-pair-reply-send').disabled).toBe(true);
    expect(screen.getByTestId('office-pair-reply-chip-why').disabled).toBe(true);
    // The wait reads as a person thinking, not as a hung UI.
    expect(container.querySelector('.office-huddle-listening').textContent).toMatch(/Thinking/);
  });

  // This strip ships zh-CN and zh-TW copy, so the composition key is not
  // hypothetical: Enter chooses a candidate, and sending it would post half a
  // word — which `busy` then locks away until the partner answers.
  it('treats Enter as an IME commit, not a send, while composing', () => {
    const onPairReply = vi.fn();
    render(<HuddleOverlay huddle={pair({ phase: 'listening' })} onPairReply={onPairReply} />);
    const input = screen.getByLabelText(/Answer Bertram Gilfoyle/);

    fireEvent.change(input, { target: { value: 'nizhe' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onPairReply).not.toHaveBeenCalled();
    expect(input.value).toBe('nizhe');

    // The same key once the candidate is committed does send.
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPairReply).toHaveBeenCalledWith(expect.stringMatching(/^nizhe \(about your point/));
  });

  // Do it used to ride the speech bubble, where it overlapped the canvas and
  // repeated the line they had just said. In a pair it is one of your answers.
  it('keeps Do it out of the bubble and offers it as a reply chip', async () => {
    const onAdoptPrompt = vi.fn();
    const { rerender } = render(<HuddleOverlay huddle={pair()} onAdoptPrompt={onAdoptPrompt} />);
    await advanceOneLine();
    await advanceOneLine();
    expect(screen.queryByTestId('office-huddle-do-it-gilfoyle')).toBeNull();

    rerender(
      <HuddleOverlay
        huddle={pair({ phase: 'listening' })}
        onAdoptPrompt={onAdoptPrompt}
        onPairReply={vi.fn()}
      />
    );
    expect(screen.queryByTestId('office-huddle-do-it-gilfoyle')).toBeNull();
    fireEvent.click(screen.getByTestId('office-pair-reply-do-it'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split Auth', 'gilfoyle');
  });

  // Voice-first holds through your turn: the line you just heard aloud does not
  // come back as a bubble the moment they stop talking.
  it('does not re-show a voiced line as a bubble while listening', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: true }));
    const last = PAIR_BEATS[PAIR_BEATS.length - 1].text;
    const { rerender } = render(<HuddleOverlay huddle={pair()} narrateLine={narrateLine} />);
    await advanceSpokenLine();
    await advanceSpokenLine();
    await advanceSpokenLine();
    rerender(
      <HuddleOverlay
        huddle={pair({ phase: 'listening' })}
        narrateLine={narrateLine}
        onPairReply={vi.fn()}
      />
    );
    expect(screen.queryByText(last)).toBeNull();
    // Nor does the seat claim they are still talking.
    expect(document.querySelector('.office-huddle-speaking-label')).toBeNull();
  });

  it('still shows the line when voice was unavailable', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    const last = PAIR_BEATS[PAIR_BEATS.length - 1].text;
    const { rerender } = render(<HuddleOverlay huddle={pair()} narrateLine={narrateLine} />);
    await advanceOneLine();
    await advanceOneLine();
    await advanceOneLine();
    rerender(
      <HuddleOverlay
        huddle={pair({ phase: 'listening' })}
        narrateLine={narrateLine}
        onPairReply={vi.fn()}
      />
    );
    expect(screen.getByText(last)).toBeTruthy();
  });

  it('publishes both boxes when a line points at two', () => {
    const beats = [
      {
        speakerId: 'gilfoyle',
        text: 'These two should not talk directly.',
        focusId: 'flowchart-Auth-0',
        alsoFocusId: 'flowchart-Billing-1'
      }
    ];
    const { result } = renderHook(() =>
      useHuddleRingControls({ huddle: pair({ beats, phase: 'listening' }), disabled: true })
    );
    expect(result.current.activeFocusIds).toEqual(['flowchart-Auth-0', 'flowchart-Billing-1']);
  });

  it('lets a mob speaker point at what they mean, and stops while the notebook runs', () => {
    const beats = [{ speakerId: ATTENDEES[0], text: 'Auth again.', focusId: 'flowchart-Auth-0' }];
    const { result, rerender } = renderHook(
      ({ phase }) => useHuddleRingControls({ huddle: huddle({ beats, phase }), disabled: true }),
      { initialProps: { phase: 'speaking' } }
    );
    expect(result.current.activeFocusIds).toEqual(['flowchart-Auth-0']);
    rerender({ phase: 'watching' });
    expect(result.current.activeFocusIds).toEqual([]);
  });

  it('never offers the strip to a mob, which has nobody to answer', () => {
    render(<HuddleOverlay huddle={huddle({ phase: 'listening' })} onPairReply={vi.fn()} />);
    expect(screen.queryByTestId('office-pair-reply')).toBeNull();
  });

  it('offers no strip while they are still talking', () => {
    render(<HuddleOverlay huddle={pair()} onPairReply={vi.fn()} />);
    expect(screen.queryByTestId('office-pair-reply')).toBeNull();
  });

  it('renders nothing when there is no huddle', () => {
    const { container } = render(<HuddleOverlay huddle={null} />);
    expect(container.querySelector('.office-huddle-layer')).toBeNull();
  });
});
