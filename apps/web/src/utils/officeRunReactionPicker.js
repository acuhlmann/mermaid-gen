/**
 * Who reacts to a completed run, and how they arrive
 * (docs/office-continuity.md).
 *
 * One colleague. Prefer someone already in today's working memory who can
 * walk. Else the intersection who can both IM and walk. Never senior. Never
 * already away in a set piece. Path must exist for a walk. Otherwise IM-in-tray.
 *
 * Desk IM for this producer uses the same picker, skipping the path check.
 * Walk-by only happens when the caller asks for a walk *and* a path exists —
 * canned fallbacks stay IM (no fake walk from the walk-by bank).
 */

import { CAST_TIERS } from './castTiers.js';
import { VISITOR_TILE, walkPathFrom } from './officeFloorPlan.js';

/**
 * Intersection of `OFFICE_IM_LLM_CAST` and the walkable office tier, minus
 * `russ` (he can IM, he does not walk for this producer). Do not use
 * `OFFICE_WALKBY_LLM_CAST` — that list is larger and includes people this
 * slice is not licensed to send.
 */
export const OFFICE_RUN_WALK_CAST = ['intern', 'scrumMaster', 'greybeard'];

const SENIOR = new Set(CAST_TIERS.senior);
const WALK_CAST = new Set(OFFICE_RUN_WALK_CAST);

function canWalkTo(id, youTile) {
  if (SENIOR.has(id)) return false;
  const path = walkPathFrom(id, youTile ?? VISITOR_TILE);
  return Array.isArray(path) && path.length >= 2;
}

/**
 * @param {{
 *   wantWalk?: boolean,
 *   awayIds?: Iterable<string>,
 *   youTile?: { x: number, y: number } | null,
 *   memoryIds?: string[]
 * }} args
 * @returns {{
 *   colleagueId: string | null,
 *   kind: 'walkby' | 'im',
 *   situation: 'runWalk' | 'run'
 * }}
 */
export function pickRunReactionColleague({
  wantWalk = false,
  awayIds = [],
  youTile = null,
  memoryIds = []
} = {}) {
  const away = new Set(awayIds);
  const eligible = OFFICE_RUN_WALK_CAST.filter((id) => !away.has(id) && !SENIOR.has(id));
  const memoryEligible = (Array.isArray(memoryIds) ? memoryIds : []).filter(
    (id) => WALK_CAST.has(id) && !away.has(id) && !SENIOR.has(id)
  );
  const prefer = memoryEligible.length > 0 ? memoryEligible : eligible;

  if (wantWalk) {
    const walker = prefer.find((id) => canWalkTo(id, youTile)) ?? null;
    if (walker) {
      return { colleagueId: walker, kind: 'walkby', situation: 'runWalk' };
    }
  }

  const speaker = prefer[0] ?? null;
  return { colleagueId: speaker, kind: 'im', situation: 'run' };
}
