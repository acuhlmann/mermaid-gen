/**
 * Pure scheduler brain for the office ambience layer — decides WHEN a moment
 * fires and WHICH kind it is. No timers, no fetches, no store access: the
 * useOfficeAmbience hook ticks and calls `pickNextMoment`, making this fully
 * unit-testable with plain numbers.
 *
 * Anti-annoyance policy (docs/office-parody.md): a short quiet opening, a
 * lively warm-up (the office "notices" the new arrival), then a jittered
 * multi-minute cruise gap, hard session caps, one meeting invite per session,
 * and a small LLM budget — canned templates carry the rest.
 */

export const OFFICE_FIRST_MOMENT_MIN_MS = 20_000;
/** The first few moments arrive on a shorter leash so the office feels alive
 * from the start; after that the cadence relaxes to the cruise gap. */
export const OFFICE_WARMUP_MOMENT_COUNT = 2;
export const OFFICE_WARMUP_MIN_GAP_MS = 45_000;
export const OFFICE_WARMUP_GAP_JITTER_MS = 30_000;
export const OFFICE_MIN_GAP_MS = 3 * 60_000;
export const OFFICE_GAP_JITTER_MS = 2 * 60_000;
export const OFFICE_SESSION_MOMENT_CAP = 10;
export const OFFICE_MEETING_INVITES_PER_SESSION = 1;
/**
 * The all-hands (docs/office-parody.md §10.4) gets its own budget rather than
 * sharing the meeting-invite one, so the session's single ordinary invite is
 * still available. Both are hard-capped, so the worst case is two summonses in
 * a session — and only one of them has the whole company in it.
 */
export const OFFICE_ALL_HANDS_PER_SESSION = 1;
export const OFFICE_BATTLES_PER_SESSION = 2;
/** Senior stakeholders (VP/CISO/CTO/CFO) get exactly one ambient email each
 * session — they are meeting people, not desk-ping people. */
export const OFFICE_SENIOR_EMAILS_PER_SESSION = 1;
/** Share of canned emails drawn from the senior bank while that cap is open. */
const SENIOR_EMAIL_RATIO = 0.2;

/*
 * ---------------------------------------------------------------------------
 * THE OFFICE LLM BUDGET — one table, tuned in one place.
 * ---------------------------------------------------------------------------
 *
 * These used to live in three files, and two of them were module-private, so
 * "how talkative is the office" could not be answered without opening
 * `officeCadence.js`, `useOfficeRunReactions.js`, and `useDeskActions.js` and
 * reading past the logic in each. They are re-homed here and imported back —
 * every knob that decides whether a line is written or drawn from a bank is
 * now visible at once.
 *
 * The split that governs the numbers is §11's, not a uniform generosity:
 *
 * - **Ambient** (a timer decided to interrupt you) stays canned-heavy. Nobody
 *   asked for it, so it should be cheap and it should repeat rarely rather
 *   than never.
 * - **Reactive** (you started it, or you directly answered) leans LLM, because
 *   a canned reply to something you typed is the single most obvious tell that
 *   nobody is home. Reactive spend is self-limiting: you have to do something
 *   to cause it.
 *
 * Every category degrades into the canned bank when its cap is spent — in
 * character, never as an error.
 */

/** Ambient: diagram-aware moments per session. The rest come from the banks. */
export const OFFICE_LLM_MOMENT_CAP = 5;
/** Ambient: share of eligible emails / IMs that spend one of those calls. */
const EMAIL_LLM_RATIO = 1 / 2;
const IM_LLM_RATIO = 0.45;
/**
 * Reactive: a landed run may draw a remark. Capped low on purpose even though
 * it is reactive — the user did not ask the office for an opinion, they just
 * shipped something, so this sits between the two tiers.
 */
export const OFFICE_RUN_REACTION_LLM_CAP = 3;
/** Reactive: desk verbs you clicked (get coffee, IM someone, walk the floor). */
export const OFFICE_DESK_LLM_CAP = 4;
/**
 * Reactive: talking — the composer's "say it out loud" and every Slop Chat
 * reply. Deliberately the largest budget in the table and unchanged by the
 * rebalance: this is the one place the user is unambiguously in a conversation,
 * and a canned answer to a typed sentence is the failure this whole layer is
 * trying to avoid.
 */
