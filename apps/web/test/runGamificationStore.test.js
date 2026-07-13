import { describe, expect, it } from 'vitest';
import {
  applyCompletedRun,
  createInitialState,
  loadFromStorage,
  reconcileLifetimeLlmCostUsd,
  serializeForStorage,
  COMBO_WINDOW_MS,
  HAT_TRICK_WINDOW_MS,
  SLOP_MARATHON_SESSION_THRESHOLD,
  levelForXp
} from '../src/state/runGamificationStore.js';

describe('runGamificationStore', () => {
  it('starts empty with zero runs per variant', () => {
    const s = createInitialState();
    expect(s.totalRuns).toBe(0);
    expect(s.runsByVariant.refine).toBe(0);
    expect(s.runsByVariant.goMad).toBe(0);
    expect(s.lastVariant).toBeNull();
    expect(s.xp).toBe(0);
    expect(s.level).toBe(1);
    expect(s.levelProgressRatio).toBeGreaterThanOrEqual(0);
    expect(s.levelProgressRatio).toBeLessThan(1);
  });

  it('emits xp on a single completed run', () => {
    const s = createInitialState();
    const { state, emissions } = applyCompletedRun(s, { variant: 'refine', now: 1000 });
    expect(state.totalRuns).toBe(1);
    expect(state.runsByVariant.refine).toBe(1);
    expect(state.streakByVariant.refine).toBe(1);
    expect(emissions.some((e) => e.kind === 'xp' && e.amount === 25)).toBe(true);
    // First-ever run unlocks the firstSlop achievement banner.
    expect(emissions.some((e) => e.kind === 'achievement' && e.id === 'firstSlop')).toBe(true);
    expect(state.xp).toBe(25);
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

  it('persists totals, xp, and achievements but resets session state on load', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'goMad', now: 1, goMadDepth: 3 }).state;
    s = applyCompletedRun(s, { variant: 'refine', now: 2 }).state;
    const json = serializeForStorage(s);
    const reloaded = loadFromStorage(json);
    expect(reloaded.totalRuns).toBe(2);
    expect(reloaded.runsByVariant.refine).toBe(1);
    expect(reloaded.runsByVariant.goMad).toBe(1);
    expect(reloaded.achievements?.slopitectCertified).toBe(true);
    expect(reloaded.xp).toBe(s.xp);
    expect(reloaded.level).toBe(levelForXp(s.xp).level);
    // Session-only state should not carry over.
    expect(reloaded.variantsSeenInSession).toEqual([]);
    expect(reloaded.lastVariant).toBeNull();
    expect(reloaded.combo).toBe(0);
    expect(reloaded.sessionRuns).toBe(0);
    expect(reloaded.recentVariantTimeline).toEqual([]);
  });

  it('migrates legacy v1 records with xp=0 default', () => {
    const legacy = JSON.stringify({
      v: 1,
      runsByVariant: { refine: 3 },
      totalRuns: 3,
      achievements: { firstSlop: true }
    });
    const reloaded = loadFromStorage(legacy);
    expect(reloaded).not.toBeNull();
    expect(reloaded.totalRuns).toBe(3);
    expect(reloaded.runsByVariant.refine).toBe(3);
    expect(reloaded.achievements?.firstSlop).toBe(true);
    expect(reloaded.xp).toBe(0);
    expect(reloaded.level).toBe(1);
  });

  it('rejects malformed or unknown-version serialized state', () => {
    expect(loadFromStorage(null)).toBeNull();
    expect(loadFromStorage('not-json')).toBeNull();
    expect(loadFromStorage(JSON.stringify({ v: 999, runsByVariant: {} }))).toBeNull();
  });

  it('awards xp, advances level, and emits a levelUp emission when crossing a threshold', () => {
    let s = createInitialState();
    let lastEmissions = [];
    // Pump enough runs to cross the Lvl 2 threshold (50 XP) and observe levelUp.
    for (let i = 0; i < 4; i += 1) {
      const r = applyCompletedRun(s, { variant: 'refine', now: 1000 + i * 100 });
      s = r.state;
      lastEmissions = r.emissions;
      if (lastEmissions.some((e) => e.kind === 'levelUp')) break;
    }
    expect(s.xp).toBeGreaterThanOrEqual(50);
    expect(s.level).toBeGreaterThanOrEqual(2);
    expect(lastEmissions.some((e) => e.kind === 'levelUp' && e.to === s.level)).toBe(true);
  });

  it('streak bonus stacks into the XP award', () => {
    let s = createInitialState();
    const first = applyCompletedRun(s, { variant: 'refine', now: 1 });
    s = first.state;
    const second = applyCompletedRun(s, { variant: 'refine', now: 2 });
    const firstXp = first.emissions.find((e) => e.kind === 'xp');
    const secondXp = second.emissions.find((e) => e.kind === 'xp');
    expect(secondXp.amount).toBeGreaterThan(firstXp.amount);
    expect(secondXp.bonus).toBeGreaterThan(0);
  });

  it('unlocks Hat Trick when 3 distinct variants land inside the window', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 0 }).state;
    s = applyCompletedRun(s, { variant: 'innovate', now: 1000 }).state;
    const r = applyCompletedRun(s, { variant: 'critique', now: 2000 });
    expect(r.emissions.some((e) => e.id === 'hatTrick')).toBe(true);
  });

  it('does not unlock Hat Trick when the window expires between variants', () => {
    let s = createInitialState();
    s = applyCompletedRun(s, { variant: 'refine', now: 0 }).state;
    s = applyCompletedRun(s, { variant: 'innovate', now: HAT_TRICK_WINDOW_MS + 100 }).state;
    const r = applyCompletedRun(s, { variant: 'critique', now: HAT_TRICK_WINDOW_MS + 200 });
    expect(r.emissions.some((e) => e.id === 'hatTrick')).toBe(false);
  });

  it('unlocks Slop Marathon at the session threshold', () => {
    let s = createInitialState();
    let unlockedAt = -1;
    for (let i = 0; i < SLOP_MARATHON_SESSION_THRESHOLD; i += 1) {
      const r = applyCompletedRun(s, { variant: 'refine', now: i * 1000 });
      s = r.state;
      if (r.emissions.some((e) => e.id === 'slopMarathon')) unlockedAt = i;
    }
    expect(unlockedAt).toBe(SLOP_MARATHON_SESSION_THRESHOLD - 1);
  });

  it('accumulates lifetime LLM cost estimates across completed runs', () => {
    let s = createInitialState();
    expect(s.lifetimeLlmCostUsd).toBe(0);
    s = applyCompletedRun(s, { variant: 'refine', now: 1, runCostUsd: 0.012 }).state;
    s = applyCompletedRun(s, { variant: 'innovate', now: 2, runCostUsd: 0.008 }).state;
    expect(s.lifetimeLlmCostUsd).toBeCloseTo(0.02, 5);
    const reloaded = loadFromStorage(serializeForStorage(s));
    expect(reloaded.lifetimeLlmCostUsd).toBeCloseTo(0.02, 5);
  });

  it('reconciles lifetime LLM cost from persisted insight entry totals', () => {
    const state = applyCompletedRun(createInitialState(), {
      variant: 'refine',
      now: 1,
      runCostUsd: 0.01
    }).state;
    const insightsEntries = [
      { status: 'done', estimatedCostUsd: 0.05 },
      { status: 'done', estimatedCostUsd: 0.03 },
      { status: 'running', estimatedCostUsd: 0.99 }
    ];
    const reconciled = reconcileLifetimeLlmCostUsd(state, insightsEntries);
    expect(reconciled.lifetimeLlmCostUsd).toBeCloseTo(0.08, 5);
    expect(reconcileLifetimeLlmCostUsd(reconciled, insightsEntries)).toBe(reconciled);
  });

  it('unlocks per-variant mastery at 10 runs of that variant', () => {
    let s = createInitialState();
    let unlockedAt = -1;
    for (let i = 0; i < 10; i += 1) {
      const r = applyCompletedRun(s, { variant: 'critique', now: i * 1000 });
      s = r.state;
      if (r.emissions.some((e) => e.id === 'auditTribunal')) unlockedAt = i;
    }
    expect(unlockedAt).toBe(9);
  });
});
