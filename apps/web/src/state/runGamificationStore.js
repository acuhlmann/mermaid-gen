/**
 * Slopitect run-gamification state.
 *
 * Pure reducer with helpers for localStorage persistence. Tracks per-variant
 * streaks, combo windows across variants, total runs, XP, level progression,
 * and a growing collection of achievements. Used by App.jsx to drive XP
 * toasts, streak stingers, level-up celebrations, and achievement banners.
 *
 * Designed to be unit-testable independently of React — the reducer is pure,
 * persistence is opt-in via separate functions.
 */

import {
  prestigeForTotalRuns,
  getVariantPersona,
  levelForXp,
  getAchievements,
  getVariantMasteryAchievements,
  getLevelUpBanner,
  getPrestigePromotionCopy,
  VARIANT_MASTERY_THRESHOLD
} from '../utils/slopitectCopy.js';

export const COMBO_WINDOW_MS = 6000;
export const HAT_TRICK_WINDOW_MS = 30_000;
export const SLOP_MARATHON_SESSION_THRESHOLD = 10;
export const COMBO_KING_THRESHOLD = 5;
export const STORAGE_KEY = 'archislop:slopitect-progress';
const SCHEMA_VERSION = 3;

const VARIANTS = ['gilfoyle', 'dinesh', 'erlich', 'russ', 'jared', 'richard', 'barker'];

export function createInitialState() {
  const runsByVariant = {};
  const streakByVariant = {};
  for (const v of VARIANTS) {
    runsByVariant[v] = 0;
    streakByVariant[v] = 0;
  }
  const levelInfo = levelForXp(0);
  return {
    runsByVariant,
    streakByVariant,
    totalRuns: 0,
    xp: 0,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    levelShortLabel: levelInfo.short,
    levelFlair: levelInfo.flair,
    levelProgressRatio: levelInfo.progressRatio,
    xpIntoLevel: levelInfo.xpInto,
    xpForNextLevel: levelInfo.xpForNext,
    lastVariant: null,
    lastCompletedAt: 0,
    combo: 0,
    prestigeShortLabel: prestigeForTotalRuns(0).short,
    variantsSeenInSession: [],
    sessionRuns: 0,
    recentVariantTimeline: [], // [{ variant, at }] for hat-trick window
    achievements: {},
    lifetimeLlmCostUsd: 0,
    // Stakeholder advisor (/api/advisor/suggest) spend. Tracked apart from run
    // costs because it never produces an insights entry, so the reconcile below
    // must fold it back in explicitly (otherwise a run-cost repair could drop it).
    advisorLlmCostUsd: 0
  };
}

function cloneRecord(record) {
  const out = {};
  for (const v of VARIANTS) out[v] = record?.[v] ?? 0;
  return out;
}

function pruneTimeline(timeline, now) {
  if (!Array.isArray(timeline) || timeline.length === 0) return [];
  return timeline.filter((entry) => entry && now - entry.at <= HAT_TRICK_WINDOW_MS);
}

