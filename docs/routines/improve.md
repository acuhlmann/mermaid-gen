---
name: improve
tier: code-writing
schedule: '0 8 * * *'
maxFiles: 10
allowedPaths:
  - docs/**
  - '*.md'
  - scripts/verify-*.mjs
  - scripts/verify-*.test.mjs
  - packages/eslint-config/**
  - apps/*/test/**
  - packages/shared/test/**
  - apps/*/tsconfig.strict.json
  - apps/web/src/utils/**
  - apps/web/src/components/**
  - apps/web/src/state/**
  - apps/server/src/agents/**
  - apps/server/src/routes/**
  - apps/server/src/mcp/**
---

# Routine: `improve`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Makes the project a little better every day. One slice per run, then stop. Opens a PR, merges it
when CI is green.

Take the **highest unfinished queue item that fits the budget**. Push the rest back into the
ledger's `todos`. A run that does one thing properly beats a run that half-does four.

## Queue

### 1. Register accuracy

Three hand-maintained registers claim numbers reality has moved past. Recompute and correct:
the `CLAUDE.md` § File-size budgets table, [`docs/decisions/0005-monolith-splits.md`](../decisions/0005-monolith-splits.md),
and [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md)
§ Implementation progress (including its **Last reviewed** date).

### 2. Ratchet drift

```bash
npm run verify:ratchet -- --json
npm run verify:ratchet -- --with-lint      # when lint numbers are the question
```

Whatever moved the wrong way is a candidate task. Whatever moved the right way past its budget is a
free win — tighten that budget to lock it in (tightening needs no written reason; only loosening
does). Record the numbers in the ledger row either way: that log is the trend line, and it is the
only thing that can answer "is this project actually getting better?" in three months.

The ratchet gates no build. Nothing is blocked by a regression here — it is simply this routine's
work.

### 3. Test hardening

Apply the trap checklist from [`review.md`](review.md) § 2 to **existing** suites, not just new
diffs. Dead `vi.mock` paths, sweeps with no non-empty companion assertion, one-block `act`, floor
tests missing the midday clock pin or the `0.75` PRNG seed.

**Never delete a test.** Before repairing a dead mock, establish what it was doing: one that has
never executed is not load-bearing, so deleting it is a zero-behaviour change while making it live
is a real one.

### 4. Sensor gaps

Turn a class of drift into a check that catches it for free. One per run, with tests **and a
deliberate negative case** — break the thing on purpose, watch the sensor fail, put it back. A
sensor never observed failing has not been tested.

Known gaps: `ISOMETRIC_FLOOR_BLAST_TESTS` in `scripts/test-affected-lib.mjs` runs behind
`apps/web/test/officeFloor*` (the existing sensor catches dangling refs, not missing ones);
`SERVER_STRICT_ISLAND_FILES` in `packages/eslint-config/typeCheckedIsland.js` duplicates
`apps/server/tsconfig.strict.json` with nothing asserting they agree; `formatter.cjs`'s `GUIDANCE`
map duplicates `guidance.js` the same way.

### 5. TypeScript leaves

One or two per run, following [`docs/recipes/convert-js-leaf-to-ts.md`](../recipes/convert-js-leaf-to-ts.md)
exactly — `git mv` to preserve history, importers untouched, path appended to the relevant
`tsconfig.strict.json`.

Respect ADR-0006's sequencing: order by **churn, not size**; `mcpServer.js` waits for its ADR-0005
split, `diagramStore.js` likewise, `App.jsx` converts _as_ it splits and never both at once. Pure
`apps/web/src/utils/*.js` leaves are the intended starting ground, which is why they are the only
`apps/web/src` path in this routine's allowlist.

### 6. Doc drift

`GLOSSARY.md` is scanned by no check at all, while [`docs/agents/domain.md`](../agents/domain.md)
tells every agent to prefer its terms — so glossary drift silently degrades every downstream issue
title and test name. `README.md` and [`docs/guide/README.md`](../guide/README.md) carry
near-identical operator tables that will diverge.

### 7. Coupling splits (ADR-0016)

A file over its [ADR-0005](../decisions/0005-monolith-splits.md) budget, or a duplicated wire
constant flagged in [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md),
is in budget **when it matches an extraction pattern already used elsewhere in the file** —
closure helpers into a sibling `*Helpers.{js,ts}`, a per-feature `register*`/feature hook, a
duplicated enum into `packages/shared`. Do the smallest slice that clears the specific violation
(e.g. the one family of graph-edit handlers that pushed the file over budget), not a full
reorganisation. Update the ADR-0005 table and `balanced-coupling-priorities.md` § Implementation
progress in the same PR.

If the extraction isn't a clear instance of an existing pattern — the seam is ambiguous, or fixing
it means picking between two reasonable designs — push the branch, open the PR, do **not** merge,
and say what's unsure in the PR body (ADR-0015's escalation exception). One split per run.

### 8. Lint severity promotion (ADR-0016)

For a rule that has sat at `warn` for at least two weeks: `git log --since="2 weeks ago" -S'<rule
name>' -- '**/*.js' '**/*.jsx' '**/*.ts' '**/*.tsx'` (or grep the diff of each commit touching
`eslint-disable` lines) for any suppression added in that window. If the window since the later of
the rule's introduction or its last promotion attempt (check the ledger) is at least two weeks and
turns up nothing, flip the rule to `error` in `packages/eslint-config/**`, run `npm run check`, and
record the evidence (the command and its empty output, the date range) in the PR body and ledger. If
the window isn't old enough yet or turns up a suppression, leave it as a ledger `todo` — nothing to
decide, just not ready.

## Not this routine's job

No new dependencies. Adding a package is a licence/supply-chain/bundle decision — file an issue.

No slot content, ever — ADR-0010 reserves the product's six diagram slots (mermaid, infographic,
metaphor3d, chart, anything, forms) for the user's own pipeline. Refactoring the code that manages a
slot (e.g. splitting `diagramStore.js`) is in scope; generating or editing what a slot actually
contains is not.

## Verification

```bash
npm run precommit
npm run check
```

A sensor or script change also needs `npm run test:scripts` plus the negative case from § 4.
