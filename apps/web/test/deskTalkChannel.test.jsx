// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import DeskTalkComposer from '../src/components/DeskTalkComposer.jsx';
import OfficeDeskSpeech from '../src/components/OfficeDeskSpeech.jsx';
import { useDeskActions, TALK_LLM_CAP, DESK_LLM_CAP } from '../src/hooks/useDeskActions.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';
import { OFFICE_WALKBY_LLM_CAST } from '../src/utils/officeCast.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';

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

  // Lane 1 has had dictation since the beginning, which left the band reading
  // "the expensive input takes dictation, the free one makes you type" —
  // backwards for the one lane whose whole fiction is that you are talking.
  it('offers dictation, because the lane is about speaking rather than writing', () => {
    render(<DeskTalkComposer onSubmit={vi.fn()} />);
    const mic = document.querySelector('.desk-talk-mic');
    expect(mic).toBeTruthy();
    expect(mic.textContent).toMatch(/🎤|🎙️/);
    // The shared button, so hold-to-speak / tap-to-toggle / unsupported-browser
    // handling cannot drift from the other four voice surfaces.
    expect(mic.classList.contains('is-mic-toggle')).toBe(true);
  });

  it('will not take dictation into a field it will not let you send', () => {
    render(<DeskTalkComposer onSubmit={vi.fn()} disabled disabledReason="in a meeting" />);
    expect(document.querySelector('.desk-talk-mic').disabled).toBe(true);
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

  // Headphones off = hear the office: do not flash the spoken line as text
  // before TTS starts (walk-by already gates on the narration preference).
  it('hides the remark immediately when narration is on and CC is off', () => {
    const narrateLine = vi.fn(() => new Promise(() => {}));
    render(<OfficeDeskSpeech line={LINE} narration narrateLine={narrateLine} captions={false} />);
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

  // Physical speech is not Slop Chat — no "open the thread" that dumps the
  // line into the messenger window.
  it('does not offer a Slop Chat thread link for desk speech', () => {
    render(<OfficeDeskSpeech line={LINE} onOpenThread={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Open the thread/i })).toBeNull();
  });

  it('renders nothing without a line', () => {
    const { container } = render(<OfficeDeskSpeech line={null} />);
    expect(container.querySelector('.office-desk-speech-stack')).toBeNull();
  });

  it('dismisses the card without touching history', () => {
    render(<OfficeDeskSpeech line={LINE} />);
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
    // Named: somebody specific is about to answer, so the card can say where.
    expect(screen.getByRole('status').textContent).toMatch(/At your desk/i);
  });

  // Undirected, nobody picked yet — and one of the outcomes is that nobody
  // will. Heading it "At your desk" would promise somebody standing there
  // before the roll, and then contradict itself when the room ignored you.
  it('waits under your own half of the exchange when you addressed the room', () => {
    render(<OfficeDeskSpeech pending pendingColleagueId={null} />);
    const text = screen.getByRole('status').textContent;
    expect(text).toMatch(/To the room/i);
    expect(text).not.toMatch(/At your desk/i);
  });

  // Two of the four answer shapes reach this card, and they are told apart by
  // one marker: unmarked is somebody an arm's length away, `across` is somebody
  // shouting back from their own desk.
  it('says where the voice came from when it was shouted across the room', () => {
    const { rerender } = render(<OfficeDeskSpeech line={LINE} />);
    expect(screen.getByRole('status').textContent).toMatch(/At your desk/i);

    rerender(<OfficeDeskSpeech line={{ ...LINE, voice: 'across' }} />);
    expect(screen.getByRole('status').textContent).toMatch(/across the room/i);
    // The line itself is unchanged — distance is chrome, not a second copy of
    // the same words.
    expect(screen.getByText(LINE.body)).toBeTruthy();
  });

  // Saying something into an office and getting no acknowledgement at all is
  // indistinguishable from a send button that failed. The beat is what makes it
  // read as the room rather than as the app.
  it('shows that nobody looked up, and clears itself', () => {
    vi.useFakeTimers();
    try {
      render(<OfficeDeskSpeech line={null} ignoredSeq={1} />);
      expect(screen.getByTestId('desk-speech-ignored')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByTestId('desk-speech-ignored')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // What you last heard from somebody else is not an answer to what you just
  // said, so the silence has to beat a stale line rather than sit under it.
  it('beats a stale line, which is not an answer to what you just said', () => {
    render(<OfficeDeskSpeech line={LINE} ignoredSeq={1} />);
    expect(screen.getByTestId('desk-speech-ignored')).toBeTruthy();
    expect(screen.queryByText(LINE.body)).toBeNull();
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

  // ── The four answer shapes (see `talkOutLoud`) ──────────────────────────
  //
  // Saying something to an open-plan room used to have exactly one outcome —
  // a reply card, every time, from somebody who had apparently been waiting for
  // you to speak. These pin the three that fix that, plus the one that already
  // existed, by driving `random` at each weight band rather than by mocking the
  // roll: the weights are the design, so a test that stubbed `pickTalkAnswer`
  // would keep passing after somebody re-tuned them to never walk over.
  //
  // Bands over TALK_ANSWER_WEIGHTS ([shout 5][walkover 2][ignored 1.4], total
  // 8.4): shout < 0.595, walkover < 0.833, ignored above.
  const SHOUT_ROLL = 0.1;
  const WALKOVER_ROLL = 0.7;
  const IGNORED_ROLL = 0.95;

  it('shouts back from across the room — the common case, and no longer the only one', async () => {
    const { result } = setup({ random: () => SHOUT_ROLL });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'anyone seen the spec?' });
    });

    expect(outcome.shape).toBe('shout');
    expect(outcome.ok).toBe(true);
    expect(delivery.deliverLlmMoment).toHaveBeenCalledWith(
      'im',
      expect.anything(),
      // `voice: 'across'` is what lets the desk card say where the voice came
      // from; `outLoud` is what stops the server framing it as a chat message.
      expect.objectContaining({ channel: 'talk', voice: 'across', situation: 'outLoud' })
    );
  });

  // The ask this whole slice is built around: somebody who comes to your desk
  // must be a *walk-by*, because that is the moment with a floor renderer who
  // actually gets up and walks (`FloorWalker`) and a desk renderer who leans
  // over your shoulder (`OfficeWalkBy`).
  it('sends somebody over as a walk-by, so the floor can draw them walking', async () => {
    const { result } = setup({ random: () => WALKOVER_ROLL, replyDelayMs: () => 0 });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'is this over-engineered?' });
    });

    expect(outcome.shape).toBe('walkover');
    expect(delivery.deliverLlmMoment).toHaveBeenCalledWith(
      'walkby',
      expect.anything(),
      expect.objectContaining({ situation: 'walkover', colleagueId: outcome.colleagueId })
    );
    // The person who answers is the person who walks: a walk-over that fell back
    // to the canned bank's own colleague would put a different face at your desk
    // from the one the pending line named.
    expect(delivery.deliverLlmMoment.mock.calls[0][2].replyContext.colleagueId).toBe(
      outcome.colleagueId
    );
  });

  // A voice can come from anywhere in the directory; a body has to be able to
  // get here. The senior tier sits inside the sealed glass room, so a walk-over
  // by one of them would be routed out through the wall.
  it('only sends over somebody who can actually walk to your desk', async () => {
    for (const seed of [0.62, 0.7, 0.78, 0.82]) {
      const { result } = setup({ random: () => seed, replyDelayMs: () => 0 });
      let outcome;
      await act(async () => {
        outcome = await result.current.talkOutLoud(null, { userMessage: 'thoughts on this?' });
      });
      expect(outcome.shape).toBe('walkover');
      expect(OFFICE_WALKBY_LLM_CAST).toContain(outcome.colleagueId);
      expect(CAST_TIERS.senior).not.toContain(outcome.colleagueId);
    }
  });

  it('lets the room ignore you, and still records that you said it', async () => {
    const { result } = setup({ random: () => IGNORED_ROLL, replyDelayMs: () => 0 });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'morning' });
    });

    expect(outcome.shape).toBe('ignored');
    expect(outcome.ok).toBe(false);
    // Nobody answered — nothing was delivered, by either rung.
    expect(delivery.deliverLlmMoment).not.toHaveBeenCalled();
    expect(delivery.deliverCannedMoment).not.toHaveBeenCalled();
    // But you did say it, and the next thing that colleague says should know.
    expect(getOfficeSnapshot().imHistory.filter((m) => m.outbound)).toHaveLength(1);
  });

  // Naming somebody is not a gamble — they are looking at you.
  it('always answers when you turned to somebody, whatever the dice say', async () => {
    const { result } = setup({ random: () => IGNORED_ROLL, replyDelayMs: () => 0 });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud('gilfoyle', { userMessage: 'thoughts?' });
    });

    expect(outcome.shape).toBe('turnedTo');
    expect(outcome.ok).toBe(true);
    expect(delivery.deliverLlmMoment).toHaveBeenCalledWith(
      'im',
      expect.anything(),
      expect.objectContaining({ situation: 'turnedTo', colleagueId: 'gilfoyle' })
    );
    // They are beside you, so there is nothing to mark: unmarked *is* "at your
    // desk", which is what the card has always assumed.
    expect(delivery.deliverLlmMoment.mock.calls[0][2].voice).toBeUndefined();
  });

  // A walk-over's whole point is that they came to look at your screen, and its
  // prompt is told to name something visible on it. With nothing on the canvas
  // there is nothing to have got up for.
  it('never sends anybody over to look at an empty canvas', async () => {
    const { result } = setup({
      getDiagramSource: () => '   ',
      random: () => WALKOVER_ROLL,
      replyDelayMs: () => 0
    });
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'anyone about?' });
    });
    expect(outcome.shape).not.toBe('walkover');
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