/**
 * Apply a completed run. Returns `{ state, emissions }`. Emissions are events
 * the UI should render (XP toast, streak stinger, combo stinger, level-up
 * banner, achievement banner). Caller is responsible for actually playing
 * sounds and rendering toasts.
 *
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ variant: string, now?: number, russDepth?: number, critiquePerfect?: boolean, runCostUsd?: number }} input
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
  const sessionRuns = (state.sessionRuns ?? 0) + 1;
  const variantsSeen = state.variantsSeenInSession.includes(variant)
    ? state.variantsSeenInSession
    : [...state.variantsSeenInSession, variant];

  const recentVariantTimeline = pruneTimeline(state.recentVariantTimeline, now);
  recentVariantTimeline.push({ variant, at: now });

  const streakBonus = Math.max(0, streakByVariant[variant] - 1) * persona.xpStreakBonus;
  const russDepthBonus = variant === 'russ' && (input.russDepth ?? 0) >= 3 ? 35 : 0;
  const comboBonus = combo >= 2 ? 8 + Math.min(combo, 6) * 4 : 0;
  const xpGained = persona.xpAward + streakBonus + russDepthBonus + comboBonus;
  const totalXp = (state.xp ?? 0) + xpGained;
  const previousLevelInfo = levelForXp(state.xp ?? 0);
  const nextLevelInfo = levelForXp(totalXp);

  const emissions = [];
  emissions.push({
    kind: 'xp',
    variant,
    amount: xpGained,
    streak: streakByVariant[variant],
    bonus: streakBonus + russDepthBonus + comboBonus
  });
  if (streakByVariant[variant] >= 2) {
    emissions.push({ kind: 'streak', variant, streak: streakByVariant[variant] });
  }
  if (combo >= 2) {
    emissions.push({ kind: 'combo', combo });
  }

  // Level up — emit once per crossing (a big XP haul could span multiple
  // levels, but we surface only the highest reached to keep banners sane).
  if (nextLevelInfo.level > previousLevelInfo.level) {
    const levelUpBanner = getLevelUpBanner();
    emissions.push({
      kind: 'levelUp',
      from: previousLevelInfo.level,
      to: nextLevelInfo.level,
      title: nextLevelInfo.title,
      flair: nextLevelInfo.flair,
      short: nextLevelInfo.short,
      totalXp,
      bannerTitle: levelUpBanner.title,
      bannerSubtitle: levelUpBanner.subtitle
    });
  }

  // Achievements.
  const achievements = { ...(state.achievements || {}) };
  const achievementCopy = getAchievements();
  function unlock(id, copy) {
    if (achievements[id]) return false;
    achievements[id] = true;
    emissions.push({ kind: 'achievement', id, title: copy.title, subtitle: copy.subtitle });
    return true;
  }

  if (totalRuns === 1) {
    unlock(achievementCopy.firstSlop.id, achievementCopy.firstSlop);
  }
  if (variant === 'russ' && (input.russDepth ?? 0) >= 3) {
    unlock(achievementCopy.slopitectCertified.id, achievementCopy.slopitectCertified);
  }
  if (variant === 'jared' && input.critiquePerfect) {
    unlock(achievementCopy.perfectInspection.id, achievementCopy.perfectInspection);
  }
  if (variantsSeen.length >= 5) {
    unlock(achievementCopy.fullStackSlopitect.id, achievementCopy.fullStackSlopitect);
  }
  if (combo >= COMBO_KING_THRESHOLD) {
    unlock(achievementCopy.comboKing.id, achievementCopy.comboKing);
  }
  if (sessionRuns >= SLOP_MARATHON_SESSION_THRESHOLD) {
    unlock(achievementCopy.slopMarathon.id, achievementCopy.slopMarathon);
  }
  {
    const distinctInWindow = new Set(recentVariantTimeline.map((e) => e.variant));
    if (distinctInWindow.size >= 3) {
      unlock(achievementCopy.hatTrick.id, achievementCopy.hatTrick);
    }
  }
  // Per-variant mastery — gates on cumulative variant count.
  const variantMastery = getVariantMasteryAchievements()[variant];
  if (variantMastery && runsByVariant[variant] >= VARIANT_MASTERY_THRESHOLD) {
    unlock(variantMastery.id, variantMastery);
  }

  // Prestige tier transition.
  const previousPrestige = prestigeForTotalRuns(state.totalRuns);
  const nextPrestige = prestigeForTotalRuns(totalRuns);
  if (nextPrestige.label !== previousPrestige.label && totalRuns > 0) {
    const prestigePromotion = getPrestigePromotionCopy();
    emissions.push({
      kind: 'prestige',
      title: `${prestigePromotion.titlePrefix}: ${nextPrestige.label}`,
      subtitle: prestigePromotion.subtitle
    });
  }

  const runCostUsd =
    typeof input.runCostUsd === 'number' &&
    Number.isFinite(input.runCostUsd) &&
    input.runCostUsd > 0
      ? input.runCostUsd
      : 0;
  const lifetimeLlmCostUsd = (state.lifetimeLlmCostUsd ?? 0) + runCostUsd;

  return {
    state: {
      runsByVariant,
      streakByVariant,
      totalRuns,
      xp: totalXp,
      level: nextLevelInfo.level,
      levelTitle: nextLevelInfo.title,
      levelShortLabel: nextLevelInfo.short,
      levelFlair: nextLevelInfo.flair,
      levelProgressRatio: nextLevelInfo.progressRatio,
      xpIntoLevel: nextLevelInfo.xpInto,
      xpForNextLevel: nextLevelInfo.xpForNext,
      lastVariant: variant,
      lastCompletedAt: now,
      combo,
      prestigeShortLabel: nextPrestige.short,
      variantsSeenInSession: variantsSeen,
      sessionRuns,
      recentVariantTimeline,
      achievements,
      lifetimeLlmCostUsd,
      advisorLlmCostUsd: state.advisorLlmCostUsd ?? 0
    },
    emissions
  };
}

/**
 * Persist a subset of the store across reloads. We keep run counts, total,
 * cumulative XP, unlocked achievements, and prestige. Session-only fields
 * (lastCompletedAt, combo, variantsSeenInSession, sessionRuns, timeline)
 * reset on a new session.
 */
