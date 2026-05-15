import { describe, expect, it } from 'vitest';
import {
  applyCompletedRun,
  createInitialState,
  loadFromStorage,
  serializeForStorage,
  COMBO_WINDOW_MS
} from '../src/state/runGamificationStore.js';

describe('runGamificationStore', () => {
  it('starts empty with zero runs per variant', () => {
    const s = createInitialState();
    expect(s.totalRuns).toBe(0);
    expect(s.runsByVariant.refine).toBe(0);
    expect(s.runsByVariant.goMad).toBe(0);
    expect(s.lastVariant).toBeNull();
  });

  it('emits xp on a single completed run', () => {
    const s = createInitialState();
    const { state, emissions } = applyCompletedRun(s, { variant: 'refine', now: 1000 });
    expect(state.totalRuns).toBe(1);
    expect(state.runsByVariant.refine).toBe(1);
    expect(state.streakByVariant.refine).toBe(1);
    expect(emissions.some((e) => e.kind === 'xp' && e.amount === 25)).toBe(true);
  });

  it('tracks consecutive same-variant streaks and resets on switch', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 1000 }).state;
    s = applyCompletedRun(s, { variant: 'refine', now: 2000 }).state;
    s = applyCompletedRun(s, { variant: 'refine', now: 3000 }).state;
    expect(s.streakByVariant.refine).toBe(3);
    // Switching to a different variant resets the prior streak.
    s = applyCompletedRun(s, { variant: 'innovate', now: 4000 }).state;
    expect(s.streakByVariant.refine).toBe(0);
    expect(s.streakByVariant.innovate).toBe(1);
  });

  it('emits a streak event when the same variant fires ≥ 2 in a row', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 1000 }).state;
    const { emissions } = applyCompletedRun(s, { variant: 'refine', now: 2000 });
    expect(emissions.some((e) => e.kind === 'streak' && e.streak === 2)).toBe(true);
  });

  it('emits a combo when a different variant fires within the window', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 1000 }).state;
    const { emissions, state } = applyCompletedRun(s, {
      variant: 'innovate',
      now: 1000 + COMBO_WINDOW_MS - 1
    });
    expect(emissions.some((e) => e.kind === 'combo')).toBe(true);
    expect(state.combo).toBeGreaterThanOrEqual(2);
  });

  it('does not emit a combo when same variant or window expired', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 1000 }).state;
    // Same variant: streak, not combo.
    let next = applyCompletedRun(s, { variant: 'refine', now: 2000 });
    expect(next.emissions.some((e) => e.kind === 'combo')).toBe(false);
    // Window expired:
    next = applyCompletedRun(s, { variant: 'innovate', now: 1000 + COMBO_WINDOW_MS + 1 });
    expect(next.emissions.some((e) => e.kind === 'combo')).toBe(false);
  });

  it('unlocks Slopitect Certified when goMadDepth ≥ 3', () => {
    let s = createInitialState();
    let result = applyCompletedRun(s, { variant: 'goMad', now: 1000, goMadDepth: 1 });
    expect(result.emissions.some((e) => e.id === 'slopitectCertified')).toBe(false);
    result = applyCompletedRun(result.state, { variant: 'goMad', now: 2000, goMadDepth: 2 });
    expect(result.emissions.some((e) => e.id === 'slopitectCertified')).toBe(false);
    result = applyCompletedRun(result.state, { variant: 'goMad', now: 3000, goMadDepth: 3 });
    expect(result.emissions.some((e) => e.id === 'slopitectCertified')).toBe(true);
  });

  it('unlocks Slopitect Certified only once', () => {
    let s = createInitialState();
    let r = applyCompletedRun(s, { variant: 'goMad', now: 1, goMadDepth: 3 });
    expect(r.emissions.some((e) => e.id === 'slopitectCertified')).toBe(true);
    r = applyCompletedRun(r.state, { variant: 'goMad', now: 2, goMadDepth: 4 });
    expect(r.emissions.some((e) => e.id === 'slopitectCertified')).toBe(false);
  });

  it('unlocks Full-Stack Slopitect after 5 distinct variants in a session', () => {
    let s = createInitialState();
    const variants = ['refine', 'innovate', 'goMad', 'critique', 'explain'];
    let unlockedAt = -1;
    variants.forEach((v, idx) => {
      const r = applyCompletedRun(s, { variant: v, now: 1000 + idx * 10_000 });
      s = r.state;
      if (r.emissions.some((e) => e.id === 'fullStackSlopitect')) {
        unlockedAt = idx;
      }
    });
    expect(unlockedAt).toBe(4);
  });

  it('emits a prestige event when crossing thresholds', () => {
    let s = createInitialState();
    let crossedAt = -1;
    for (let i = 0; i < 11; i += 1) {
      const r = applyCompletedRun(s, { variant: 'refine', now: 1000 + i * 100 });
      s = r.state;
      if (r.emissions.some((e) => e.kind === 'prestige')) {
        crossedAt = i;
      }
    }
    // Tier threshold for Senior Slopitect is 10 runs total, so should cross at the 10th run (index 9).
    expect(crossedAt).toBe(9);
  });

  it('persists totals and achievements but resets session state on load', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'goMad', now: 1, goMadDepth: 3 }).state;
    s = applyCompletedRun(s, { variant: 'refine', now: 2 }).state;
    const json = serializeForStorage(s);
    const reloaded = loadFromStorage(json);
    expect(reloaded.totalRuns).toBe(2);
    expect(reloaded.runsByVariant.refine).toBe(1);
    expect(reloaded.runsByVariant.goMad).toBe(1);
    expect(reloaded.achievements?.slopitectCertified).toBe(true);
    // Session-only state should not carry over.
    expect(reloaded.variantsSeenInSession).toEqual([]);
    expect(reloaded.lastVariant).toBeNull();
    expect(reloaded.combo).toBe(0);
  });

  it('rejects malformed or wrong-version serialized state', () => {
    expect(loadFromStorage(null)).toBeNull();
    expect(loadFromStorage('not-json')).toBeNull();
    expect(loadFromStorage(JSON.stringify({ v: 999, runsByVariant: {} }))).toBeNull();
  });
});
