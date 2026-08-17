/**
 * Whether a completed run may walk someone over, rather than landing as IM.
 *
 * Idle is today's run-reaction gates minus `floorActive`, plus: not in talk,
 * not in a floor card, not mid-commute, not mid-dwell line. Standing still
 * for `DWELL_MS` is not required — the 2.2s run-reaction delay is the
 * "it just landed" beat (docs/office-continuity.md).
 *
 * The hint card and a durable errand do **not** count: those are the floor
 * at rest, and treating them as busy would swallow every walk the way
 * counting an errand in `hasActiveOfficeSurface` would silence the office.
 */

/**
 * @param {{
 *   standingFree?: boolean,
 *   phase?: string | null,
 *   dwellSaid?: unknown,
 *   person?: unknown,
 *   join?: unknown,
 *   sceneJoin?: unknown
 * }} state
 * @returns {boolean}
 */
export function isFloorRunIdle({
  standingFree = false,
  phase = null,
  dwellSaid = null,
  person = null,
  join = null,
  sceneJoin = null
} = {}) {
  return (
    Boolean(standingFree) && phase !== 'walking' && !dwellSaid && !person && !join && !sceneJoin
  );
}

/**
 * Snapshot the run-reaction picker reads at fire time.
 *
 * @param {{
 *   standingFree?: boolean,
 *   phase?: string | null,
 *   dwellSaid?: unknown,
 *   person?: unknown,
 *   join?: unknown,
 *   sceneJoin?: unknown,
 *   awayIds?: string[],
 *   youTile?: { x: number, y: number } | null
 * }} state
 * @returns {{ idle: boolean, awayIds: string[], youTile: { x: number, y: number } | null }}
 */
export function floorRunContextFor(state = {}) {
  return {
    idle: isFloorRunIdle(state),
    awayIds: Array.isArray(state.awayIds) ? [...state.awayIds] : [],
    youTile: state.youTile ?? null
  };
}
