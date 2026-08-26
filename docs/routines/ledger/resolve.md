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
  - id: 404-pick-parallel-edge-ref
    content: 'Issue #404 (pickFlowchartEdgeRef / pickStateEdgeRef byte-identical) — extracted `pickParallelEdgeRef` into `apps/web/src/utils/mermaidEdgeDisambiguation.js`; both families now share one rule and the four call sites import it. Behaviour-preserving, pinned by a new nine-case contract test proven load-bearing against four plausible extraction mistakes.'
    status: completed
  - id: 402-max-params-out-of-budget
    content: 'Issue #402 (renameFlowchartEdge/renameStateEdge max-params 6 > 5) — inspected twice and NOT attempted. 2026-08-25 counted 7 files against maxFiles 6; 2026-08-26 re-counted it at **9**, because the shared `adapter.renameEdge` call site has a third consumer the issue never names (`renameSequenceEdge`, 5th param `messageLabel`), so the Fix section as written silently renames the wrong parallel message in sequence diagrams. Relabelled `ready-for-human`: the only unblocker is a `maxFiles` change in `docs/routines/resolve.md`, which sits outside the allowedPaths of this routine.'
    status: pending
  - id: 393-gettotallength-fixture
    content: 'Issue #393 (bench corpus fixture `runtime-svg-gettotallength` stopped rejecting under the browser engine) — fixture now calls getTotalLength() on a <g> wrapper (throws in both engines) instead of a <rect> (real Chromium implements SVGGeometryElement.getTotalLength, jsdom does not); anythingDesignGuide craft rule corrected to SVGGeometryElement; new sweep in anythingRuntimeCheck.test.js runs the corpus runtime_error fixtures through whichever engine the suite is configured for.'
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
- **2026-08-23 — a `monolithLoc` ratchet violation currently has no routine that can fix it.**
  Run 4 found a backlog of exactly two issues, both the same shape: `improve` detects the
  regression, files it, and cannot fix it (`apps/web/src/components/**` and
  `apps/server/src/routes/**` are both in its `forbiddenPaths`), while `resolve` _can_ reach
  those paths but is told to skip anything asking for a hub split on sight (§ 2). So the
  handback ADR-0015 exists to close does not close for this class — #363 has sat since
  2026-08-21 and #381 joined it on 2026-08-22, and both will keep reappearing in
  `verify:ratchet` until a human or a feature-driven split shrinks the file. That is arguably
  working as designed (ADR-0005 says _split on contact_, and a schedule has no feature to be
  on contact with), but it means the ratchet’s findings accumulate with no owner. Worth naming
  before a third one lands: the choices are a narrow "extract one already-patterned slice"
  lane for `resolve`, or accepting that these issues are a human queue and labelling them
  `ready-for-human` on filing so they stop reading as agent backlog.
