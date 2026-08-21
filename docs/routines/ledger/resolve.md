---
name: resolve
todos:
  - id: first-run
    content: 'First supervised run — confirm the backlog read works, one issue gets picked, the escalation path (open PR, no merge, ready-for-human relabel) is exercised at least once across the first few runs, and the merge path is exercised at least once too'
    status: pending
  - id: label-dependency
    content: 'ready-for-agent / needs-triage / needs-info / ready-for-human must exist as real GitHub labels before this routine can filter on them — review.md ledger flagged the same gap and it may still be open; confirm on first run'
    status: completed
  - id: 349-docs-half
    content: 'Issue #349 (benchMermaid documented invocation crashes) is only half-resolvable here: the three wrong invocations live in CLAUDE.md, AGENTS.md and docs/routines/review.md, all outside this playbook allowedPaths. The script own usage block is fixed and pinned by a sensor; the doc half needs a human or a routine whose budget reaches root docs.'
    status: pending
  - id: 348-owned-elsewhere
    content: 'Issue #348 (officeWorkingMemoryStore day-rollover write path) is already carried by open PR #350 from the review routine — not a resolve pick until that PR lands or closes. The fix it describes as already applied is NOT on main.'
    status: completed
  - id: 353-slow-list-half
    content: 'Issue #353 (anythingRuntimeBrowser.test.js load contention) is two-thirds out of budget. The reported case is fixed in-file, but the ROOT CAUSE is that this file spawns jsdom children like its sibling anythingRuntimeCheck.test.js yet is missing from SERVER_SLOW_TEST_FILES in scripts/test-affected-lib.mjs, so it runs in the parallel batch — and scripts/ is outside allowedPaths. The doc widening the issue asks for (docs/routines/README.md, docs/agents/sensors.md) is outside it too. Left open, ready-for-human.'
    status: pending
  - id: 353-floor-path-sibling
    content: 'anythingRuntimeBrowser.test.js line ~223 (a browser budget too tight to spawn jsdom still does not reject a valid page) carries the SAME latent exposure and was deliberately not pinned: it is the deterministic regression test for the separate-clock bug and its subject IS the floor, so an env pin would swap the floor path for the env path already covered a few lines above. It goes green only while the 6,000 ms floor outruns jsdom under load. Cured by the slow-list fix, not by anything in apps/**.'
    status: pending
---

# Ledger: `resolve`

Durable memory for the [`resolve`](../resolve.md) routine. Read the run log and the escalation
counts before picking an issue — one already escalated twice with no human action is not a fresh
pick, and a finding already attempted is not attempted again from scratch.

## Locked

Owner decisions this routine must not re-litigate. Add a dated row rather than arguing with one.

| Date       | Decision                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | `resolve` exists to work down the backlog `review`/`improve` file, not to replace their one-bug-per-run confidence bar — it applies the same bar per issue.                                                                              |
| 2026-08-21 | Merging is the default outcome; **escalation (open PR, don't merge, relabel `ready-for-human`) is for genuine uncertainty or risk, not a routine hedge.** Escalating everything defeats the point as surely as merging everything would. |
| 2026-08-21 | `needs-triage` issues are only attempted when they're already effectively scoped despite the label; a genuinely underspecified report gets a `needs-info` comment, not a guess.                                                          |

## Open observations

Things seen but not yet worth a locked decision. Promote to `Locked` when a second run confirms.

- **2026-08-21 — an issue filed against a doc is often unresolvable by this routine.** `allowedPaths`
  is `apps/**` / `packages/**` plus this ledger, so a finding whose fix is "correct the command in
  `CLAUDE.md`" is out of budget by construction — even though `README.md` rule 8 tells every routine
  to mirror durable learnings into `CLAUDE.md` and `AGENTS.md`. The `review` routine files doc bugs
  (both of the first backlog's issues touch docs), so this will recur. Either the budget grows a
  narrow doc lane or the ledger keeps accumulating half-done issues.
- **2026-08-21 (confirmed a second time, run 2) — the out-of-budget pattern is now the norm, not an
  edge case.** Both of run 2's candidates landed on it: #348 was already fixed on `main` (closed, no
  code), and #353's real fix is one line in `scripts/test-affected-lib.mjs` with a mirror in
  `docs/`. Two runs, three issues, and every one of them has had a half that `apps/**`/`packages/**`
  cannot reach. The routine is not short of judgement, it is short of two paths. If a third run
  repeats this, the answer is a narrow lane for `scripts/**` and the two mirror docs rather than
  another ledger row.
- **2026-08-21 — a load-contention flake can be reproduced deterministically by shrinking the
  budget it is racing, instead of trying to recreate the load.** #353 would not reproduce in a quiet
  container (676/676 green, twice). Temporarily lowering `DEFAULT_ANYTHING_RUNTIME_TIMEOUT_MS` from
  6000 to 300 turned the exact reported case red on demand, showed that the sibling floor-path test
  fails identically, and then showed the fix green under a floor deliberately too small — which is a
  stronger claim than "it passed on a quiet machine". Revert the constant before committing; the
  probe belongs in the transcript, not the diff.
- **2026-08-21 — check whether an issue already has an open PR before picking it.** `preflight`
  only refuses when **this** routine has one; a sibling routine's open PR is invisible to it.
  Issue #348 reads as a clean `ready-for-agent` pick and is already carried by PR #350.
- **2026-08-21 — `README.md` § 3's documented flake exception is named too narrowly.** It calls out
  `anythingRuntimeCheck.test.js`; the same load-contention class also bites
  `anythingRuntimeBrowser.test.js` → `a browser that hangs on startup does not reject a valid page`,
  which times out at 1200 ms and then falls back to jsdom. Under the full server suite it failed on
  an **unmodified `main`** checkout (671 pass / 1 fail) and passed 13/13 in isolation, so the
  established-not-mine check is: stash, re-run the suite on `main`, re-run the file alone. Filed as
  an issue rather than fixed — the exception list lives in `docs/`, outside this routine's paths.
- **2026-08-21 — a "suggested fix" in an issue is a hypothesis, not a spec.** #349 offered two
  fixes; the second (hand-roll a bench-local store so the bench runs under plain `node`) was
  verified non-viable — prototyped and run, it still died on `redactSecrets.ts`, and with
  `--import tsx` added it still died on `@antv/layout`. Both loader flags are required by
  `mermaidDiffTool.js` itself, below the bench. Cheaper to prototype than to reason about.

## Run log

Append one row per firing, including quiet runs (empty backlog).

| Date       | Issue picked                                                  | Outcome                                                                                                                                                 | PR   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-21 | #353 anythingRuntimeBrowser.test.js load contention (partial) | Merged — the reported case no longer races the runner; issue left open + `ready-for-human` for the root cause and the doc widening, both outside budget | #TBD | Closed #348 first with no code: PR #350 landed on `main`, so both halves of the fix it records (`rowFor` reconciling at its top, and the `does not drop the beat that itself rolls the day over` test) were already there. Reproduced #353 deterministically by shrinking the fallback floor rather than recreating suite load. Deliberately did **not** pin the sibling floor-path test — see the `353-floor-path-sibling` todo. |
| 2026-08-21 | #349 benchMermaid.js documented invocation crashes (partial)  | Merged — script's own usage block corrected + a sensor pinning it; issue left open for the three doc sites outside budget                               | #352 | Skipped #348 (already carried by open PR #350 from `review`) and #347 (unlabelled, outside the `ready-for-agent`/`needs-triage` gather filter). Labels confirmed live. Verified the issue's second suggested fix is non-viable.                                                                                                                                                                                                   |
