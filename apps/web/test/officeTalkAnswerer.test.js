// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import { openTalkPartnersFrom, talkAnswererFrom } from '../src/utils/officeTalkAnswerer.js';
import {
  OFFICE_TALK_OPEN_TICKETS,
  OFFICE_TALK_OPEN_WINDOW_MS
} from '../src/utils/officeCadence.js';
import { OFFICE_WALKBY_LLM_CAST, pickRandomFrom } from '../src/utils/officeCast.js';
import { CAST_TIERS } from '../src/utils/castTiers.js';
import { useDeskActions, DESK_IM_CAST } from '../src/hooks/useDeskActions.js';
import {
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeImPing
} from '../src/state/officeMomentStore.js';

/*
 * Who fields a line you said to nobody in particular.
 *
 * The defect: `talkOutLoud` rolled uniformly over the pool, so an answer to the
 * colleague who had just spoken to you reached them one time in sixteen — on
 * the desk, where the undirected composer is also the only way to reply to a
 * line that landed over your head.
 *
 * These pin the thumb and, just as deliberately, the four cases where it must
 * not apply: nothing spoken, your own line, a typed message, and a partner the
 * answer shape cannot cast.
 */

const SPOKE = (colleagueId, createdAt, extra = {}) => ({
  id: `im-${colleagueId}-${createdAt}`,
  colleagueId,
  body: 'that diagram has eleven boxes',
  channel: 'talk',
  createdAt,
  ...extra
});

/** A random() that walks a fixed list and then repeats its last value. */
const rolls = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};

/**
 * How many evenly spaced rolls make every bucket exact for both pool sizes —
 * the only reason the counts below are `toBe` and not `toBeCloseTo`.
 */
const evenRolls = (...sizes) => {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  return sizes.reduce((lcm, size) => (lcm * size) / gcd(lcm, size), 1) * 10;
};

