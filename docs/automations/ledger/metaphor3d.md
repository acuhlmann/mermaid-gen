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

| Date       | Slice                                                                                                        | Bench (`expectationMatch` / cases) | Viewports captured                                        | PR   | Notes                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-30 | Queue 2 — group placards off their own members (subway + machine); carried queue 1's two in-budget doc fixes | 100% / 13                          | 390x844, 717x512, 1440x900 — both kinds, before and after | #457 | Subway route names sat at `getPoint(1)` (their own terminus) and machine axle names at `-radius * 0.78` (far edge, inside the bed): the last two violators of a rule city/garden/fused/archipelago were each fixed for. Readable labels 31/51 → 42/51. Last three runs were all composite, so composite was off-limits. |

_Runs from 2026-08-18 to 2026-08-30 predate this playbook; their record is the `Metaphor3D:` commit
series on `main`, and their findings are the Full-findings section of
`docs/agents/domains/metaphor3d.md` (moved out of the root context files on 2026-08-30)._

## Todos

| Id                          | State       | Item                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ladder-in-claude-md`       | **blocked** | Metaphor3D is the one slot missing from `CLAUDE.md` § Validation ladder. **`CLAUDE.md` is not in this automation's `allowedPaths`**, and the playbook forbids writing findings into the root files, so this cannot be done from here. It belongs to `improve` or to a human — do not keep picking it up. |
| `validation-kinds-10-of-15` | done        | Fixed 2026-08-30 (#457). All 15 kinds listed; the flowchart also gained the fence-strip rung, and the **"single-shot syntax fixer" line was simply wrong** — `repairMetaphorWithFixer` is a lite → flash → DeepSeek ladder like chart's and forms'. Nothing had listed that as drift.                    |
| `bench-baseline-stale`      | **blocked** | `apps/server/bench-results/**` is in this automation's `forbiddenPaths` and on the repo don't-touch list, so a refreshed baseline cannot be committed from here. Same disposition as `ladder-in-claude-md`.                                                                                              |
| `bench-header-rescue-count` | done        | Fixed 2026-08-30 (#457). Counted: **17 rescue functions emitting 80+ distinct labelled fixes** — the playbook's own "~40" was low too. The "script has ~17 cases" in the old note was a miscount of `expectedAccept` occurrences; the corpus is 13.                                                      |
| `blast-radius-rule`         | pending     | `scripts/test-affected-lib.mjs` has no `metaphor*` rule, so `test:affected` under-selects badly here. Outside this automation's paths — belongs to `improve` queue item 4.                                                                                                                               |
| `generation-bench`          | pending     | `benchMetaphorGeneration.js` is named as open work in `docs/guide/validation.md`; the harness is slot-agnostic. Costs tokens — weekly, `--samples 3`, never nightly. File an issue before starting.                                                                                                      |

## Open observations

- **The accented item's own name is unreadable in `subway`, and the accent stem is why.** `anchors`
  puts the accent at `TRACK_Y + 0.6` and the station label at `TRACK_Y + 0.95`, so the stem rises
  straight through the name it is marking — "Pay" rendered as "P y" on all three viewports, before
  and after this run's change, and on 1440x900 it disappears entirely. The same `anchors` map feeds
  `MetaphorLinks`, so raising it moves link endpoints too; the fix is probably a separate accent
  anchor rather than a shared one. Not this slice — it is the accent contract, not a group placard.
- **The label-legibility probe in `apps/web/.claude/skills/verify/SKILL.md` cannot be used as
  written on a base kind.** `window.__mv.cameras` collects **four** perspective cameras during
  mount — three dummies at the origin with `aspect: 1, fov: 50` and the live one — so
  `.find(c => c.isPerspectiveCamera)` returns a dummy and every label projects to the wrong pixel.
  Selecting by closest `aspect` to the canvas gets the right camera and the marker check STILL
  fails (markers land tens of px off the names), so something else is stale as well. Per the
  skill's own rule the run was thrown away and this slice was decided by reading screenshots. Worth
  a slice of its own: the probe is the only way to score a framing change, and right now it lies.