export const OFFICE_TALK_LLM_CAP = 12;
/**
 * Reactive: Linda's compliance training (docs/office-parody.md §10.1). One call
 * authors one form, and the gauntlet is `TRAINING_STEPS` long — so this cap is
 * "the whole module, once, personalized", and a second sitting draws the canned
 * module instead. Sized to the feature rather than to a feeling: raising it
 * buys nothing until the gauntlet grows.
 */
export const OFFICE_TRAINING_LLM_CAP = 2;

/** Relative frequency of each moment kind (before availability filters). */
const MOMENT_WEIGHTS = [
  ['email', 3],
  ['im', 3],
  ['walkby', 2],
  ['coffee', 1.5],
  ['battle', 1.25],
  ['meeting-invite', 1],
  // Rarest thing the office does, and it should stay that way: a company-wide
  // summons is only funny if it is not a fixture.
  ['all-hands', 0.4]
];

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastFiredAt: number,
 *   momentCount: number,
 *   llmMomentCount: number,
 *   meetingInviteCount: number,
 *   battleCount?: number,
 *   seniorEmailCount?: number,
 *   allHandsCount?: number,
 *   hasDiagram: boolean,
 *   random?: () => number
 * }} args
 * @returns {{ kind: 'email'|'im'|'walkby'|'coffee'|'battle'|'meeting-invite'|'all-hands', useLlm: boolean, senior?: boolean } | null}
 */
export function pickNextMoment({
  now,
  sessionStartedAt,
  lastFiredAt,
  momentCount,
  llmMomentCount,
  meetingInviteCount,
  battleCount = 0,
  seniorEmailCount = 0,
  allHandsCount = 0,
  hasDiagram,
  random = Math.random
}) {
  if (momentCount >= OFFICE_SESSION_MOMENT_CAP) return null;
  if (now - sessionStartedAt < OFFICE_FIRST_MOMENT_MIN_MS) return null;
  const warmingUp = momentCount < OFFICE_WARMUP_MOMENT_COUNT;
  const requiredGap = warmingUp
    ? OFFICE_WARMUP_MIN_GAP_MS + random() * OFFICE_WARMUP_GAP_JITTER_MS
    : OFFICE_MIN_GAP_MS + random() * OFFICE_GAP_JITTER_MS;
  if (lastFiredAt > 0 && now - lastFiredAt < requiredGap) return null;

  const llmBudgetLeft = llmMomentCount < OFFICE_LLM_MOMENT_CAP;
  const eligible = MOMENT_WEIGHTS.filter(([kind]) => {
    if (kind === 'walkby') return hasDiagram && llmBudgetLeft;
    if (kind === 'meeting-invite') {
      return hasDiagram && meetingInviteCount < OFFICE_MEETING_INVITES_PER_SESSION;
    }
    // Needs a diagram for the same reason a walk-by does: an all-hands about
    // an empty canvas is a meeting about nothing, which is funny once and
    // indistinguishable from a bug the rest of the time.
    if (kind === 'all-hands') {
      return hasDiagram && allHandsCount < OFFICE_ALL_HANDS_PER_SESSION;
    }
    // Battles are rare set pieces — needing no diagram (holy wars predate work).
    if (kind === 'battle') return battleCount < OFFICE_BATTLES_PER_SESSION;
    return true;
  });
  if (eligible.length === 0) return null;

  const total = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  let kind = eligible[eligible.length - 1][0];
  for (const [candidate, weight] of eligible) {
    roll -= weight;
    if (roll <= 0) {
      kind = candidate;
      break;
    }
  }

  let useLlm = false;
  if (kind === 'walkby') {
    // Walk-bys exist to eyeball the actual diagram — always diagram-aware.
    useLlm = true;
  } else if (kind === 'email') {
    useLlm = llmBudgetLeft && hasDiagram && random() < EMAIL_LLM_RATIO;
  } else if (kind === 'im') {
    useLlm = llmBudgetLeft && hasDiagram && random() < IM_LLM_RATIO;
  }

  // A canned email may instead come from upstairs — zero LLM, capped hard so
  // leadership stays a rare event rather than another colleague.
  if (
    kind === 'email' &&
    !useLlm &&
    seniorEmailCount < OFFICE_SENIOR_EMAILS_PER_SESSION &&
    random() < SENIOR_EMAIL_RATIO
  ) {
    return { kind, useLlm: false, senior: true };
  }
  return { kind, useLlm };
}
