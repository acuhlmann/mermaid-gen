// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import DeskTalkComposer from '../src/components/DeskTalkComposer.jsx';
import OfficeDeskSpeech from '../src/components/OfficeDeskSpeech.jsx';
import { useDeskActions, TALK_LLM_CAP, DESK_LLM_CAP } from '../src/hooks/useDeskActions.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';

vi.mock('../src/utils/officeMomentDelivery.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    deliverLlmMoment: vi.fn(),
    deliverCannedMoment: vi.fn()
  };
});

const delivery = await import('../src/utils/officeMomentDelivery.js');

beforeEach(() => {
  _resetForTests();
  delivery.deliverLlmMoment.mockReset().mockResolvedValue(true);
  delivery.deliverCannedMoment.mockReset().mockReturnValue(true);
});

afterEach(() => cleanup());

describe('DeskTalkComposer', () => {
  it('sends undirected talk with a null colleague — someone apt answers', () => {
    const onSubmit = vi.fn();
    render(<DeskTalkComposer onSubmit={onSubmit} />);

    expect(screen.queryByTestId('desk-talk-target')).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'is this over-engineered?' }
    });
    fireEvent.click(screen.getByTestId('desk-talk-send'));

    expect(onSubmit).toHaveBeenCalledWith(null, 'is this over-engineered?');
  });

  it('sends directed talk with the addressed colleague id', () => {
    const onSubmit = vi.fn();
    render(<DeskTalkComposer target="gilfoyle" onSubmit={onSubmit} />);

    expect(screen.getByTestId('desk-talk-target')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'thoughts?' } });
    fireEvent.submit(screen.getByTestId('desk-talk-composer'));

    expect(onSubmit).toHaveBeenCalledWith('gilfoyle', 'thoughts?');
  });

  it('clears the target back to the room', () => {
    const onClearTarget = vi.fn();
    render(<DeskTalkComposer target="jared" onSubmit={vi.fn()} onClearTarget={onClearTarget} />);
    fireEvent.click(screen.getByTestId('desk-talk-target'));
    expect(onClearTarget).toHaveBeenCalledTimes(1);
  });

  it('refuses to send an empty or whitespace line', () => {
    const onSubmit = vi.fn();
    render(<DeskTalkComposer onSubmit={onSubmit} />);
    expect(screen.getByTestId('desk-talk-send').disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(screen.getByTestId('desk-talk-send').disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('empties the field after sending so the next line starts clean', () => {
    render(<DeskTalkComposer onSubmit={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'ship it' } });
    fireEvent.submit(screen.getByTestId('desk-talk-composer'));
    expect(input.value).toBe('');
  });
});

describe('OfficeDeskSpeech', () => {
  const LINE = { id: 'im-1', colleagueId: 'gilfoyle', body: 'That is three services too many.' };

  it('speaks the line itself, not an announcement that someone messaged you', () => {
    render(<OfficeDeskSpeech line={LINE} />);
    expect(screen.getByText('That is three services too many.')).toBeTruthy();
  });

  it('hides the remark while narration speaks and CC is off', async () => {
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    render(<OfficeDeskSpeech line={LINE} narration narrateLine={narrateLine} captions={false} />);
    await waitFor(() =>
      expect(narrateLine).toHaveBeenCalledWith({
        speakerId: 'gilfoyle',
        text: LINE.body
      })
    );
    expect(screen.queryByText(LINE.body)).toBeNull();
    expect(screen.getByText(/Gilfoyle/)).toBeTruthy();
  });

  it('shows the remark when narration fails and CC stays off', async () => {
    render(
      <OfficeDeskSpeech
        line={LINE}
        narration
        narrateLine={vi.fn(() => Promise.resolve({ spoken: false }))}
        captions={false}
      />
    );
    expect(await screen.findByText(LINE.body)).toBeTruthy();
  });

  it('renders nothing without a line', () => {
    const { container } = render(<OfficeDeskSpeech line={null} />);
    expect(container.querySelector('.office-desk-speech-stack')).toBeNull();
  });

  it('dismisses the card without touching the thread', () => {
    render(<OfficeDeskSpeech line={LINE} onOpenThread={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to work/i }));
    expect(screen.queryByText('That is three services too many.')).toBeNull();
  });

  // ADR-0010: a remark can carry a trigger, but only the user pulls it.
  it('offers Do it only when the line carries a pitch', () => {
    const onAdoptPrompt = vi.fn();
    const { rerender } = render(<OfficeDeskSpeech line={LINE} onAdoptPrompt={onAdoptPrompt} />);
    expect(screen.queryByTestId('desk-speech-adopt')).toBeNull();

    rerender(
      <OfficeDeskSpeech
        line={{ ...LINE, actionPrompt: 'Collapse the three services into one.' }}
        onAdoptPrompt={onAdoptPrompt}
      />
    );
    fireEvent.click(screen.getByTestId('desk-speech-adopt'));
    expect(onAdoptPrompt).toHaveBeenCalledWith('Collapse the three services into one.', 'gilfoyle');
  });

  it('shows who is looking up while the reply is in flight', () => {
    render(<OfficeDeskSpeech pending pendingColleagueId="jared" />);
    expect(screen.getByRole('status').textContent).toMatch(/looks up/i);
  });
});

