/**
 * Slopitect run-gamification state.
 *
 * Pure reducer with helpers for localStorage persistence. Tracks per-variant
 * streaks, combo windows across variants, total runs, and prestige tier. Used by
 * App.jsx to drive XP toasts, streak stingers, and achievement banners.
 *
 * Designed to be unit-testable independently of React — the reducer is pure,
 * persistence is opt-in via separate functions.
 */

import { prestigeForTotalRuns, getVariantPersona, ACHIEVEMENTS } from '../utils/slopitectCopy.js';

export const COMBO_WINDOW_MS = 6000;
export const STORAGE_KEY = 'archislop:slopitect-progress';
const SCHEMA_VERSION = 1;

const VARIANTS = ['refine', 'innovate', 'goMad', 'critique', 'explain'];

export function createInitialState() {
  const runsByVariant = {};
  const streakByVariant = {};
  for (const v of VARIANTS) {
    runsByVariant[v] = 0;
    streakByVariant[v] = 0;
  }
  return {
    runsByVariant,
    streakByVariant,
    totalRuns: 0,
    lastVariant: null,
    lastCompletedAt: 0,
    combo: 0,
    prestigeShortLabel: prestigeForTotalRuns(0).short,
    variantsSeenInSession: [],
    achievements: {} // id -> true
  };
}

function cloneRecord(record) {
  const out = {};
  for (const v of VARIANTS) out[v] = record?.[v] ?? 0;
  return out;
}

/**
 * Apply a completed run. Returns `{ state, emissions }`. Emissions are events
 * the UI should render (XP toast, streak stinger, combo stinger, achievement banner).
 * Caller is responsible for actually playing sounds / rendering toasts.
 *
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ variant: string, now?: number, goMadDepth?: number, critiquePerfect?: boolean }} input
 */
export function applyCompletedRun(state, input) {
  const variant = input?.variant;
  if (!variant || !VARIANTS.includes(variant)) {
    return { state, emissions: [] };
  }
  const now = typeof input.now === 'number' ? input.now : Date.now();
  const persona = getVariantPersona(variant);

  const runsByVariant = cloneRecord(state.runsByVariant);
  const streakByVariant = cloneRecord(state.streakByVariant);
  runsByVariant[variant] = (runsByVariant[variant] ?? 0) + 1;

  // Streak: consecutive of the same variant.
  if (state.lastVariant === variant) {
    streakByVariant[variant] = (streakByVariant[variant] ?? 0) + 1;
  } else {
    streakByVariant[variant] = 1;
  }
  for (const v of VARIANTS) {
    if (v !== variant) streakByVariant[v] = 0;
  }

  // Combo: different variant within window from last completed.
  const withinWindow = state.lastCompletedAt > 0 && now - state.lastCompletedAt <= COMBO_WINDOW_MS;
  const combo =
    withinWindow && state.lastVariant && state.lastVariant !== variant ? (state.combo || 1) + 1 : 0;

  const totalRuns = state.totalRuns + 1;
  const variantsSeen = state.variantsSeenInSession.includes(variant)
    ? state.variantsSeenInSession
    : [...state.variantsSeenInSession, variant];

  const xp =
    persona.xpAward +
    Math.max(0, streakByVariant[variant] - 1) * persona.xpStreakBonus +
    (variant === 'goMad' && (input.goMadDepth ?? 0) >= 3 ? 35 : 0);

  const emissions = [];
  emissions.push({
    kind: 'xp',
    variant,
    amount: xp,
    streak: streakByVariant[variant]
  });
  if (streakByVariant[variant] >= 2) {
    emissions.push({ kind: 'streak', variant, streak: streakByVariant[variant] });
  }
  if (combo >= 2) {
    emissions.push({ kind: 'combo', combo });
  }

  // Achievements.
  const achievements = { ...(state.achievements || {}) };
  function unlock(id, copy) {
    if (achievements[id]) return false;
    achievements[id] = true;
    emissions.push({ kind: 'achievement', id, title: copy.title, subtitle: copy.subtitle });
    return true;
  }

  if (variant === 'goMad' && (input.goMadDepth ?? 0) >= 3) {
    unlock(ACHIEVEMENTS.slopitectCertified.id, ACHIEVEMENTS.slopitectCertified);
  }
  if (variant === 'critique' && input.critiquePerfect) {
    unlock(ACHIEVEMENTS.perfectInspection.id, ACHIEVEMENTS.perfectInspection);
  }
  if (variantsSeen.length >= 5) {
    unlock(ACHIEVEMENTS.fullStackSlopitect.id, ACHIEVEMENTS.fullStackSlopitect);
  }

  // Prestige tier transition.
  const previousPrestige = prestigeForTotalRuns(state.totalRuns);
  const nextPrestige = prestigeForTotalRuns(totalRuns);
  if (nextPrestige.label !== previousPrestige.label && totalRuns > 0) {
    emissions.push({
      kind: 'prestige',
      title: `PROMOTION: ${nextPrestige.label}`,
      subtitle: 'You have ascended a prestige tier. Update your LinkedIn.'
    });
  }

  return {
    state: {
      runsByVariant,
      streakByVariant,
      totalRuns,
      lastVariant: variant,
      lastCompletedAt: now,
      combo,
      prestigeShortLabel: nextPrestige.short,
      variantsSeenInSession: variantsSeen,
      achievements
    },
    emissions
  };
}

/**
 * Persist a subset of the store across reloads. We keep run counts, total, prestige,
 * and unlocked achievements; session-only fields (lastCompletedAt, combo, variantsSeenInSession)
 * reset on a new session.
 */
export function serializeForStorage(state) {
  return JSON.stringify({
    v: SCHEMA_VERSION,
    runsByVariant: state.runsByVariant,
    totalRuns: state.totalRuns,
    achievements: state.achievements
  });
}

export function loadFromStorage(rawJson) {
  if (typeof rawJson !== 'string' || !rawJson) return null;
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== SCHEMA_VERSION) return null;
  const initial = createInitialState();
  const runsByVariant = cloneRecord(parsed.runsByVariant);
  const totalRuns = Number.isFinite(parsed.totalRuns) ? parsed.totalRuns : 0;
  return {
    ...initial,
    runsByVariant,
    totalRuns,
    prestigeShortLabel: prestigeForTotalRuns(totalRuns).short,
    achievements: parsed.achievements && typeof parsed.achievements === 'object' ? { ...parsed.achievements } : {}
  };
}

export function clearStorage(storage) {
  try {
    storage?.removeItem?.(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readFromStorage(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    return loadFromStorage(raw);
  } catch {
    return null;
  }
}

export function writeToStorage(storage, state) {
  try {
    storage?.setItem?.(STORAGE_KEY, serializeForStorage(state));
  } catch {
    // ignore quota / private-mode errors
  }
}
