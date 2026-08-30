# Ledger: `metaphor3d`

Durable memory for the Metaphor3D feature automation. Read the last three rows before starting;
they are what stops a cold-start run from re-polishing the corner the last one polished.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-30 | Playbook created. This automation ran from 2026-08-18 with its instructions in the cron blob and no ledger, budget or guard — ADR-0014 named it as one of the two jobs the shelf had not yet absorbed.                                                                                                                  |
| 2026-08-30 | Read **`expectationMatch`**, never `acceptRate`, from `benchMetaphor.js`. The accept rate is a property of the corpus and falls as the corpus grows, because each new fixture is a must-reject case. Same rule as the `anything` automation's, and for the same reason.                                                 |
| 2026-08-30 | Visual work is gated by a **screenshot in the PR body**, not by a path ban. Banning `.jsx` would be mechanically enforceable and would delete this automation's proven capability — the scene files are where the visual work is. `review`'s Spec axis is the check on an unevidenced claim.                            |
| 2026-08-30 | Findings go in **this ledger** first. Only a rule a future agent would otherwise rediscover the hard way graduates to `CLAUDE.md` / `AGENTS.md`. Twelve nights of findings went straight to the root docs and grew the Metaphor3D section to 54 KB + 27 KB mirrored, paid by every agent session in the repo.           |
| 2026-08-30 | Two MCP connectors (Google-Drive, `imagine_mcp`) were attached to this routine's trigger and used by nothing. Removed. `allowed_tools` was also missing `Skill`, `Task`, `BashOutput` and `KillBash`, so the routine **could not invoke the `verify` skill** written for it, nor run a background dev server. Restored. |

## Run log

Append one row per firing, including quiet runs.

| Date | Slice | Bench (`expectationMatch` / cases) | Viewports captured | PR  | Notes |
| ---- | ----- | ---------------------------------- | ------------------ | --- | ----- |

_No rows yet under this playbook. Runs from 2026-08-18 to 2026-08-30 predate it; their record is
the `Metaphor3D:` commit series on `main`, and their findings are the Full-findings section of
`docs/agents/domains/metaphor3d.md` (moved out of the root context files on 2026-08-30)._

## Todos

| Id                          | State   | Item                                                                                                                                                                                                |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ladder-in-claude-md`       | pending | Metaphor3D is the one slot missing from `CLAUDE.md` § Validation ladder.                                                                                                                            |
| `validation-kinds-10-of-15` | pending | `docs/guide/validation.md` § Metaphor3D lists 10 of 15 kinds — missing `bridge`, `cycle`, `subway`, `iceberg`, `composite`.                                                                         |
| `bench-baseline-stale`      | pending | Committed baseline is 13 cases from 2026-07-11; the script has ~17. Refresh.                                                                                                                        |
| `bench-header-rescue-count` | pending | `benchMetaphor.js` header says "~14 deterministic rescue passes"; `metaphorSanitizer.ts` has ~40.                                                                                                   |
| `blast-radius-rule`         | pending | `scripts/test-affected-lib.mjs` has no `metaphor*` rule, so `test:affected` under-selects badly here. Outside this automation's paths — belongs to `improve` queue item 4.                          |
| `generation-bench`          | pending | `benchMetaphorGeneration.js` is named as open work in `docs/guide/validation.md`; the harness is slot-agnostic. Costs tokens — weekly, `--samples 3`, never nightly. File an issue before starting. |

## Open observations

_(none yet)_