export function serializeForStorage(state) {
  return JSON.stringify({
    v: SCHEMA_VERSION,
    runsByVariant: state.runsByVariant,
    totalRuns: state.totalRuns,
    xp: state.xp ?? 0,
    achievements: state.achievements,
    lifetimeLlmCostUsd: state.lifetimeLlmCostUsd ?? 0,
    advisorLlmCostUsd: state.advisorLlmCostUsd ?? 0
  });
}

function rehydrateFromParsed(parsed) {
  const initial = createInitialState();
  const runsByVariant = cloneRecord(parsed.runsByVariant);
  const totalRuns = Number.isFinite(parsed.totalRuns) ? parsed.totalRuns : 0;
  const xp = Number.isFinite(parsed.xp) ? parsed.xp : 0;
  const levelInfo = levelForXp(xp);
  const lifetimeLlmCostUsd = Number.isFinite(parsed.lifetimeLlmCostUsd)
    ? parsed.lifetimeLlmCostUsd
    : 0;
  const advisorLlmCostUsd = Number.isFinite(parsed.advisorLlmCostUsd)
    ? parsed.advisorLlmCostUsd
    : 0;
  return {
    ...initial,
    runsByVariant,
    totalRuns,
    xp,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    levelShortLabel: levelInfo.short,
    levelFlair: levelInfo.flair,
    levelProgressRatio: levelInfo.progressRatio,
    xpIntoLevel: levelInfo.xpInto,
    xpForNextLevel: levelInfo.xpForNext,
    prestigeShortLabel: prestigeForTotalRuns(totalRuns).short,
    achievements:
      parsed.achievements && typeof parsed.achievements === 'object'
        ? { ...parsed.achievements }
        : {},
    lifetimeLlmCostUsd,
    advisorLlmCostUsd
  };
}

export function loadFromStorage(rawJson) {
  if (typeof rawJson !== 'string' || !rawJson) return null;
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }
  if (!parsed) return null;
  // Forward-compat: accept legacy v1 records (no xp yet) and rehydrate the
  // surviving fields with xp=0 so returning users keep their unlocked
  // achievements and run totals.
  if (parsed.v === 1 || parsed.v === 2 || parsed.v === SCHEMA_VERSION) {
    return rehydrateFromParsed(parsed);
  }
  return null;
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

/**
 * Reconcile persisted lifetime LLM cost with summed per-run estimates from the
 * diagram cache. Repairs sessions where run totals were shown in the thinking
 * panel but never reached gamification due to async insight state batching.
 */
export function reconcileLifetimeLlmCostUsd(state, insightsEntries) {
  if (!state || !Array.isArray(insightsEntries) || insightsEntries.length === 0) {
    return state;
  }
  const fromInsights = insightsEntries.reduce((sum, entry) => {
    if (entry?.status !== 'done') return sum;
    const cost = entry?.estimatedCostUsd;
    return sum + (typeof cost === 'number' && Number.isFinite(cost) && cost > 0 ? cost : 0);
  }, 0);
  const stored = state.lifetimeLlmCostUsd ?? 0;
  // Advisor spend has no insights entry — add it on top of the run total so the
  // repair never rewinds it back out of the lifetime figure.
  const advisor = state.advisorLlmCostUsd ?? 0;
  const next = Math.max(stored, fromInsights + advisor);
  if (!Number.isFinite(next) || next <= stored) return state;
  return { ...state, lifetimeLlmCostUsd: next };
}

/**
 * Add a stakeholder-advisor LLM charge to both the dedicated advisor tally and the
 * lifetime total shown in the Stakeholder Damage Report. No-op for non-positive USD.
 */
export function addAdvisorLlmCostUsd(state, usd) {
  if (!state) return state;
  if (!(typeof usd === 'number' && Number.isFinite(usd) && usd > 0)) return state;
  return {
    ...state,
    advisorLlmCostUsd: (state.advisorLlmCostUsd ?? 0) + usd,
    lifetimeLlmCostUsd: (state.lifetimeLlmCostUsd ?? 0) + usd
  };
}

/** XP for participating in office life (docs/office-parody.md). Deliberately
 * small — attending meetings must never out-earn actually shipping slop. */
export const OFFICE_XP_AWARDS = {
  emailRead: 1,
  imReply: 2,
  walkedFloor: 2,
  coffeeBreak: 10,
  battleSettled: 5,
  meetingLeftEarly: 5,
  meetingSurvived: 25,
  /** Linda's compliance training (§10.1) — a real sit-down, but still not a run. */
  trainingCompleted: 20,
  phishingReported: 5,
  /**
   * Failing Sasha's phishing test pays 1 XP, not 0. `applyOfficeEvent` bails on
   * a falsy award, so a zero here would swallow the "Security Incident #1"
   * achievement along with it — and the achievement IS the joke.
   */
  phishingClicked: 1
};
export const OFFICE_COFFEE_ACHIEVEMENT_THRESHOLD = 3;
export const OFFICE_REPLY_ACHIEVEMENT_THRESHOLD = 5;
export const OFFICE_BATTLE_ACHIEVEMENT_THRESHOLD = 3;

