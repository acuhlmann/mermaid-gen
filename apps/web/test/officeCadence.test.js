import { describe, expect, it } from 'vitest';
import { DESK_LLM_CAP, DWELL_LLM_CAP, TALK_LLM_CAP } from '../src/hooks/useDeskActions.js';
import { RUN_REACTION_LLM_CAP } from '../src/hooks/useOfficeRunReactions.js';
import { wanderTripsFor, wanderingSeatIds } from '../src/utils/officeFloorWander.js';
import {
  OFFICE_BATTLES_PER_SESSION,
  OFFICE_DESK_LLM_CAP,
  OFFICE_DWELL_LLM_CAP,
  OFFICE_FIRST_MOMENT_MIN_MS,
  OFFICE_LLM_MOMENT_CAP,
  OFFICE_RUN_REACTION_LLM_CAP,
  OFFICE_TALK_LLM_CAP,
  OFFICE_MIN_GAP_MS,
  OFFICE_SENIOR_EMAILS_PER_SESSION,
  OFFICE_SESSION_MOMENT_CAP,
  OFFICE_DAY_PHASES,
  OFFICE_DAY_PHASE_POLL_MS,
  OFFICE_WALL_CLOCK_POLL_MS,
  officeDayPhaseAt,
  officeWallClockAt,
  wanderBiasAt,
  WANDER_BIAS_WINDOWS,
  OFFICE_WARMUP_GAP_JITTER_MS,
  OFFICE_WARMUP_MIN_GAP_MS,
  OFFICE_WARMUP_MOMENT_COUNT,
  pickNextMoment
} from '../src/utils/officeCadence.js';

const BASE = {
  now: 1_000_000,
  sessionStartedAt: 0,
  lastFiredAt: 0,
  momentCount: 0,
  llmMomentCount: 0,
  meetingInviteCount: 0,
  battleCount: 0,
  hasDiagram: true,
  random: () => 0.5
};