describe('talkOutLoud', () => {
  function setup(params = {}) {
    return renderHook(() =>
      useDeskActions({
        getDiagramSource: () => 'flowchart TD\n  A-->B',
        getContentType: () => 'mermaid',
        getSessionId: () => 'sess',
        random: () => 0,
        ...params
      })
    );
  }

  it('records your line first, so the exchange reads as a thread', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.talkOutLoud('gilfoyle', { userMessage: 'is this over-engineered?' });
    });

    const mine = getOfficeSnapshot().imHistory.filter((m) => m.outbound);
    expect(mine).toHaveLength(1);
    expect(mine[0].body).toBe('is this over-engineered?');
    expect(mine[0].colleagueId).toBe('gilfoyle');
    expect(mine[0].channel).toBe('talk');
  });

  it('picks somebody apt when nobody was addressed', async () => {
    const { result } = setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'anyone seen the spec?' });
    });
    expect(outcome.ok).toBe(true);
    expect(typeof outcome.colleagueId).toBe('string');
    expect(outcome.colleagueId.length).toBeGreaterThan(0);
  });

  it('tags the reply as talk so it answers at your desk, not as a notification', async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.talkOutLoud('jared', { userMessage: 'thoughts?' });
    });
    expect(delivery.deliverLlmMoment).toHaveBeenCalledWith(
      'im',
      expect.anything(),
      expect.objectContaining({ channel: 'talk', colleagueId: 'jared' })
    );
  });

  // The whole reason the channel needed its own budget: three ambient calls is
  // three sentences, after which a conversation goes canned and reads broken.
  it('spends its own budget, not the ambient desk allowance', async () => {
    expect(TALK_LLM_CAP).toBeGreaterThan(DESK_LLM_CAP);
    const { result } = setup();
    for (let i = 0; i < DESK_LLM_CAP + 2; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- turns are sequential by nature
      await act(async () => {
        await result.current.talkOutLoud('gilfoyle', { userMessage: `turn ${i}` });
      });
    }
    // Still reaching the LLM after the ambient cap would have been exhausted.
    expect(delivery.deliverLlmMoment.mock.calls.length).toBe(DESK_LLM_CAP + 2);
  });

  it('says nothing when the line is blank', async () => {
    const { result } = setup();
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: '   ' });
    });
    expect(outcome.ok).toBe(false);
    expect(getOfficeSnapshot().imHistory.filter((m) => m.outbound)).toHaveLength(0);
  });

  it('holds your tongue while you are in a meeting', async () => {
    const { result } = setup({ meetingActive: true });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud('jared', { userMessage: 'quick one' });
    });
    expect(outcome.ok).toBe(false);
    expect(delivery.deliverLlmMoment).not.toHaveBeenCalled();
  });

  // Unlike the ambient verbs: talking to the room while a run streams is
  // exactly when you would do it.
  it('talks over a streaming run', async () => {
    const { result } = setup({ pause: true });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud('jared', { userMessage: 'while that cooks' });
    });
    expect(outcome.ok).toBe(true);
  });
});