/**
 * Apply an office ambience event (email read, IM quick reply, coffee break,
 * meeting attended/left). Same `{ state, emissions }` contract as
 * applyCompletedRun so App's emission pipeline (toasts, fanfares, banners)
 * handles both. Session-only counters (`officeCoffeeBreaksInSession`,
 * `officeImRepliesInSession`) are not serialized, so they reset per session.
 *
 * @param {ReturnType<typeof createInitialState>} state
 * @param {{ kind: keyof typeof OFFICE_XP_AWARDS, now?: number, inboxZero?: boolean }} input
 */
export function applyOfficeEvent(state, input) {
  const kind = input?.kind;
  const xpGained = OFFICE_XP_AWARDS[kind];
  if (!xpGained) {
    return { state, emissions: [] };
  }
  const totalXp = (state.xp ?? 0) + xpGained;
  const previousLevelInfo = levelForXp(state.xp ?? 0);
  const nextLevelInfo = levelForXp(totalXp);

  const emissions = [{ kind: 'xp', variant: 'office', amount: xpGained, streak: 0, bonus: 0 }];

  const officeCoffeeBreaksInSession =
    (state.officeCoffeeBreaksInSession ?? 0) + (kind === 'coffeeBreak' ? 1 : 0);
  const officeImRepliesInSession =
    (state.officeImRepliesInSession ?? 0) + (kind === 'imReply' ? 1 : 0);
  const officeBattlesSettledInSession =
    (state.officeBattlesSettledInSession ?? 0) + (kind === 'battleSettled' ? 1 : 0);

  const achievements = { ...(state.achievements || {}) };
  const achievementCopy = getAchievements();
  function unlock(id, copy) {
    if (!copy || achievements[id]) return;
    achievements[id] = true;
    emissions.push({ kind: 'achievement', id, title: copy.title, subtitle: copy.subtitle });
  }
  if (kind === 'meetingSurvived') {
    unlock('survivedTheSync', achievementCopy.survivedTheSync);
  }
  if (kind === 'emailRead' && input.inboxZero) {
    unlock('inboxZero', achievementCopy.inboxZero);
  }
  if (officeCoffeeBreaksInSession >= OFFICE_COFFEE_ACHIEVEMENT_THRESHOLD) {
    unlock('coffeeConnoisseur', achievementCopy.coffeeConnoisseur);
  }
  if (officeImRepliesInSession >= OFFICE_REPLY_ACHIEVEMENT_THRESHOLD) {
    unlock('replyGuy', achievementCopy.replyGuy);
  }
  if (officeBattlesSettledInSession >= OFFICE_BATTLE_ACHIEVEMENT_THRESHOLD) {
    unlock('holyWarReferee', achievementCopy.holyWarReferee);
  }
  if (kind === 'trainingCompleted') {
    unlock('complianceOfficer', achievementCopy.complianceOfficer);
  }
  if (kind === 'phishingClicked') {
    unlock('securityIncident', achievementCopy.securityIncident);
  }

  if (nextLevelInfo.level > previousLevelInfo.level) {
    const levelUpBanner = getLevelUpBanner();
    emissions.push({
      kind: 'levelUp',
      from: previousLevelInfo.level,
      to: nextLevelInfo.level,
      title: nextLevelInfo.title,
      flair: nextLevelInfo.flair,
      short: nextLevelInfo.short,
      totalXp,
      bannerTitle: levelUpBanner.title,
      bannerSubtitle: levelUpBanner.subtitle
    });
  }

  return {
    state: {
      ...state,
      xp: totalXp,
      level: nextLevelInfo.level,
      levelTitle: nextLevelInfo.title,
      levelShortLabel: nextLevelInfo.short,
      levelFlair: nextLevelInfo.flair,
      levelProgressRatio: nextLevelInfo.progressRatio,
      xpIntoLevel: nextLevelInfo.xpInto,
      xpForNextLevel: nextLevelInfo.xpForNext,
      achievements,
      officeCoffeeBreaksInSession,
      officeImRepliesInSession,
      officeBattlesSettledInSession
    },
    emissions
  };
}

// Re-export so callers building UI from this store can derive level info
// without importing the copy module directly.
export { levelForXp };
