---
name: hygiene
todos:
  - id: register-loc
    content: 'Recompute the CLAUDE.md file-size budget table — every row was stale when this routine was written'
    status: pending
  - id: register-coupling
    content: 'Refresh balanced-coupling-priorities.md Implementation progress rows and the Last reviewed date'
    status: pending
  - id: scoreboard-unlisted
    content: 'File issues for over-threshold files absent from legacy-monoliths.js (officeCast.js, officeMomentStore.js) — issue, never a new suppression'
    status: pending
  - id: glossary-unchecked
    content: 'GLOSSARY.md is in no verify:doc-paths scan list; decide whether to add it or explain why not'
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
  - id: readme-dup
    content: 'README.md and docs/guide/README.md duplicate the operator table — reconcile or collapse one into a pointer'
    status: pending
---

# Ledger: `hygiene`

Durable memory for the [`hygiene`](../hygiene.md) routine. One slice per run; push the rest back
into `todos`.

## Locked

| Date       | Decision                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-20 | `hygiene` may not write to `apps/**` or `packages/shared/**`. That budget — not the tier — is what makes self-merging safe.                                      |
| 2026-08-20 | An over-threshold file gets an **issue**, never a new `legacy-monoliths.js` suppression. The scoreboard only means something if it can go down.                  |
| 2026-08-20 | No lint severity is promoted `warn` → `error` by this routine. ADR-0007 requires a two-week quiet period; the routine may present the evidence, a human decides. |

## Open observations

_(none yet)_

## Run log

| Date                | Slice taken | PR  | Ratchet delta | Notes |
| ------------------- | ----------- | --- | ------------- | ----- |
| _pending first run_ | —           | —   | —             | —     |