- **2026-08-24 — a bench-only expectation is an assertion nothing runs.** #393's fixture had been
  wrong since the day it landed (PR #386) and stayed green because `benchAnything.js` is not part of
  `npm test`: the only thing checking it was a human running the bench by hand. The fix therefore
  had two halves — correct the fixture, and give the corpus's runtime-rung expectations a home
  inside the suite that CI actually runs, so the "both engines are held to the same suite" identity
  covers them too. A corpus entry that only the bench reads is the `passes while examining nothing`
  trap moved one file over.
- **2026-08-24 — jsdom's missing API is not evidence that a real browser lacks it.** The fixture
  asserted `getTotalLength()` throws on a `<rect>`; that is true of jsdom's stub and false of every
  browser since Chrome 62, because the method lives on `SVGGeometryElement`. Any fixture whose
  expectation is "this API is absent" needs checking against the browser engine before it is
  trusted — absence in jsdom is the default, not a finding.
- **2026-08-25 — `checkJs` is `false`, so a JSDoc signature change to a `.js` module has no
  typecheck oracle at its call sites.** This is what made #402 unpickable rather than merely
  fiddly. Its fix regroups two trailing positional params into an options object across
  `renameFlowchartEdge` + `renameStateEdge`, whose one caller
  (`useFlowchartGraphEdit.js`'s `adapter.renameEdge`) is **shared by both adapters** — so the two
  halves cannot be split across runs either: change one signature and the other adapter receives
  an object where it expects a string, `typeof edgeLabel === 'string'` goes false, and the rename
  silently lands on `refs[0]` (the wrong parallel edge) with no error and no red test.
  `tsconfig.base.json` sets `checkJs: false`, so `npm run typecheck` cannot catch it, and no test
  exercises the hook's edge-rename path (`useFlowchartGraphEdit.test.jsx` commits node labels
  only). Pinning that path is a sixth code/test file, and with the ledger that is 7 against
  `maxFiles: 6` — § 2's third skip bullet, on arithmetic rather than on judgement. The general
  rule: **before picking a signature-change issue, ask what would catch a missed call site**; in
  this repo the answer is "a test, or nothing".
- **2026-08-25 — the out-of-budget pattern has now recurred a fourth time, in a new shape.**
  The three earlier instances were fixes whose other half lived in `docs/` or `scripts/`. #402 is
  the first whose missing half is _inside_ `apps/**` and still does not fit — it is one file over,
  and the file it is over by is the regression test that makes it safe. Worth naming because the
  remedy differs: a doc lane would not have helped here, a `maxFiles` of 7 would have.

- **2026-08-26 — the "suggested fix" rule has a sharper corollary: an issue that names its call
  sites can still have missed one, and the missed one is where the silent regression lives.** #402
  says the only consumer of the two changed signatures is `useFlowchartGraphEdit.js`'s
  `adapter.renameEdge(current, fromId, toId, label, edgeLabel, edgeIndex)`. True as far as it goes —
  but that hook drives **every** family's adapter through `canvasGraphEdit.js`, and a third
  implementation reads the same 5th positional slot: `renameSequenceEdge(source, fromId, toId,
label, messageLabel)`. Apply the issue's fix literally (flowchart + state + the call site) and the
  sequence family receives an object where it expects a string; `findSequenceMessageRange`'s
  `typeof label === 'string'` goes false, `wanted` is `''`, and the pick falls through to
  `matches[0]`. Measured on a two-message fixture: renaming the **second** `Alice->>Bob` message
  rewrote the **first**, returning `ok: true` with no error — the exact silent-wrong-edge failure the
  2026-08-25 comment described for the state adapter, one family over. The generalisation worth
  keeping: when a fix changes a **positional** signature reached through a shared dispatch table,
  enumerate the table's entries rather than the issue's, and grep for every implementation that
  reads the slot being repurposed — `checkJs: false` means nothing else will.
- **2026-08-26 — the out-of-budget pattern is now load-bearing, not incidental, and #402 is the
  proof.** Two consecutive runs have found a single-issue backlog they cannot act on. The
  arithmetic also got worse rather than better on second inspection (7 files → 9: three edit
  modules, the shared call site, three unit-test files, the hook test that is the only oracle for
  the riskiest hunk, plus this ledger). No slice of it is safely separable — the call site is
  shared, so every signature has to move in one diff or a family silently renames the wrong edge.
  That is not a judgement call this routine can improve on with more care; it is a budget one file
  cannot fit under any reading. Hence the relabel to `ready-for-human` rather than a third
  identical skip: the decision needed is `maxFiles` in `docs/routines/resolve.md`, and that file is
  outside `allowedPaths` by construction, so the routine can never take it.

- **2026-08-21 — a "suggested fix" in an issue is a hypothesis, not a spec.** #349 offered two
  fixes; the second (hand-roll a bench-local store so the bench runs under plain `node`) was
  verified non-viable — prototyped and run, it still died on `redactSecrets.ts`, and with
  `--import tsx` added it still died on `@antv/layout`. Both loader flags are required by
  `mermaidDiffTool.js` itself, below the bench. Cheaper to prototype than to reason about.

## Run log

Append one row per firing, including quiet runs (empty backlog).

| Date       | Issue picked                                                                                         | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | PR   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-26 | None — #402, the only open issue, is out of budget by 3 files                                        | Quiet run, no product code changed. Re-inspected #402 against `cc2a47b` rather than trusting the 2026-08-25 count, and the count is worse than recorded: **9 files against `maxFiles: 6`**. The issue names two edit modules and one shared call site, but `useFlowchartGraphEdit.js` drives every family's adapter, and `renameSequenceEdge` reads the same 5th positional slot as a `messageLabel` string. Proved the consequence on a two-message fixture — passing `{ edgeLabel: 'second' }` where a string is expected renames the **first** message and returns `ok: true`. So the fix cannot be sliced: three signatures, one call site, three unit-test files and the hook test that is the only oracle for the shared hunk all have to land together. § 2's third skip bullet, on arithmetic.                  | —    | Commented once on #402 with the corrected file table and the measured sequence-family hazard (new information, not a restatement of the 2026-08-25 comment), and relabelled it `ready-for-human`: the only unblocker is a `maxFiles` bump in `docs/routines/resolve.md`, which this routine's `allowedPaths` structurally excludes, so leaving it `ready-for-agent` buys nothing but a third identical skip. Backlog was otherwise empty (1 open issue total).                                                                                                                                                         |
| 2026-08-25 | #404 `pickFlowchartEdgeRef` and `pickStateEdgeRef` are byte-identical                                | Merged — the shared "index wins, then label, then first; a stale label refuses" rule extracted to `apps/web/src/utils/mermaidEdgeDisambiguation.js` as `pickParallelEdgeRef`; the two private copies deleted and all four call sites (`deleteFlowchartEdge`, `renameFlowchartEdge`, `deleteStateEdge`, `renameStateEdge`) repointed. Behaviour-preserving, so nothing could go red first; instead the new nine-case contract test was proven load-bearing by perturbing the helper four ways an extraction plausibly could — truthy index check (demotes index 0, 3 red), label-before-index precedence (2 red), stale label falling back to `refs[0]` (1 red), out-of-range index falling back to `refs[0]` (1 red) — each red, restored green. Existing flowchart/state/canvas suites (93 tests) unchanged and green. | #406 | Merge path, not escalation: no trust boundary, no ambiguity (the issue named the helper, the new module and all four call sites), neither file is on the ADR-0005 monolith table, and the tests are direct transcriptions of the behaviour both copies already had. **#402 inspected and deliberately not picked** — its fix is one file over budget once the shared, unpinned call site is tested; see the 2026-08-25 open observations and the comment left on the issue. #391 skipped again: its fix is `docs/agents/ratchet.json`, outside `allowedPaths`.                                                         |
| 2026-08-24 | #393 Anything corpus fixture `runtime-svg-gettotallength` no longer rejects under the browser engine | Merged — fixture rewritten to call `getTotalLength()` on a `<g>` wrapper (no `getTotalLength` in either engine) instead of a `<rect>` (real Chromium implements it via `SVGGeometryElement`; only jsdom's stub throws), and the `anythingDesignGuide.js` craft rule corrected from "SVGPathElement-only" to the real `SVGGeometryElement` set with the anti-pattern reframed as "not a geometry element at all". Red first: the new corpus sweep in `anythingRuntimeCheck.test.js` failed on the unfixed corpus under `ANYTHING_RUNTIME_ENGINE=browser` naming the exact fixture, and passes 18/18 under **both** engines after. `benchAnything.js` back to `expectationMatch: 100`, no regressions, under `auto`/browser and jsdom alike.                                                                              | #396 | Merge path, not escalation: the diff touches a prompt string and a bench fixture, not a trust boundary; the issue named both files and the correct behaviour; the test is a direct transcription of the reported drift. `acceptRate` moved 36 → 32 by design — the fixture is now rejected, and `acceptRate` is a property of the corpus rather than a quality signal. #391 skipped: its fix is `docs/agents/ratchet.json` (outside `allowedPaths`) plus a real lint-warning reduction in `copilot.ts`, an ADR-0005 split target — § 2's skip-on-sight bullet, and the issue itself defers the budget call to a human. |
| 2026-08-23 | None — no in-scope issue in the backlog                                                              | Quiet run, no code changed. Both open issues are `monolithLoc` ratchet violations whose stated fix is a tracked hub split: #363 (`DiagramCanvas.jsx` 1983/1968) is labelled `ready-for-human`, outside the gather filter; #381 (`copilot.ts` 1272/1270) is unlabelled _and_ names the queued `copilot.ts` → route-modules split as its fix, which is § 2’s first skip-on-sight bullet. Neither was touched.                                                                                                                                                                                                                                                                                                                                                                                                             | —    | Backlog was otherwise empty (2 open issues total, both above). Nothing relabelled: #381 is not `needs-triage`, so § 1’s triage branch does not apply to it, and commenting on an issue this routine is structurally unable to action would be a nag rather than a service. New open observation recorded: ratchet violations on monolith paths currently have no routine that can act on them.                                                                                                                                                                                                                         |
| 2026-08-22 | #368 mermaidSequenceEdit.js duplicated participant-guard chain                                       | Merged — `requireParticipant` / `requireEdgeParticipants` extracted; the six mutators now share two guards instead of repeating five-line chains. Behaviour-preserving, so no test could go red first; instead a new guard-precedence sweep pins all six call sites and was proven load-bearing by perturbing the chain (`missing` where `bad-id` is correct) and watching it fail.                                                                                                                                                                                                                                                                                                                                                                                                                                     | #370 | Merge path, not escalation: not a trust boundary, the issue named the exact helper, the tests are direct transcriptions of current behaviour, and the file is not on the ADR-0005 monolith table. #363 skipped — labelled `ready-for-human`, outside this routine's gather filter. Backlog was otherwise empty.                                                                                                                                                                                                                                                                                                        |
| 2026-08-21 | #353 anythingRuntimeBrowser.test.js load contention (partial)                                        | Merged — the reported case no longer races the runner; issue left open + `ready-for-human` for the root cause and the doc widening, both outside budget                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | #356 | Closed #348 first with no code: PR #350 landed on `main`, so both halves of the fix it records (`rowFor` reconciling at its top, and the `does not drop the beat that itself rolls the day over` test) were already there. Reproduced #353 deterministically by shrinking the fallback floor rather than recreating suite load. Deliberately did **not** pin the sibling floor-path test — see the `353-floor-path-sibling` todo.                                                                                                                                                                                      |
| 2026-08-21 | #353 anythingRuntimeBrowser.test.js load contention (root cause, human-directed)                     | Closed — user asked to finish the escalated root cause directly. `anythingRuntimeBrowser.test.js` added to `SERVER_SLOW_TEST_FILES` (scripts/test-affected-lib.mjs), moving it into the serial slow-Anything batch. Verified: 4-file slow batch green (56/56) under `--test-concurrency=1`, full `npm run check` green. No doc widening needed — the file no longer races, so no new flake exception to document.                                                                                                                                                                                                                                                                                                                                                                                                       | #357 | Not a `resolve` routine firing — a direct follow-up requested by the repo owner in the same session that filed and partially fixed #353, to avoid leaving a known one-line fix sitting in the backlog. Recorded here so a future `resolve` run doesn't rediscover it.                                                                                                                                                                                                                                                                                                                                                  |
| 2026-08-21 | #349 benchMermaid.js documented invocation crashes (partial)                                         | Merged — script's own usage block corrected + a sensor pinning it; issue left open for the three doc sites outside budget                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | #352 | Skipped #348 (already carried by open PR #350 from `review`) and #347 (unlabelled, outside the `ready-for-agent`/`needs-triage` gather filter). Labels confirmed live. Verified the issue's second suggested fix is non-viable.                                                                                                                                                                                                                                                                                                                                                                                        |