describe('pickNextMoment', () => {
  it('stays quiet during the (short) first stretch of a session', () => {
    expect(
      pickNextMoment({ ...BASE, now: OFFICE_FIRST_MOMENT_MIN_MS - 1, sessionStartedAt: 0 })
    ).toBeNull();
    expect(
      pickNextMoment({ ...BASE, now: OFFICE_FIRST_MOMENT_MIN_MS + 1, sessionStartedAt: 0 })
    ).not.toBeNull();
  });

  it('uses the short warm-up gap for the first few moments', () => {
    const warmup = { ...BASE, momentCount: OFFICE_WARMUP_MOMENT_COUNT - 1 };
    const lastFiredAt = BASE.now - OFFICE_WARMUP_MIN_GAP_MS + 1;
    expect(pickNextMoment({ ...warmup, lastFiredAt, random: () => 0 })).toBeNull();
    const justPastWarmupGap = BASE.now - OFFICE_WARMUP_MIN_GAP_MS - 1;
    expect(
      pickNextMoment({ ...warmup, lastFiredAt: justPastWarmupGap, random: () => 0 })
    ).not.toBeNull();
  });

  it('settles to the jittered cruise gap once warmed up', () => {
    const settled = { ...BASE, momentCount: OFFICE_WARMUP_MOMENT_COUNT };
    // The warm-up gap (even with max jitter) is no longer enough...
    const warmupAgo = BASE.now - (OFFICE_WARMUP_MIN_GAP_MS + OFFICE_WARMUP_GAP_JITTER_MS) - 1;
    expect(pickNextMoment({ ...settled, lastFiredAt: warmupAgo, random: () => 0 })).toBeNull();
    // ...only the multi-minute cruise gap is.
    const cruiseAgo = BASE.now - OFFICE_MIN_GAP_MS - 1;
    expect(pickNextMoment({ ...settled, lastFiredAt: cruiseAgo, random: () => 0 })).not.toBeNull();
  });

  it('goes silent at the session cap', () => {
    expect(pickNextMoment({ ...BASE, momentCount: OFFICE_SESSION_MOMENT_CAP })).toBeNull();
  });

  it('never offers a second meeting invite', () => {
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({ ...BASE, meetingInviteCount: 1, random: Math.random });
      if (moment) expect(moment.kind).not.toBe('meeting-invite');
    }
  });

  it('skips walk-bys and meeting invites when the diagram is empty', () => {
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({ ...BASE, hasDiagram: false, random: Math.random });
      if (moment) expect(['email', 'im', 'coffee', 'battle']).toContain(moment.kind);
    }
  });

  it('caps cubicle battles per session and never spends LLM on them', () => {
    let sawBattle = false;
    for (let i = 0; i < 400; i += 1) {
      const moment = pickNextMoment({ ...BASE, random: Math.random });
      if (moment?.kind === 'battle') {
        sawBattle = true;
        expect(moment.useLlm).toBe(false);
      }
    }
    expect(sawBattle).toBe(true);
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({
        ...BASE,
        battleCount: OFFICE_BATTLES_PER_SESSION,
        random: Math.random
      });
      if (moment) expect(moment.kind).not.toBe('battle');
    }
  });

  it('always marks walk-bys as LLM-backed and stops offering them past the LLM budget', () => {
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({ ...BASE, random: Math.random });
      if (moment?.kind === 'walkby') expect(moment.useLlm).toBe(true);
    }
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({
        ...BASE,
        llmMomentCount: OFFICE_LLM_MOMENT_CAP,
        random: Math.random
      });
      if (moment) {
        expect(moment.kind).not.toBe('walkby');
        expect(moment.useLlm).toBe(false);
      }
    }
  });

  it('keeps coffee and meeting invites free of LLM spend', () => {
    for (let i = 0; i < 200; i += 1) {
      const moment = pickNextMoment({ ...BASE, random: Math.random });
      if (moment && (moment.kind === 'coffee' || moment.kind === 'meeting-invite')) {
        expect(moment.useLlm).toBe(false);
      }
    }
  });

  // Leadership only reaches your inbox once a session, and never on the LLM's
  // dime — the senior tier is a rare event, not another colleague.
  it('offers senior emails as canned-only, capped once per session', () => {
    let sawSenior = false;
    for (let i = 0; i < 400; i += 1) {
      const moment = pickNextMoment({ ...BASE, random: Math.random });
      if (moment?.senior) {
        sawSenior = true;
        expect(moment.kind).toBe('email');
        expect(moment.useLlm).toBe(false);
      }
    }
    expect(sawSenior).toBe(true);

    for (let i = 0; i < 400; i += 1) {
      const moment = pickNextMoment({
        ...BASE,
        seniorEmailCount: OFFICE_SENIOR_EMAILS_PER_SESSION,
        random: Math.random
      });
      if (moment) expect(moment.senior).toBeFalsy();
    }
  });
});

describe('the office LLM budget table', () => {
  /**
   * The caps used to live in three files, two of them module-private. Re-homing
   * them only helps if the consumers keep importing rather than quietly
   * re-declaring a local number, so pin the identity.
   * Static imports (file top) keep the heavy hook graph off the per-test
   * timeout — dynamic import timed out at 30s under full-suite Windows load.
   */
  it('is the single source the hooks re-export', () => {
    expect(DESK_LLM_CAP).toBe(OFFICE_DESK_LLM_CAP);
    expect(TALK_LLM_CAP).toBe(OFFICE_TALK_LLM_CAP);
    expect(RUN_REACTION_LLM_CAP).toBe(OFFICE_RUN_REACTION_LLM_CAP);
    expect(DWELL_LLM_CAP).toBe(OFFICE_DWELL_LLM_CAP);
  });

  /**
   * Isometric slice 19. Somebody looking up because you loitered is caused by
   * you but not *asked for* by you, so it belongs with the run reaction rather
   * than with talking — the same middle rung, for the same reason. Pinned as an
   * inequality rather than a literal so a tuning pass can move the numbers
   * without moving the tiers.
   */
  it('rations an unasked-for remark below a conversation you started', () => {
    expect(OFFICE_DWELL_LLM_CAP).toBeLessThan(OFFICE_TALK_LLM_CAP);
    expect(OFFICE_DWELL_LLM_CAP).toBeGreaterThan(0);
  });

  /**
   * §11's split, as an assertion rather than a comment: a conversation you
   * started must never be rationed harder than an interruption you did not ask
   * for. If a future tuning pass inverts this, the office starts answering
   * typed sentences from a canned bank, which is the exact failure this layer
   * exists to avoid.
   */
  it('gives reactive talk more room than ambient interruption', () => {
    expect(OFFICE_TALK_LLM_CAP).toBeGreaterThan(OFFICE_LLM_MOMENT_CAP);
    expect(OFFICE_DESK_LLM_CAP).toBeGreaterThanOrEqual(OFFICE_RUN_REACTION_LLM_CAP);
  });
});

