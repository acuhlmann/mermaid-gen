import { describe, expect, it } from 'vitest';
import {
  applyOfficeEvent,
  createInitialState,
  OFFICE_BATTLE_ACHIEVEMENT_THRESHOLD,
  OFFICE_COFFEE_ACHIEVEMENT_THRESHOLD,
  OFFICE_REPLY_ACHIEVEMENT_THRESHOLD,
  OFFICE_XP_AWARDS
} from '../src/state/runGamificationStore.js';

describe('applyOfficeEvent', () => {
  it('awards XP per office event kind and emits an xp toast', () => {
    let state = createInitialState();
    const { state: next, emissions } = applyOfficeEvent(state, { kind: 'coffeeBreak' });
    expect(next.xp).toBe(OFFICE_XP_AWARDS.coffeeBreak);
    expect(emissions[0]).toMatchObject({ kind: 'xp', variant: 'office', amount: 10 });
  });

  it('ignores unknown kinds', () => {
    const state = createInitialState();
    const result = applyOfficeEvent(state, { kind: 'fireDrill' });
    expect(result.state).toBe(state);
    expect(result.emissions).toHaveLength(0);
  });

  it('unlocks SURVIVED THE SYNC on the first full meeting only', () => {
    let state = createInitialState();
    const first = applyOfficeEvent(state, { kind: 'meetingSurvived' });
    expect(
      first.emissions.some((e) => e.kind === 'achievement' && e.id === 'survivedTheSync')
    ).toBe(true);
    const second = applyOfficeEvent(first.state, { kind: 'meetingSurvived' });
    expect(second.emissions.some((e) => e.kind === 'achievement')).toBe(false);
  });

  it('awards CHANGE APPROVED on a completed CAB hearing and unlocks once', () => {
    let state = createInitialState();
    const first = applyOfficeEvent(state, { kind: 'cabApproved' });
    expect(first.state.xp).toBe(OFFICE_XP_AWARDS.cabApproved);
    expect(first.emissions[0]).toMatchObject({ kind: 'xp', variant: 'office' });
    expect(first.emissions.some((e) => e.kind === 'achievement' && e.id === 'cabApproved')).toBe(
      true
    );
    const second = applyOfficeEvent(first.state, { kind: 'cabApproved' });
    expect(second.emissions.some((e) => e.kind === 'achievement')).toBe(false);
  });

  it('unlocks INBOX ZERO only when flagged by the caller', () => {
    let state = createInitialState();
    const plain = applyOfficeEvent(state, { kind: 'emailRead' });
    expect(plain.emissions.some((e) => e.kind === 'achievement')).toBe(false);
    const zeroed = applyOfficeEvent(plain.state, { kind: 'emailRead', inboxZero: true });
    expect(zeroed.emissions.some((e) => e.id === 'inboxZero')).toBe(true);
  });

  it('counts coffee breaks and IM replies toward their session achievements', () => {
    let state = createInitialState();
    for (let i = 0; i < OFFICE_COFFEE_ACHIEVEMENT_THRESHOLD; i += 1) {
      ({ state } = applyOfficeEvent(state, { kind: 'coffeeBreak' }));
    }
    expect(state.achievements.coffeeConnoisseur).toBe(true);
    for (let i = 0; i < OFFICE_REPLY_ACHIEVEMENT_THRESHOLD; i += 1) {
      ({ state } = applyOfficeEvent(state, { kind: 'imReply' }));
    }
    expect(state.achievements.replyGuy).toBe(true);
  });

  it('awards battle XP and unlocks HOLY WAR REFEREE at the session threshold', () => {
    let state = createInitialState();
    const first = applyOfficeEvent(state, { kind: 'battleSettled' });
    expect(first.state.xp).toBe(OFFICE_XP_AWARDS.battleSettled);
    expect(first.emissions[0]).toMatchObject({ kind: 'xp', variant: 'office', amount: 5 });
    ({ state } = first);
    for (let i = 1; i < OFFICE_BATTLE_ACHIEVEMENT_THRESHOLD; i += 1) {
      ({ state } = applyOfficeEvent(state, { kind: 'battleSettled' }));
    }
    expect(state.achievements.holyWarReferee).toBe(true);
  });

  it('recomputes level fields when office XP crosses a threshold', () => {
    let state = { ...createInitialState(), xp: 0 };
    for (let i = 0; i < 12; i += 1) {
      ({ state } = applyOfficeEvent(state, { kind: 'meetingSurvived' }));
    }
    expect(state.xp).toBe(12 * OFFICE_XP_AWARDS.meetingSurvived);
    expect(state.level).toBeGreaterThan(1);
    expect(state.levelTitle.length).toBeGreaterThan(0);
  });
});
