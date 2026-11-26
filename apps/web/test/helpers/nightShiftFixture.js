/**
 * A known Night Shift manifest for board, standup and floor tests — the baked
 * one follows the real ledgers and changes every night.
 */

/** One night: two shipped, one quiet, one no-show, one parked. */
export const NIGHT_FIXTURE = Object.freeze({
  shiftDate: '2026-11-24',
  crew: [
    {
      id: 'office-life',
      parked: false,
      lastSeen: '2026-11-24',
      tonight: [{ date: '2026-11-24', summary: 'Queue 0 — a new step', prs: [958], shipped: true }],
      earlier: [{ date: '2026-11-23', summary: 'Earlier slice.', prs: [955], shipped: true }]
    },
    {
      id: 'improve',
      parked: false,
      lastSeen: '2026-11-24',
      tonight: [{ date: '2026-11-24', summary: 'TypeScript leaves.', prs: [959], shipped: true }],
      earlier: []
    },
    {
      id: 'resolve',
      parked: false,
      lastSeen: '2026-11-24',
      tonight: [{ date: '2026-11-24', summary: 'None — backlog empty.', prs: [], shipped: false }],
      earlier: []
    },
    { id: 'prune', parked: false, lastSeen: '2026-09-19', tonight: [], earlier: [] },
    { id: 'canvas-graph-edit', parked: true, lastSeen: '2026-09-13', tonight: [], earlier: [] }
  ]
});
