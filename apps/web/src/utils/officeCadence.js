/**
 * Pure scheduler brain for the office ambience layer — decides WHEN a moment
 * fires and WHICH kind it is. No timers, no fetches, no store access: the
 * useOfficeAmbience hook ticks and calls `pickNextMoment`, making this fully
 * unit-testable with plain numbers.
 *
 * Anti-annoyance policy (docs/office-parody.md): a quiet first stretch, a
 * jittered multi-minute gap, hard session caps, one meeting invite per
 * session, and a small LLM budget — canned templates carry the rest.
 */

export const OFFICE_FIRST_MOMENT_MIN_MS = 90_000;
export const OFFICE_MIN_GAP_MS = 3 * 60_000;
export const OFFICE_GAP_JITTER_MS = 2 * 60_000;
export const OFFICE_SESSION_MOMENT_CAP = 8;
export const OFFICE_MEETING_INVITES_PER_SESSION = 1;
export const OFFICE_LLM_MOMENT_CAP = 3;

/** Relative frequency of each moment kind (before availability filters). */
const MOMENT_WEIGHTS = [
  ['email', 3],
  ['im', 3],
  ['walkby', 2],
  ['coffee', 1.5],
  ['meeting-invite', 1]
];

/** Share of eligible emails/IMs that spend an LLM call to be diagram-aware. */
const EMAIL_LLM_RATIO = 1 / 3;
const IM_LLM_RATIO = 0.2;

/**
 * @param {{
 *   now: number,
 *   sessionStartedAt: number,
 *   lastFiredAt: number,
 *   momentCount: number,
 *   llmMomentCount: number,
 *   meetingInviteCount: number,
 *   hasDiagram: boolean,
 *   random?: () => number
 * }} args
 * @returns {{ kind: 'email'|'im'|'walkby'|'coffee'|'meeting-invite', useLlm: boolean } | null}
 */
export function pickNextMoment({
  now,
  sessionStartedAt,
  lastFiredAt,
  momentCount,
  llmMomentCount,
  meetingInviteCount,
  hasDiagram,
  random = Math.random
}) {
  if (momentCount >= OFFICE_SESSION_MOMENT_CAP) return null;
  if (now - sessionStartedAt < OFFICE_FIRST_MOMENT_MIN_MS) return null;
  const requiredGap = OFFICE_MIN_GAP_MS + random() * OFFICE_GAP_JITTER_MS;
  if (lastFiredAt > 0 && now - lastFiredAt < requiredGap) return null;

  const llmBudgetLeft = llmMomentCount < OFFICE_LLM_MOMENT_CAP;
  const eligible = MOMENT_WEIGHTS.filter(([kind]) => {
    if (kind === 'walkby') return hasDiagram && llmBudgetLeft;
    if (kind === 'meeting-invite') {
      return hasDiagram && meetingInviteCount < OFFICE_MEETING_INVITES_PER_SESSION;
    }
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
  return { kind, useLlm };
}
