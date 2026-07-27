/**
 * The three-tier org chart of the office fiction (docs/office-parody.md):
 *
 * - `team`   — your day-to-day collaborators (the advisor cast minus the CEO).
 *   They rotate through the proactive roundtable and drive the agent actions.
 * - `senior` — executives the team presents to. They take steering-meeting
 *   seats and may send one rare high-stakes email per session, but never join
 *   the ambient day-to-day casts (emails/IMs/walk-bys).
 *   Exception: `barker` is dual-home, so he also rotates through the
 *   roundtable at throttled weight — ADVISOR_ORDER / ADVISOR_PICK_WEIGHTS in
 *   ../hooks/useAdvisorOrchestrator.js own that membership, not this table.
 * - `office` — the ambient floor: colleagues doing their own thing who
 *   occasionally notice your work.
 *
 * Tier membership is a tag, not a data move — `barker` lives in both
 * VARIANT_PERSONAS (advisor seat) and SENIOR_STAKEHOLDERS (senior tier), and
 * `ciso` in OFFICE_COLLEAGUES; only `cto`/`cfo` are defined fresh
 * (SENIOR_STAKEHOLDERS in officeCast.js).
 */

export const CAST_TIERS = {
  team: ['gilfoyle', 'erlich', 'goMad', 'critique', 'explain'],
  senior: ['ciso', 'cto', 'cfo', 'barker'],
  office: ['intern', 'scrumMaster', 'helpdesk', 'facilities', 'hr', 'greybeard']
};

/** @returns {'team' | 'senior' | 'office' | null} */
export function tierOf(id) {
  for (const [tier, members] of Object.entries(CAST_TIERS)) {
    if (members.includes(id)) return tier;
  }
  return null;
}
