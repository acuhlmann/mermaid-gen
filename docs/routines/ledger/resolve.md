---
name: resolve
todos:
  - id: first-run
    content: 'First supervised run — confirm the backlog read works, one issue gets picked, the escalation path (open PR, no merge, ready-for-human relabel) is exercised at least once across the first few runs, and the merge path is exercised at least once too'
    status: pending
  - id: 368-guard-dedup
    content: 'Issue #368 (mermaidSequenceEdit.js duplicated participant-guard chain) — extracted requireParticipant / requireEdgeParticipants; six call sites now share two guards. Behaviour-preserving, pinned by a new guard-precedence sweep in mermaidSequenceEdit.test.js.'
    status: completed
  - id: label-dependency
    content: 'ready-for-agent / needs-triage / needs-info / ready-for-human must exist as real GitHub labels before this routine can filter on them — review.md ledger flagged the same gap and it may still be open; confirm on first run'
    status: completed
  - id: 349-docs-half
    content: 'Issue #349 (benchMermaid documented invocation crashes) — doc sites updated 2026-08-21 doc automation: CLAUDE.md, GLOSSARY.md, validation/development/coding-agents guides, testing.md, add-rule-pack recipe, review routine. Script header + benchScriptUsage.test.js sensor were already fixed in PR #352.'
    status: completed
  - id: 348-owned-elsewhere
    content: 'Issue #348 (officeWorkingMemoryStore day-rollover write path) — fixed on main via PR #350 (2026-08-21). rowFor() reconciles before merge; test "does not drop the beat that itself rolls the day over" pins it.'
    status: completed
  - id: 353-slow-list-half
    content: 'Issue #353 root cause fixed directly by the human owner (not this routine — the fix lives in scripts/, outside allowedPaths): anythingRuntimeBrowser.test.js added to SERVER_SLOW_TEST_FILES in scripts/test-affected-lib.mjs, PR #357. It now runs in the serial slow-Anything batch alongside anythingRuntimeCheck.test.js instead of the parallel fast batch, which removes the load contention at its source. Issue closed. No doc widening was needed in the end — the file no longer races anything, so docs/routines/README.md § 3 and docs/agents/sensors.md gained no new flake exception.'
    status: completed
  - id: 353-floor-path-sibling
    content: 'anythingRuntimeBrowser.test.js line ~223 (a browser budget too tight to spawn jsdom still does not reject a valid page) carried the SAME latent exposure and was deliberately left unpinned in #356 because pinning it would have swapped the floor path for the env path already covered nearby. Confirmed cured by the slow-list fix (PR #357): full 4-file slow batch (56 tests) green under --test-concurrency=1, including this case, with no env pin needed.'
    status: completed
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
- **2026-08-22 — a behaviour-preserving issue cannot be made red first, and that is not a reason to
  skip it.** #368 is a `review` Standards-axis duplication finding: `review` filed it precisely
  _because_ it had no failing test to write. `README.md` § 1 scopes the failing-test rule to **a bug
  fix**; for behaviour-preserving work the oracle is the suite staying green. The honest substitute
  for "observe it red" is to prove the _added_ tests are load-bearing: write the characterization
  test, then deliberately introduce the mistake the change could make and watch that go red. Here,
  regrouping the guard chain per-argument (`requireParticipant(from) || requireParticipant(to)`)
  reports `missing` where the real chain reports `bad-id` — one assertion caught it. A
  characterization test nobody has seen fail is the "passes while examining nothing" trap in its
  politest form.
- **2026-08-22 — "no unprompted refactors" is about hub splits, not local de-duplication.**
  `resolve.md` § 2's skip bullet cites `balanced-coupling-priorities.md` and "split on contact", and
  every word of that rationale is about module boundaries. Extracting a five-line guard into a
  helper _in the same file_ moves no boundary, changes no coupling and adds no edge to the
  dependency graph — dep-cruiser's module/dependency counts were identical before and after. If the
  skip bullet were read literally, `resolve` could never work down the Standards-axis findings
  `review` is designed to hand it, which is the loop ADR-0015 exists to close.
- **2026-08-21 — a "suggested fix" in an issue is a hypothesis, not a spec.** #349 offered two
  fixes; the second (hand-roll a bench-local store so the bench runs under plain `node`) was
  verified non-viable — prototyped and run, it still died on `redactSecrets.ts`, and with
  `--import tsx` added it still died on `@antv/layout`. Both loader flags are required by
  `mermaidDiffTool.js` itself, below the bench. Cheaper to prototype than to reason about.

## Run log

Append one row per firing, including quiet runs (empty backlog).

| Date       | Issue picked                                                                     | Outcome                                                                                                                                                                                                                                                                                                                                                                                                           | PR   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-22 | #368 mermaidSequenceEdit.js duplicated participant-guard chain                   | Merged — `requireParticipant` / `requireEdgeParticipants` extracted; the six mutators now share two guards instead of repeating five-line chains. Behaviour-preserving, so no test could go red first; instead a new guard-precedence sweep pins all six call sites and was proven load-bearing by perturbing the chain (`missing` where `bad-id` is correct) and watching it fail.                               | #TBD | Merge path, not escalation: not a trust boundary, the issue named the exact helper, the tests are direct transcriptions of current behaviour, and the file is not on the ADR-0005 monolith table. #363 skipped — labelled `ready-for-human`, outside this routine's gather filter. Backlog was otherwise empty.                                                                                                                   |
| 2026-08-21 | #353 anythingRuntimeBrowser.test.js load contention (partial)                    | Merged — the reported case no longer races the runner; issue left open + `ready-for-human` for the root cause and the doc widening, both outside budget                                                                                                                                                                                                                                                           | #356 | Closed #348 first with no code: PR #350 landed on `main`, so both halves of the fix it records (`rowFor` reconciling at its top, and the `does not drop the beat that itself rolls the day over` test) were already there. Reproduced #353 deterministically by shrinking the fallback floor rather than recreating suite load. Deliberately did **not** pin the sibling floor-path test — see the `353-floor-path-sibling` todo. |
| 2026-08-21 | #353 anythingRuntimeBrowser.test.js load contention (root cause, human-directed) | Closed — user asked to finish the escalated root cause directly. `anythingRuntimeBrowser.test.js` added to `SERVER_SLOW_TEST_FILES` (scripts/test-affected-lib.mjs), moving it into the serial slow-Anything batch. Verified: 4-file slow batch green (56/56) under `--test-concurrency=1`, full `npm run check` green. No doc widening needed — the file no longer races, so no new flake exception to document. | #357 | Not a `resolve` routine firing — a direct follow-up requested by the repo owner in the same session that filed and partially fixed #353, to avoid leaving a known one-line fix sitting in the backlog. Recorded here so a future `resolve` run doesn't rediscover it.                                                                                                                                                             |
| 2026-08-21 | #349 benchMermaid.js documented invocation crashes (partial)                     | Merged — script's own usage block corrected + a sensor pinning it; issue left open for the three doc sites outside budget                                                                                                                                                                                                                                                                                         | #352 | Skipped #348 (already carried by open PR #350 from `review`) and #347 (unlabelled, outside the `ready-for-agent`/`needs-triage` gather filter). Labels confirmed live. Verified the issue's second suggested fix is non-viable.                                                                                                                                                                                                   |
