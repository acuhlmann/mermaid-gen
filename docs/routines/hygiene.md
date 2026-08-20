---
name: hygiene
tier: mechanical
schedule: '0 4 * * *'
maxFiles: 12
allowedPaths:
  - docs/**
  - '*.md'
  - scripts/verify-*.mjs
  - scripts/verify-*.test.mjs
  - packages/eslint-config/**
forbiddenPaths:
  - apps/**
  - packages/shared/**
  - package.json
  - package-lock.json
---

# Routine: `hygiene`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Keeps the repo's own documentation honest and its agent-facing sensors sharp. `mechanical` tier: it
merges its own PR once CI is green.

Self-merging is safe here **because of the budget, not because of the tier**. `apps/**` and
`packages/shared/**` are forbidden paths, so a bad run cannot change product behaviour or reach the
Cloud Run deploy with anything but prose and sensor scripts. If a task tempts you outside those
paths, it is not a `hygiene` task — file an issue.

## Why this runs at all

The repo's registers are hand-maintained and drift silently. Measured at the time this routine was
written: every row of the `CLAUDE.md` file-size budget table was stale, several by hundreds of
lines. `GLOSSARY.md` is scanned by no check at all. Docs cite files that do not exist. None of that
fails a build, so nothing ever catches it — which is exactly the shape of work a schedule is for.

## Work queue

Take the **highest unfinished item that fits the budget**, do that one slice well, and stop. Push
the rest to the ledger. A run that does one thing correctly beats a run that half-does four.

### 1. Register accuracy

Three registers claim numbers that reality has moved past. Recompute and correct:

| Register                                                                                                             | What to check                                |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `CLAUDE.md` § File-size budgets                                                                                      | Every claimed LOC against `wc -l`            |
| [`docs/decisions/0005-monolith-splits.md`](../decisions/0005-monolith-splits.md)                                     | Progress lines against what actually shipped |
| [`docs/agents/balanced-coupling-priorities.md`](../agents/balanced-coupling-priorities.md) § Implementation progress | Status rows, and the **Last reviewed** date  |

Correcting a number is in budget. Deciding a file should be _split_ is not — that is `proposal`
work and the repo's own rule is to split on contact.

### 2. Scoreboard hygiene

[`packages/eslint-config/legacy-monoliths.js`](../../packages/eslint-config/legacy-monoliths.js) is
the visible ADR-0007 scoreboard. Its header carries the operative rule: when a file is split, remove
it; when a new file goes over threshold, **fix the file rather than adding it here**.

So when an unlisted file is over `max-lines` — `apps/web/src/utils/officeCast.js` and
`apps/web/src/state/officeMomentStore.js` both are today — the answer is an issue, never a new
suppression line. Adding one would be the routine quietly lowering the bar it exists to hold.

Conversely: a file whose LOC has fallen back under threshold should come **off** the list, which
re-engages the check for free.

### 3. Doc drift

Three classes, in order of how invisible they are:

- **Cited but absent.** `npm run verify:doc-paths` catches this for `apps/`, `packages/` and
  `scripts/` paths in six surfaces. Everything else is unchecked — dotfile paths, `.claude/`
  contents, symlinks. Fix what you find; prefer extending the sensor over fixing by hand twice.
- **Unverified entirely.** `GLOSSARY.md` is in no scanned list, and
  [`docs/agents/domain.md`](../agents/domain.md) tells every agent to prefer its terms — so glossary
  drift silently degrades every downstream issue title and test name. It also carries a hand-kept
  "shipped vs design-stage" split that only stays true if someone maintains it.
- **Duplicated by hand.** `README.md` and [`docs/guide/README.md`](../guide/README.md) carry
  near-identical operator tables with different relative paths. Keep them consistent, or collapse
  one into a pointer.

### 4. Sensor extension

The highest-value work in this routine: turn a class of drift you just fixed by hand into a check
that fixes it for free next time. One per run, with tests.

Known open gaps, in rough value order:

- **`ISOMETRIC_FLOOR_BLAST_TESTS` runs behind the directory.** `scripts/test-affected-lib.mjs`
  lists fewer floor tests than `apps/web/test/` contains, so `test:affected` under-selects. The
  existing sensor catches _dangling_ references, not _missing_ ones — the fix is the inverse check:
  every `apps/web/test/officeFloor*` file must appear in the list.
- **`SERVER_STRICT_ISLAND_FILES` duplicates a tsconfig.**
  [`packages/eslint-config/typeCheckedIsland.js`](../../packages/eslint-config/typeCheckedIsland.js)
  hardcodes the same paths as `apps/server/tsconfig.strict.json` with only a "keep in sync" comment
  between them. No test asserts they match.
- **`formatter.cjs` duplicates `guidance.js`.** ADR-0007 accepted this duplication knowingly
  (formatters load via `require()`), but accepted-and-unchecked is still unchecked. Assert the two
  maps agree.

### 5. Mirror parity

Durable operational tips must exist in **both** `AGENTS.md` and `CLAUDE.md`. When a run learns
something worth keeping, write it in both — and when it finds a tip that reached only one, mirror
it. Neither file is the canonical one; that is the point.

## Verification

Docs-only diffs still run the full gate, because `verify:doc-paths` and `verify:agent-infra` are
the checks most likely to fail on exactly this kind of change:

```bash
npm run precommit
npm run check
```

A sensor change also needs `npm run test:scripts`, and — because a new check can be green for the
wrong reason — a **deliberate negative case**: break the thing on purpose, confirm the sensor
fails, then put it back. A sensor never observed failing has not been tested.
