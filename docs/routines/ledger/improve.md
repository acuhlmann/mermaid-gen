---
name: improve
todos:
  - id: register-loc
    content: 'Recompute the CLAUDE.md file-size budget table — every row was stale when this routine was written'
    status: completed
  - id: register-coupling
    content: 'Refresh balanced-coupling-priorities.md Implementation progress rows and the Last reviewed date'
    status: completed
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
  - id: runtime-fallback-budget
    content: "Give runAnythingJsdomCheck its own budget instead of resharing the browser rung's — the shared clock makes anythingRuntimeBrowser.test.js flaky on cold machines (needs apps/server/src/tools, outside this routine's allowlist; file as an issue)"
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

- **2026-08-21 — the browser rung's jsdom fallback reshares the browser's clock.**
  `apps/server/test/anythingRuntimeBrowser.test.js` → "a browser that hangs on startup does not
  reject a valid page" is flaky on cold containers, and unlike the `anythingRuntimeCheck.test.js`
  flake it fails **in isolation**, so the standing "re-run it alone" advice does not identify it.
  Root cause is in the production path, not the test: `runAnythingRuntimeCheck` passes
  `runAnythingJsdomCheck` the same `budgetMs` the browser rung already had, so the fallback has to
  spawn a child process and load its `tsx` import graph inside whatever clock is left. Documented
  in [`docs/agents/sensors.md`](../../agents/sensors.md); filed as `runtime-fallback-budget` below
  because the fix touches `apps/server/src/tools/`, outside this routine's allowlist.

## Run log

One row per firing, including runs that changed nothing. The ratchet numbers are the trend line.

| Date       | Slice taken                                                                                                                                                                                                                                                                                                                                                                                 | PR  | Ratchet numbers                                                                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | Register accuracy: recomputed CLAUDE.md § File-size budgets and ADR-0005's progress LOC notes against measured values; refreshed balanced-coupling-priorities.md's Implementation progress review date (rows still accurate). Ratchet drift: no violations; suite grew the right way (366→370 files, 3675→3733 cases) so tightened `docs/agents/ratchet.json`'s suite budget to lock it in. | TBD | monolithLoc: all 9 files exactly at budget (no drift); suite files 366→370 (budget tightened to 370); suite cases 3675→3733 (budget tightened to 3733); strictIslandFiles unchanged (15/22); lintWarnings not re-measured this run | First-ever firing. Left items 3–6 (test hardening, sensor gaps, TS leaves, doc drift) in `todos` for a future run — register accuracy was the highest unfinished queue item and filled the slice on its own. `npm run check` surfaced one red test that is not this diff's (docs-only diff; CI green on the same `main`): documented as a second known flake in `sensors.md` and filed as `runtime-fallback-budget`, since the real fix is outside this routine's allowlist. |