/** Deterministic scan of [0,1): `n` evenly spaced rolls, no PRNG, no seed. */
const sweep = (n, draw) => {
  const counts = new Map();
  for (let i = 0; i < n; i += 1) {
    const id = draw((i + 0.5) / n);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

describe('openTalkPartnersFrom — whose conversation is still open', () => {
  const NOW = 1_770_000_000_000;

  it('names the colleague who just spoke to you out loud', () => {
    const history = [SPOKE('gilfoyle', NOW - 4_000)];
    expect(openTalkPartnersFrom(history, { nowMs: NOW })).toEqual(['gilfoyle']);
  });

  /*
   * The one that stops a coin flip bootstrapping itself. Your own line is
   * written into `imHistory` attributed to whoever the roll just picked —
   * including on the `ignored` shape, where nobody answered at all. Counting it
   * would let that draw become your "open partner" for the rest of the window.
   */
  it('does not count your own line as somebody answering', () => {
    const history = [SPOKE('hr', NOW - 2_000, { outbound: true })];
    expect(openTalkPartnersFrom(history, { nowMs: NOW })).toEqual([]);
  });

  /*
   * The medium rule, and the case where getting it wrong inverts the feature
   * rather than weakening it: `persistImHistory` keeps Slop Chat™ lines and
   * drops talk, so a restored session's history is *entirely* typed.
   */
  it('ignores typed Slop Chat lines, however recent', () => {
    const typed = { ...SPOKE('dinesh', NOW - 1_000) };
    delete typed.channel;
    expect(openTalkPartnersFrom([typed], { nowMs: NOW })).toEqual([]);
  });

  it('closes the conversation once the window has passed', () => {
    const history = [SPOKE('jared', NOW - (OFFICE_TALK_OPEN_WINDOW_MS + 1_000))];
    expect(openTalkPartnersFrom(history, { nowMs: NOW })).toEqual([]);
    // …and the same line one second inside it is still open, so the assertion
    // above is the window working rather than the scan finding nothing.
    expect(openTalkPartnersFrom(history, { nowMs: NOW - 2_000 })).toEqual(['jared']);
  });

  it('puts the most recent speaker first and never repeats a name', () => {
    const history = [
      SPOKE('hr', NOW - 50_000),
      SPOKE('gilfoyle', NOW - 30_000),
      SPOKE('hr', NOW - 10_000)
    ];
    expect(openTalkPartnersFrom(history, { nowMs: NOW })).toEqual(['hr', 'gilfoyle']);
  });

  it('survives an empty, missing or malformed history', () => {
    expect(openTalkPartnersFrom(null, { nowMs: NOW })).toEqual([]);
    expect(openTalkPartnersFrom([], { nowMs: NOW })).toEqual([]);
    expect(openTalkPartnersFrom([{ channel: 'talk' }, SPOKE('', NOW)], { nowMs: NOW })).toEqual([]);
  });
});

describe('talkAnswererFrom — the thumb, and where it must not reach', () => {
  /*
   * The negative control, and the one that makes every number below readable:
   * with nothing open, this is byte-for-byte the uniform draw the channel
   * shipped with, on the same roll.
   */
  it('is the old uniform draw when no conversation is open', () => {
    for (const roll of [0, 0.1, 0.37, 0.5, 0.74, 0.99]) {
      expect(talkAnswererFrom(DESK_IM_CAST, [], () => roll)).toBe(
        pickRandomFrom(DESK_IM_CAST, () => roll)
      );
    }
  });

  it('enters an open partner exactly OFFICE_TALK_OPEN_TICKETS extra times', () => {
    const n = evenRolls(DESK_IM_CAST.length, DESK_IM_CAST.length + OFFICE_TALK_OPEN_TICKETS);
    const open = sweep(n, (r) => talkAnswererFrom(DESK_IM_CAST, ['gilfoyle'], () => r));
    const cold = sweep(n, (r) => talkAnswererFrom(DESK_IM_CAST, [], () => r));

    // One entry each before; one plus the tickets after. The sweep is an even
    // scan of [0,1), so these are exact rather than approximate.
    expect(cold.get('gilfoyle')).toBe(n / DESK_IM_CAST.length);
    expect(open.get('gilfoyle')).toBe(
      ((1 + OFFICE_TALK_OPEN_TICKETS) * n) / (DESK_IM_CAST.length + OFFICE_TALK_OPEN_TICKETS)
    );
    expect(open.get('gilfoyle')).toBeGreaterThan(cold.get('gilfoyle'));
  });

  /*
   * A thumb, not a gate — the half the directed target chip depends on. If an
   * open conversation captured the undirected act, the composer's two acts
   * would collapse into one and the chip would be decoration.
   */
  it('leaves the room more likely to answer than the person you are talking to', () => {
    const n = evenRolls(DESK_IM_CAST.length, DESK_IM_CAST.length + OFFICE_TALK_OPEN_TICKETS);
    const open = sweep(n, (r) => talkAnswererFrom(DESK_IM_CAST, ['gilfoyle'], () => r));
    expect(open.get('gilfoyle')).toBeLessThan(n / 2);
    // Nobody is ever silenced by it, either.
    for (const id of DESK_IM_CAST) expect(open.get(id)).toBeGreaterThan(0);
  });

  it('gives no tickets to a partner this answer shape cannot cast', () => {
    const n = evenRolls(
      OFFICE_WALKBY_LLM_CAST.length,
      OFFICE_WALKBY_LLM_CAST.length + OFFICE_TALK_OPEN_TICKETS
    );
    // Belson is a senior: he can shout from the glass room but cannot walk here.
    expect(CAST_TIERS.senior).toContain('belson');
    const walkover = sweep(n, (r) => talkAnswererFrom(OFFICE_WALKBY_LLM_CAST, ['belson'], () => r));
    expect(walkover.get('belson')).toBeUndefined();
    expect([...walkover.keys()].sort()).toEqual([...OFFICE_WALKBY_LLM_CAST].sort());
    // Each eligible name keeps exactly the share it had, so the pool was not
    // merely filtered — it was never extended.
    for (const id of OFFICE_WALKBY_LLM_CAST) {
      expect(walkover.get(id)).toBe(n / OFFICE_WALKBY_LLM_CAST.length);
    }
  });

  it('rolls back to uniform on a zero dial rather than on a revert', () => {
    for (const roll of [0.05, 0.42, 0.97]) {
      expect(talkAnswererFrom(DESK_IM_CAST, ['gilfoyle'], () => roll, 0)).toBe(
        pickRandomFrom(DESK_IM_CAST, () => roll)
      );
    }
  });

  it('returns null only when there is nobody to draw', () => {
    expect(talkAnswererFrom([], ['gilfoyle'], () => 0)).toBeNull();
    expect(talkAnswererFrom(null, [], () => 0)).toBeNull();
  });
});

/* ── End to end, through the verb the composer actually calls ───────────── */

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

describe('talkOutLoud answers the conversation you are in', () => {
  // Bands over TALK_ANSWER_WEIGHTS, as `deskTalkChannel.test.jsx` derives them:
  // shout < 0.595, walkover < 0.833, ignored above.
  const SHOUT = 0.1;
  const WALKOVER = 0.7;
  const IGNORED = 0.95;

  function setup(random) {
    return renderHook(() =>
      useDeskActions({
        getDiagramSource: () => 'flowchart TD\n  A-->B',
        getContentType: () => 'mermaid',
        getSessionId: () => 'sess',
        replyDelayMs: () => 0,
        random
      })
    );
  }

  /*
   * The defect, end to end. A colleague speaks to you at your desk; you answer
   * into the room, because that is the only reply affordance the desk has. The
   * roll is the *same* in both halves — only the open conversation differs — so
   * this is the thumb and not a different dice throw.
   */
  it('hands a shout to whoever just spoke to you, on a roll that used to miss them', async () => {
    const LATE =
      (DESK_IM_CAST.length + OFFICE_TALK_OPEN_TICKETS - 1.5) /
      (DESK_IM_CAST.length + OFFICE_TALK_OPEN_TICKETS);

    const cold = setup(rolls(SHOUT, LATE));
    let coldOutcome;
    await act(async () => {
      coldOutcome = await cold.result.current.talkOutLoud(null, { userMessage: 'eleven boxes?' });
    });
    expect(coldOutcome.shape).toBe('shout');
    expect(coldOutcome.colleagueId).not.toBe('gilfoyle');

    _resetForTests();
    pushOfficeImPing({ colleagueId: 'gilfoyle', body: 'that is eleven boxes', channel: 'talk' });
    const open = setup(rolls(SHOUT, LATE));
    let outcome;
    await act(async () => {
      outcome = await open.result.current.talkOutLoud(null, { userMessage: 'eleven boxes?' });
    });
    expect(outcome.shape).toBe('shout');
    expect(outcome.colleagueId).toBe('gilfoyle');
    // And the answer is delivered as that same person, not merely attributed:
    // a reply from a different mouth is the walk-over bug one slice over.
    expect(delivery.deliverLlmMoment).toHaveBeenCalledWith(
      'im',
      expect.anything(),
      expect.objectContaining({ channel: 'talk', colleagueId: 'gilfoyle' })
    );
  });

  it('still sends a body that can reach you when your partner is a senior', async () => {
    pushOfficeImPing({ colleagueId: 'belson', body: 'per my last email', channel: 'talk' });
    for (const seed of [0.62, 0.7, 0.78, 0.82]) {
      const { result } = setup(rolls(WALKOVER, seed));
      let outcome;
      // eslint-disable-next-line no-await-in-loop -- one visit per seed, by design
      await act(async () => {
        outcome = await result.current.talkOutLoud(null, { userMessage: 'thoughts on this?' });
      });
      expect(outcome.shape).toBe('walkover');
      expect(outcome.colleagueId).not.toBe('belson');
      expect(OFFICE_WALKBY_LLM_CAST).toContain(outcome.colleagueId);
    }
  });

  /*
   * The bootstrap guard, from the other side. Nobody answered, so the room is
   * exactly as open as it was before you spoke — even though your own line is
   * now in `imHistory` wearing the drawn colleague's name.
   */
  it('does not treat a line nobody answered as a conversation', async () => {
    const { result } = setup(rolls(IGNORED, 0.5));
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud(null, { userMessage: 'morning' });
    });
    expect(outcome.shape).toBe('ignored');
    const history = getOfficeSnapshot().imHistory;
    expect(history.filter((m) => m.outbound)).toHaveLength(1);
    expect(openTalkPartnersFrom(history)).toEqual([]);
  });

  it('leaves a named answer exactly as it was — the chip is still the certain act', async () => {
    pushOfficeImPing({ colleagueId: 'gilfoyle', body: 'that is eleven boxes', channel: 'talk' });
    const { result } = setup(rolls(IGNORED, 0.99));
    let outcome;
    await act(async () => {
      outcome = await result.current.talkOutLoud('hr', { userMessage: 'about the survey' });
    });
    expect(outcome.shape).toBe('turnedTo');
    expect(outcome.colleagueId).toBe('hr');
  });
});
