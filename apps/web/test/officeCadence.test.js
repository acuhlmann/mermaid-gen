import { describe, expect, it } from 'vitest';
import { DESK_LLM_CAP, DWELL_LLM_CAP, TALK_LLM_CAP } from '../src/hooks/useDeskActions.js';
import { RUN_REACTION_LLM_CAP } from '../src/hooks/useOfficeRunReactions.js';
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
