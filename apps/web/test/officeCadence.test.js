import { describe, expect, it } from 'vitest';
import {
  OFFICE_FIRST_MOMENT_MIN_MS,
  OFFICE_LLM_MOMENT_CAP,
  OFFICE_MIN_GAP_MS,
  OFFICE_SESSION_MOMENT_CAP,
  pickNextMoment
} from '../src/utils/officeCadence.js';

const BASE = {
  now: 1_000_000,
  sessionStartedAt: 0,
  lastFiredAt: 0,
  momentCount: 0,
  llmMomentCount: 0,
  meetingInviteCount: 0,
  hasDiagram: true,
  random: () => 0.5
};

describe('pickNextMoment', () => {
  it('stays quiet during the first stretch of a session', () => {
    expect(
      pickNextMoment({ ...BASE, now: OFFICE_FIRST_MOMENT_MIN_MS - 1, sessionStartedAt: 0 })
    ).toBeNull();
    expect(
      pickNextMoment({ ...BASE, now: OFFICE_FIRST_MOMENT_MIN_MS + 1, sessionStartedAt: 0 })
    ).not.toBeNull();
  });

  it('respects the jittered minimum gap between moments', () => {
    const lastFiredAt = BASE.now - OFFICE_MIN_GAP_MS + 1;
    expect(pickNextMoment({ ...BASE, lastFiredAt, random: () => 0 })).toBeNull();
    const longAgo = BASE.now - OFFICE_MIN_GAP_MS * 3;
    expect(pickNextMoment({ ...BASE, lastFiredAt: longAgo, random: () => 0 })).not.toBeNull();
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
      if (moment) expect(['email', 'im', 'coffee']).toContain(moment.kind);
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
