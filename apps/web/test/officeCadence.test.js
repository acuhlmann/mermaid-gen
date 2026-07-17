import { describe, expect, it } from 'vitest';
import {
  OFFICE_BATTLES_PER_SESSION,
  OFFICE_FIRST_MOMENT_MIN_MS,
  OFFICE_LLM_MOMENT_CAP,
  OFFICE_MIN_GAP_MS,
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
});
