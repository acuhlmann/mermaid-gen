// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function huddle(overrides = {}) {
  return {
    id: 'huddle-1',
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

  it('hides remark text when voice is on and CC is off — the highlighted face is enough', () => {
    const { container } = render(
      <HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />
    );
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
    expect(screen.queryByText(/is talking/)).toBeNull();
    expect(container.querySelectorAll('.office-huddle-bubble')).toHaveLength(0);
    expect(container.querySelector('[data-speaking="true"]')).toBeTruthy();
  });

  it('shows Do it in the chrome when ring controls are lifted to OfficeLayer', async () => {
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
    expect(screen.getAllByRole('button', { name: /Do it/i }).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Do it/i })[0]);
    expect(onAdoptPrompt).toHaveBeenCalledWith('Split the Auth node in two', 'dinesh');
  });

  it('shows Do it in the chrome when voice is on and the beat has an action prompt', async () => {
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    await advanceSpokenLine();
    expect(screen.queryByText(BEATS[1].text)).toBeNull();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
    expect(document.querySelectorAll('.office-huddle-bubble')).toHaveLength(0);
  });

  it('shows the remark text again once CC is on, even with voice speaking', () => {
    setOfficeCaptions(true);
    render(<HuddleOverlay huddle={huddle()} narrateLine={vi.fn(async () => ({ spoken: true }))} />);
    expect(screen.getByText(BEATS[0].text)).toBeTruthy();
  });

  it('keeps remarks sequential when voice is off — never reveals the whole ring at once', async () => {
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

  it('shows Do it in the chrome when captions are on', async () => {
    setOfficeCaptions(true);
    render(<HuddleOverlay huddle={huddle()} />);
    await advanceOneLine();
    expect(screen.getByText(BEATS[1].text)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
  });

  it('repeats a pinned remark aloud instead of flashing stale text', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: true }));
    render(<HuddleOverlay huddle={huddle()} narrateLine={narrateLine} />);
    await advanceOneLine();
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.getByTestId('office-huddle-pinned-gilfoyle')).toBeTruthy();
    expect(screen.queryByText(BEATS[0].text)).toBeNull();
    expect(screen.queryByText(/is talking/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Do it/i })).toBeNull();
    expect(narrateLine).toHaveBeenCalledWith(
      expect.objectContaining({ speakerId: 'gilfoyle', text: BEATS[0].text })
    );
  });

  it('does not show Do it on a pinned head unless the beat has an action prompt', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    render(<HuddleOverlay huddle={huddle()} narrateLine={narrateLine} />);
    fireEvent.click(screen.getByRole('button', { name: /Pin .*Gilfoyle/i }));
    expect(screen.queryByRole('button', { name: /Do it/i })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /Do it/i }));
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