describe('the office day (slice 20)', () => {
  /** Local-time instant, since the phases are the user's own working day. */
  const at = (h, m = 0) => new Date(2026, 7, 10, h, m, 0, 0);

  it('walks the whole day in order, with afterHours wrapping midnight', () => {
    expect(officeDayPhaseAt(at(6))).toBe('earlyMorning');
    expect(officeDayPhaseAt(at(9, 29))).toBe('earlyMorning');
    expect(officeDayPhaseAt(at(9, 30))).toBe('standUp');
    expect(officeDayPhaseAt(at(10, 29))).toBe('standUp');
    expect(officeDayPhaseAt(at(10, 30))).toBe('midday');
    expect(officeDayPhaseAt(at(16, 29))).toBe('midday');
    expect(officeDayPhaseAt(at(16, 30))).toBe('windDown');
    expect(officeDayPhaseAt(at(19, 59))).toBe('windDown');
    expect(officeDayPhaseAt(at(20))).toBe('afterHours');

    // The overnight tail is the same phase as the late evening, which is why
    // it is the seed value rather than a boundary of its own.
    expect(officeDayPhaseAt(at(23, 59))).toBe('afterHours');
    expect(officeDayPhaseAt(at(0))).toBe('afterHours');
    expect(officeDayPhaseAt(at(5, 59))).toBe('afterHours');
  });

  it('only ever answers with a phase the room knows how to draw', () => {
    // The floor's art table and the stylesheet are both keyed on this list, so
    // a sixth phase added here without art would render as nothing at all.
    for (let h = 0; h < 24; h += 1) {
      for (const m of [0, 29, 30, 59]) {
        expect(OFFICE_DAY_PHASES).toContain(officeDayPhaseAt(at(h, m)));
      }
    }
  });

  it('takes a Date or an epoch, so callers need not agree on one', () => {
    const noon = at(12);
    expect(officeDayPhaseAt(noon)).toBe(officeDayPhaseAt(noon.getTime()));
  });

  it('polls slowly enough to cost nothing and often enough to notice', () => {
    // A phase turns over four times a day; this is a heartbeat, not a clock.
    expect(OFFICE_DAY_PHASE_POLL_MS).toBeGreaterThanOrEqual(30_000);
    expect(OFFICE_DAY_PHASE_POLL_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});

describe('the wall clock (slice 25)', () => {
  const at = (h, m = 0) => new Date(2026, 7, 10, h, m, 0, 0);

  it('points both hands where a wall clock would', () => {
    expect(officeWallClockAt(at(3, 0))).toEqual({ hour: 3, minute: 0, hourDeg: 90, minuteDeg: 0 });
    expect(officeWallClockAt(at(15, 30))).toEqual({
      hour: 15,
      minute: 30,
      hourDeg: 105,
      minuteDeg: 180
    });
    // Midnight and noon both read twelve o'clock.
    expect(officeWallClockAt(at(0)).hourDeg).toBe(0);
    expect(officeWallClockAt(at(12)).hourDeg).toBe(0);
  });

  it('sweeps the hour hand with the minutes instead of jumping it', () => {
    // Half past three sits between the three and the four; a jumping hand
    // would still point at the three and read as two sticks, not a clock.
    expect(officeWallClockAt(at(3, 30)).hourDeg).toBe(105);
    expect(officeWallClockAt(at(3, 45)).hourDeg).toBe(112.5);
  });

  it('wraps both hands inside one full turn', () => {
    for (let h = 0; h < 24; h += 1) {
      for (const m of [0, 15, 30, 45, 59]) {
        const { hourDeg, minuteDeg } = officeWallClockAt(at(h, m));
        expect(hourDeg).toBeGreaterThanOrEqual(0);
        expect(hourDeg).toBeLessThan(360);
        expect(minuteDeg).toBeGreaterThanOrEqual(0);
        expect(minuteDeg).toBeLessThan(360);
      }
    }
  });

  it('takes a Date or an epoch, like the phase dial beside it', () => {
    const quarter = at(15, 15);
    expect(officeWallClockAt(quarter)).toEqual(officeWallClockAt(quarter.getTime()));
  });

  it('polls like a heartbeat, not a metronome', () => {
    // The hands only move once a minute, so polling faster than the phase
    // dial is pure waste, and slower than a minute makes the clock visibly
    // wrong. Same contract shape as the phase poll's own bounds test.
    expect(OFFICE_WALL_CLOCK_POLL_MS).toBeGreaterThanOrEqual(5_000);
    expect(OFFICE_WALL_CLOCK_POLL_MS).toBeLessThanOrEqual(60_000);
  });
});

describe('the afternoon slump (slice 24)', () => {
  const at = (h, m = 0) => new Date(2026, 7, 10, h, m, 0, 0);

  it('opens at two and closes at half four', () => {
    expect(wanderBiasAt(at(13, 59))).toBeNull();
    expect(wanderBiasAt(at(14))?.kind).toBe('coffeeMachine');
    expect(wanderBiasAt(at(16, 29))?.kind).toBe('coffeeMachine');
    expect(wanderBiasAt(at(16, 30))).toBeNull();
  });

  /*
   * The great majority of the day has no bias at all, which is the half that
   * makes the slump readable: a room that drifts somewhere at every hour is a
   * room that drifts nowhere.
   */
  it('is quiet for most of the day', () => {
    let biased = 0;
    for (let h = 0; h < 24; h += 1) {
      for (const m of [0, 30]) if (wanderBiasAt(at(h, m))) biased += 1;
    }
    expect(biased).toBeGreaterThan(0);
    expect(biased).toBeLessThan(8);
  });

  /*
   * It sits deliberately *inside* `midday` rather than being a sixth phase:
   * three in the afternoon looks exactly like eleven in the morning, and a
   * phase is what the room looks like. Asserted so that anybody tempted to
   * promote it has to delete this first.
   */
  it('lives inside a phase rather than being one', () => {
    expect(officeDayPhaseAt(at(15))).toBe('midday');
    expect(OFFICE_DAY_PHASES).not.toContain('slump');
    expect(WANDER_BIAS_WINDOWS.every((w) => w.from < w.until)).toBe(true);
  });

  it('only ever favours a prop somebody can actually be sent to', () => {
    // A window naming a prop with no wander trip is a dial that does nothing,
    // and nothing else would ever notice.
    const reachable = new Set(
      wanderingSeatIds().flatMap((id) => wanderTripsFor(id).map((t) => t.kind))
    );
    expect(reachable.size).toBeGreaterThan(0);
    for (const window of WANDER_BIAS_WINDOWS) {
      expect(reachable, `${window.kind} is not a wander destination`).toContain(window.kind);
      expect(window.weight).toBeGreaterThan(1);
    }
  });

  it('takes a Date or an epoch, like the phase dial beside it', () => {
    const three = at(15);
    expect(wanderBiasAt(three)).toEqual(wanderBiasAt(three.getTime()));
  });
});
