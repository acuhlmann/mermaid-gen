---
name: improve
todos:
  - id: register-loc
    content: 'Recompute the CLAUDE.md file-size budget table — every row was stale when this routine was written'
    status: pending
  - id: register-coupling
    content: 'Refresh balanced-coupling-priorities.md Implementation progress rows and the Last reviewed date'
    status: pending
  - id: scoreboard-unlisted
    content: 'File issues for over-threshold files absent from legacy-monoliths.js (officeCast.js 2789, officeMomentStore.js 938) — issue, never a new suppression'
    status: pending
  - id: sensor-floor-inverse
    content: 'Inverse check: every apps/web/test/officeFloor* file must appear in ISOMETRIC_FLOOR_BLAST_TESTS'
    status: pending
  - id: sensor-strict-island-sync
    content: 'Assert SERVER_STRICT_ISLAND_FILES matches apps/server/tsconfig.strict.json'
    status: pending
  - id: sensor-guidance-sync
    content: 'Assert formatter.cjs GUIDANCE agrees with guidance.js'
    status: pending
  - id: glossary-unchecked
    content: 'GLOSSARY.md is in no verify:doc-paths scan list; decide whether to add it or explain why not'
    status: pending
  - id: readme-dup
    content: 'README.md and docs/guide/README.md duplicate the operator table — reconcile or collapse one into a pointer'
    status: pending
  - id: ts-leaves
    content: 'Begin apps/web/src/utils leaf conversions per convert-js-leaf-to-ts.md — apps/web is 3.8% TypeScript'
    status: pending
  - id: lint-promotion-evidence
    content: 'All 1206 ESLint findings are warnings and zero are errors; gather quiet-period evidence for one rule and file it for a human decision'
    status: pending
---

# Ledger: `improve`

Durable memory for the [`improve`](../improve.md) routine. One slice per run; push the rest back
into `todos`.

## Locked

Owner decisions this routine must not re-litigate. Add a dated row rather than arguing with one.

| Date       | Decision                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 | The ratchet **gates no build**. It is this routine's work queue, not a CI check. Two unattended feature automations run here daily; a metric that reddens their build teaches budget-raising, not fixing. |
| 2026-08-20 | An over-threshold file gets an **issue**, never a new `legacy-monoliths.js` suppression. The scoreboard only means something if it can go down.                                                           |
| 2026-08-20 | No lint severity is promoted `warn` → `error` by this routine. ADR-0007 wants a two-week quiet period; present evidence, a human decides.                                                                 |
| 2026-08-20 | No unprompted hub splits. `components/`, `state/`, `routes/` and `mcp/` are forbidden paths for exactly this reason.                                                                                      |

## Open observations

_(none yet)_

## Run log

One row per firing, including runs that changed nothing. The ratchet numbers are the trend line.

| Date                | Slice taken | PR  | Ratchet numbers | Notes |
| ------------------- | ----------- | --- | --------------- | ----- |
| _pending first run_ | —           | —   | —               | —     |
