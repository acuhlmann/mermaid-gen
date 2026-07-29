// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HuddleOverlay, {
  HUDDLE_LINE_PACE_MS,
  HUDDLE_TAIL_MS
} from '../src/components/HuddleOverlay.jsx';
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

function huddle(overrides = {}) {
  return {
    id: 'huddle-1',
    attendees: ATTENDEES,
    beats: BEATS,
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
    // The ring arrives before a single word exists — the crowd IS the feedback
    // that the click landed.
    expect(screen.getByText('Everyone is wandering over…')).toBeTruthy();
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
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

  it('hides the remark and names the speaker when voice is on and CC is off', () => {
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
    expect(screen.getByText(/is talking/)).toBeTruthy();
  });

  it('shows the remark text again once CC is on, even with voice speaking', () => {
    setOfficeCaptions(true);
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    expect(screen.getByText(BEATS[0].text)).toBeTruthy();
  });

  it('keeps remarks sequential when voice is off — never reveals the whole ring at once', async () => {
    // useScenePacing dumps every line at once when it has no narrator, which is
    // right for a card of overheard chat and wrong for a ring of faces. The
    // overlay always hands it a narrator to keep the walk one-at-a-time.
    const { container } = render(<HuddleOverlay huddle={huddle()} />);
    expect(container.querySelectorAll('.office-huddle-bubble')).toHaveLength(1);
    await advanceOneLine();
    expect(container.querySelectorAll('.office-huddle-bubble')).toHaveLength(1);
  });

  it('adopts a remark that came with an action prompt', async () => {
    const onAdoptPrompt = vi.fn();
    render(<HuddleOverlay huddle={huddle()} onAdoptPrompt={onAdoptPrompt} />);
    await advanceOneLine();
    fireEvent.click(screen.getByRole('button', { name: /Do it/i }));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split the Auth node in two', 'dinesh');
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

  it('renders nothing when there is no huddle', () => {
    const { container } = render(<HuddleOverlay huddle={null} />);
    expect(container.querySelector('.office-huddle-layer')).toBeNull();
  });
});
