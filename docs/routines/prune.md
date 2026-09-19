---
name: prune
tier: code-writing
schedule: '30 15 * * *'
host: Claude
maxFiles: 5
maxIssues: 1
prTitlePrefix:
  - 'prune:'
branchPrefix:
  - prune/
allowedPaths:
  - docs/routines/ledger/prune.md
  - docs/**
  - '*.md'
  - apps/**
  - packages/**
  - scripts/**
forbiddenPaths:
  - docs/routines/*.md
  - docs/automations/**
  - docs/decisions/**
  - docs/agents/domains/**
  - apps/server/src/mcp/apps/**
  - apps/server/bench-results/**
  - apps/web/src/assets/**
  - apps/web/src/i18n/locales/**
  - scripts/prune-scan.mjs
  - scripts/prune-scan.test.mjs
---

# Routine: `prune`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Deletes whole files the repository no longer needs, and **nothing else**. Not lines, not refactors,
not renames: `improve` removes dead code _inside_ live files and owns every budget on this shelf.
This routine asks one question of one file at a time — **is this still wanted?** — and since
2026-09-14 it is allowed to answer it, under § 5's five controls.

**It merges its own deletion PRs as of 2026-09-14, and it is the only routine on either shelf whose
whole output is a deletion.** Until that day it was the shelf's one structural exception —
`mergePolicy: hold`, every run, on the reasoning that a deletion is `README.md` rule 10 page-bar #3
(_irreversible destruction_) and therefore the owner's call while nothing else on the fleet is. The
owner lifted it on 2026-09-14: _"remove the prune mergePolicy and merge urself, u can do it, just be
careful."_ So the human checkpoint is gone, § 5 is the set of controls that stands in its place, and
"just be careful" is a requirement with a section number rather than a tone of voice.

What the hold bought — a smaller repository and a **shorter context for every agent that opens it** —
is unchanged; a stale file is not free, it is read by each new session that greps the area it
describes. What changed is who pays for a mistake: an unwanted deletion now lands before anyone reads
it, which is survivable only because `git revert <sha>` puts it back. § 5 exists to keep that sentence
true.

## 0. Scheduled at 23:30 HKT — second on the ladder

`schedule: 30 15 * * *` UTC (**23:30 HKT**), `host: Claude`. This rung opened manual-only on 2026-09-07
and acquired a live `0 0 * * *` cron that no document admitted to having; `digest` watchdog 4 caught the
disagreement on 2026-09-13 and the owner settled it on 2026-09-14 in favour of the cron, because two
hand-triggered batches (#670, #681) had each been merged inside an hour of filing. That is the evidence
a rung needs before it gets a schedule (`README.md` § Adding a routine, step 5) and `prune` now has it.
The full ladder and the reasoning for each slot are in [`review.md`](review.md) § the night ladder.

**Second, immediately behind `metaphor3d` and ahead of every other producer.** That placement now earns
its keep harder than it did when this rung could only propose:

- **23:30 HKT is the quietest `main` a deletion can be computed against** — the owner's daytime merges
  have all landed, and `metaphor3d` (`0 15`), the only thing running alongside, has not merged yet, so
  the scan and the branch both sit on a tree no live producer has touched. Note what that does _not_
  buy: `metaphor3d`'s scene and layout paths are **not** in this routine's `forbiddenPaths`, so overlap
  is possible in principle. What actually separates them is § 2 — a file `metaphor3d` is working on is
  either referenced (so never a candidate) or under the 14-day age gate, and § 5.1 requires both sensors
  to agree before anything is deleted. A residual collision surfaces as a merge conflict on the
  producer's PR, which is loud, not as a silent removal. Nothing else merge-capable starts for another
  two and a half hours.
- **A wrong deletion meets the other producers' builds before it meets the owner.** `office-life`
  (`0 18`) and `anything` (`30 19`) both branch after this run merges and each runs `npm run check`
  against the tree it inherited, so a deletion that breaks something only a bundle or a web suite can
  see fails as somebody else's red preflight rather than as the owner finding a hole in `main` at
  09:00. (`canvas-graph-edit` would be a third tripwire; it is parked — see
  [`canvas-graph-edit.md`](../automations/canvas-graph-edit.md) § the pause note.) This is the reason
  the slot moved from the tail of the ladder to the head when the hold came off: at `0 0 * * *` this
  rung merged into a `main` that nothing else would test until the next afternoon.
- **Before `digest`,** so the morning report names what went and what it freed, instead of the owner
  finding an unannounced deletion in `git log`.

**Prompts do not carry policy; this file does.** On the 2026-09-14 firing the trigger prompt said
_"merge into main urself"_ and the run correctly refused, filed #681, and let the owner merge it —
because `mergePolicy: hold` was written in this playbook and a prompt in a cron blob is invisible to
review, cannot be diffed, and cannot reverse a key the guard reads. The policy changed the other way
the next day, and it changed **here**, on the owner's explicit instruction in a session that could edit
the file. Same rule both times, which is the point: the three-line loader prompt "adds nothing" to these
two files (see `README.md` § the contract), so neither a stray instruction nor a well-meaning run can
widen a budget or lift a gate. To make this rung stop merging, add `mergePolicy: hold` back to the
front-matter above — `routine-guard` validates the key and `--postflight` prints it back before the
push.

**Running it by hand is still supported.** Open a session in this repository and paste:

```
Run the NFR routine `prune`.
Read docs/routines/README.md (the contract), then docs/routines/prune.md (the playbook),
and follow them exactly. Those two files are authoritative; this message adds nothing to them.
```

Preflight with `npm run routine:guard -- --preflight prune`. When it refuses because a `prune:` PR is
already open, **that is still the intended brake** — one batch in flight per rung, so a routine cannot
queue deletions faster than `main` can absorb them. Record `PR #nnn open, awaiting CI` in the ledger and
stop; do not open a second branch under another name and do not close the open PR to make room. Since
§ 5 the PR normally merges inside the same run, so preflight refusing means something did not finish:
CI is red, the run stopped mid-batch, or a hold-by-judgement is sitting there — and a red
`check:full` on a deletion is a **finding that the candidate was live**, not an obstacle to route
around.

`digest` now treats this as an ordinary ladder rung: **an empty ledger row for last night is a real
finding** (`digest.md` § Watchdog 1), which it was not while `schedule:` read `none`.

## 1. Where candidates come from

```bash
npm run prune:scan          # grouped, human-readable, with a proof command per hit
npm run prune:scan -- --json
```

[`scripts/prune-scan.mjs`](../../scripts/prune-scan.mjs) answers "which tracked file does nothing
else in this repository refer to?" across three classes:

| Class    | It reports                                                                                                                            | Whether `prune` may open a PR for it                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `doc`    | a document unreachable from `README.md`/`AGENTS.md`/`CLAUDE.md`/`STRUCTURE.md`, a nested `CLAUDE.md`, or a loaded `.cursor` rule      | yes                                                                                            |
| `source` | a module no import, config entry, glob, or directory scan reaches (`unreferenced`), or one that only its own test names (`test-only`) | `unreferenced` yes; `test-only` **only as a dead pair** — § 2 gate 5 — otherwise file an issue |
| `script` | a root `npm run` target no doc, playbook, workflow, or other script invokes                                                           | **never** — `package.json` is `deps`' file; report it in the PR body, do not write it          |

**It is a report, not a gate.** It is absent from `npm run check` on purpose and exits 0 whatever it
finds. A reachability number that reddens a build teaches whoever is red to silence the sensor rather
than read it — the same reasoning as `verify:ratchet`. A repository with zero unreachable documents is
not a clean repository, it is a scanner with a blind spot.

**The scanner is not this routine's to edit.** `scripts/prune-scan.mjs` is in `forbiddenPaths`
even though `scripts/**` is in `allowedPaths`: the tool that decides what is dead cannot be
maintained by the thing that wants it dead. That is the `routine-guard.mjs` rule applied one level
down (#461). If it mis-resolves a specifier, fix it in a normal PR or hand `improve` a
`blocked-by-paths` row — never widen it from a prune branch.

**Write findings into your own ledger freely — and into nothing else.** A file named in any document
is, correctly, referenced by it, so it stops being a candidate. This playbook and
`docs/routines/ledger/prune.md` are the only two files exempt from that rule
(`NON_REFERENCING_FILES` in the scanner), because a cleanup tool whose memory names its targets would
otherwise sterilise its own queue the first time it wrote anything down — measured, on the day this
shipped: adding the candidate list here dropped the report from 17 findings to 3. Two consequences:

- **Never park a candidate by mentioning it in a guide or a code comment.** That makes it invisible to
  every future scan. The ledger is the only place a parked finding stays findable.
- The exemption cuts the other way for `Rejected`: writing a declined path into the ledger does **not**
  hide it from the scanner, so § 5's "never re-propose" holds only if the table is actually read before
  a batch is chosen. Read it every run.
- And a test that names a dead file to prove the scanner finds it **becomes the thing keeping it
  alive** — which is how `AdvisorThinkingIndicator.jsx` briefly read as `test-only`, and why
  `prune-scan.test.mjs` asserts only what the scanner must _not_ report, plus a `git grep`
  cross-check of whatever it does.

Measured on 2026-09-07 at `4ab1857d`: 16 candidates over 1525 tracked files — one orphan doc, 12
source modules (7 with zero referrers, 5 named only by a test), 3 unrouted scripts. All 12 source
hits were confirmed dead by hand, in all four specifier forms. It runs in ~2.5 s.

## 1b. Two sensors, two blind spots — run both

`npm run verify:boundaries` already reports orphaned modules through dependency-cruiser's
`no-orphans` rule, so the tree has a **second, independent** reachability check that this routine did
not write and does not maintain. On 2026-09-07 the two disagreed in both directions: dep-cruiser named
4 modules, `prune:scan` named 12, and the sets overlapped on only 3.

- `apps/web/src/components/EntryRenderAs.jsx` — dep-cruiser's, not `prune:scan`'s. It is named by
  `docs/agent-blast-radius.md` and by `scripts/test-affected-lib.mjs`, which is a real reference to
  this routine (a document still describes the module) and a blind spot for an import graph.
- `apps/web/src/components/SlopitectStatusBoard.jsx` — `prune:scan`'s, not dep-cruiser's. Nothing
  names it in any form; a graph that only carries edges cannot see a node it never reached.

**So: put both lists in front of you, propose only the intersection, and send the symmetric difference
to the ledger as `todos` for a later run with a hand-check.** Since § 5 landed this is a **merge** bar,
not a proposal bar: nothing outside the intersection gets deleted at all. A candidate both sensors agree
on is a deletion backed by two independent pieces of evidence that neither routine wrote; a candidate
only one sensor sees is exactly where that tool's blind spot lives, and this routine's risk model is
that it does not get to be the only thing that looked — least of all now that it also lands the result.
**The dead-pair class (§ 2 gate 5) is deliberately absent from the intersection, and cannot be in it:**
the test's import edge is exactly the edge that makes dependency-cruiser count the module reachable, so
demanding the orphan list's agreement would demand that a sensor be blind to the class. For pairs the
second sensor is instead the guard's own `collectDeadPairings` proof — import closure and stem-references
computed at the base revision by a script this rung cannot edit (`scripts/routine-guard.mjs` is in
`forbiddenPaths` and always-forbidden). Independence is the property § 5.1 actually buys, and it is
preserved because the second checker is not the thing that wants the file gone.
If a future run finds itself wanting to _weaken_ either sensor to make the lists agree, it has found a
bug to report, not a queue to clear.

## 2. The proof ladder — five gates, or the candidate is not a candidate

A scanner hit is the _cheapest_ possible signal: it means "nothing refers to this by name". Name is
not the only way to reach a file, and every gate below exists because a false positive here costs the
owner a review of a deletion that would have broken the app.

1. **Reproduce the hit** with the `proof:` line the scanner prints. If it does not reproduce, stop.
2. **Search the specifier forms the scanner cannot see.** Grep the **stem**, not just the filename:
   `git grep -n 'thinkingMarkdownTable'`. On its first run this scanner offered
   `apps/web/src/utils/thinkingMarkdownTable.tsx` for deletion while `InsightsPane.jsx:15` imports it
   as `'../utils/thinkingMarkdownTable'` — no extension. That is the exact class of mistake a
   deletion tool gets away with until the app fails to build.
3. **Rule out loading by convention** — anything reached without being named. A file is alive if any
   of these apply: it is an entry point (`main.jsx`, `index.html`, `src/index.js`, a
   `package.json` `main`/`exports` target); a bundler glob or `readdirSync` covers it; a
   `.cursor/rules/*.mdc` glob, a nested `CLAUDE.md`, a `.claude/skills/**`, or `AGENTS.md` §
   Domain gotchas points at it; a `.github/workflows/*.yml` runs it; a test runner's mirror
   convention finds it; or its basename appears inside `apps/server/src/mcp/apps/*.html` strings.
4. **Age.** `git log --diff-filter=A --format=%cs --follow -- <path>` (the scanner prints it as
   `added`). Under **14 days** is not debris, it is in-flight work: three feature automations ship
   product code nightly, and a same-week deletion is the fleet eating its own commits — the
   `renameErNode` duplicate-PR failure (#442/#446) in a new hat. Park it in the ledger instead.
   When the scanner reports `addedAt: null` because git history is truncated (a shallow clone — the
   normal cloud-agent checkout), that is **unknown age, not young age**: the graft boundary would
   stamp every file at ~0–2 days forever, so gate 4 does not apply here. Fall through to gates 1–3
   and 5; do not park a candidate solely because `added` is missing.
5. **A module whose only consumer is its own suite is a dead pair, and the pair is deletable.**
   A file whose own suite still passes is _covered_, which is a different claim from _wanted_ — but
   when the shipped tree reaches neither the module nor anything but its test, "is this component
   still wanted?" already has its empirical answer: nothing wants it, and a wire-up nobody has
   done in fourteen-plus days is a feature proposal, not this gate's debris. Since 2026-09-19
   `routine-guard` admits a test-file deletion **only** as the second half of exactly this shape,
   mechanically and only for this rung: the test's relative imports resolve to non-test files
   deleted **in the same diff**, and at the base revision no file outside the diff's deleted set
   so much as names those files' stems — save § 1's two non-referencing files, this playbook and
   your ledger, where a name is the record of a candidate and never a consumer of one (without
   that carve-out the live proof failed on all four #686 pairs for nothing but the ledger doing
   what § 1 makes it do). Postflight refuses every other test deletion, so no run
   reasons from "my tests are green" to "these tests were debris". If a future surface turns out
   to want the component, it is one `git revert` away and § 5.4's ledger row carries the command —
   which is the whole answer to why this class moved off the owner's desk into this section.
   **A proof that fails just routes:** if the test also imports a live module, or the stem appears
   in a document or another suite, the candidate is **an issue, not a PR** — say in the body that
   its tests need a decision too, and let `resolve` or `improve` carry the pair.
   Filing obeys rule 12 like anything else: `maxIssues: 1` per rolling 24 h, **`filed-by: prune` as the
   first line of the body** (without it the filing has no author and the cap is unenforceable), and
   **all the pairs in one issue** — five open tickets for one recurring class is the failure that rule
   was written against, and a deletion candidate repeats nightly if nothing batches it. Pay-before-file
   can block this rung outright: when prune already carries too many of its own open findings, it
   closes one before opening another, and a `prune:` PR already in flight is never the thing it pays
   with.

Then the run's own gate, which is the same as everyone else's and harder here:

6. **Delete it, then `npm run check:full`** — the build, not just the tests. Typecheck and lint prove
   the tree is internally consistent; only the bundle proves nothing loaded the file at runtime.
   Red after the deletion means the candidate was live: abandon it, record it in `Rejected` with what
   broke, and do not re-derive it next run.

## 3. A deletion may carry the reference-removal it forces, and nothing else

Removing a dead module that a barrel re-exports means deleting that one re-export line. That is in
scope. Rewriting the barrel, tidying its imports, or fixing a lint warning that surfaced while you
were there is not — it belongs to `improve`, and mixing it in turns a decidable deletion PR into a
review of unrelated code. **Every file in the diff either disappears or loses a pointer to something
that disappears.** Both count against `maxFiles`.

## 4. Never a prune target

Beyond `README.md` rule 6 and the paths in the front-matter:

- **ADRs** (`docs/decisions/**`). They are the record of why, and a superseded ADR is superseded _by
  another ADR_. Append-only history is never debris.
- **Domain findings** (`docs/agents/domains/**`). These were scoped out of the root files on
  2026-08-30 to make them cheaper, not obsolete. Deleting a finding loses the incident it encodes.
- **Ledgers and playbooks on either shelf.** A routine that no longer exists takes its ledger with it
  through `improve`, which owns the shelf.
- **Anything a locale cannot afford to lose** (`apps/web/src/i18n/locales/**`): an absent key is a
  feature that silently does not exist in that language, and `AGENTS.md` documents that arrays replace
  wholesale rather than merge.
- **A file whose value is that it is read by nobody but you.** `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`,
  `STRUCTURE.md`, `.cursor/rules/*`, `**/SKILL.md`, `**/CLAUDE.md` are loaded by convention, so
  "orphan" is their normal state, not a finding. The scanner excludes them; do not second-guess it
  from the branch.
- **Anything whose absence you cannot point at in the PR body.** If you cannot name what stops
  existing without it, it is not dead, it is undocumented.

## 5. Self-merging a deletion — five controls that replace the person

Push, open the PR, wait for CI, merge. That is now the default here as it is everywhere else on the
shelf. The difference is that a wrong merge from `review` is a bad line of code and a wrong merge from
this routine is a file nobody can point at any more, so the five controls below are the substitute for
the owner's ninety seconds — **all five, every run, and a run that cannot satisfy one of them does not
merge.** `routine-guard --postflight prune` prints the policy back at the moment you push; read that
line.

1. **Both sensors, or no PR.** § 1b's intersection used to be the bar for a _proposal_, with the
   symmetric difference parked as a todo for a run that could hand-check it. Now that nobody reviews
   the proposal, it is the bar for the merge: if only `prune:scan` or only `verify:boundaries` names the
   file, it is not deleted. That rule is what replaces a second pair of eyes, and it is the only one of
   the five the run cannot reason its way around. **For a dead pair the second sensor is the guard's
   `collectDeadPairings` proof instead of the orphan-list intersection — and for the same reason,** an
   independent checker this rung cannot edit (§ 1b).
2. **One file, one commit, in PR-body order.** Not a style preference — it is what makes
   `git revert <sha>` a complete undo for one deletion instead of a partial unwind of a batch. Five
   files in one commit means disagreeing with three of them requires surgery on `main`. A dead pair
   is **one** commit: a module deleted without its test leaves a suite importing a dead path, and a
   test deleted without its module leaves the very debris this rung exists to remove.
3. **`npm run check:full` green with the file gone, before pushing** (§ 2 gate 6). Red after a deletion
   means the candidate was live. Abandon it, record it in `Rejected` with what broke, and treat that as
   the good outcome: the build caught what no reader would have.
4. **The ledger row carries the merge SHA and the literal undo command for every path** — `git revert
<sha>` next to each file it removed, not next to the PR. Owner-facing archaeology is how a revert
   gets skipped and the deletion quietly becomes permanent.
5. **A revert is a decision, exactly as a close used to be.** If the owner reverts any commit from a
   `prune:` PR — or `review` reverts it, or a red `main` traces back to it — every path in that revert
   goes to the ledger's **Rejected** section verbatim, in the run that notices, and is never proposed
   again by any future run. § 1's candidate list is filtered against `Rejected` before a batch is
   chosen. Re-nagging the shelf about something it already removed once is how this rung loses its new
   licence.

- File **one** PR per run, titled `prune: <class> — <n> file(s)`; one class only (§ 6).
- Leave the triggering issue's labels alone. `ready-for-human` is page-bar-only and you may not apply
  it to your own finding (rule 10).
- **Hold by judgement is still available and still narrow.** `mergePolicy` is gone from the
  front-matter, but ADR-0015's per-run judgement hold is not: a deletion that touches a
  trust-boundary path, sits adjacent to the don't-touch list, or whose § 2 proof ladder needed a call
  the run cannot make from evidence alone — push the PR, do not merge, and say in the body what you are
  unsure of. That is a run being honest about one file, not a gate on every file.
- Note any follow-up the deletion exposed in the ledger row: a guide section that now describes a file
  that isn't there is `improve`'s or `resolve`'s work, not a hot-fix appended to a merged deletion.

## 6. One run, one class

Take the highest-value class that fits `maxFiles: 5` and leave the rest in the ledger's `todos`.
Docs and code in one PR means the owner cannot merge the half they agree with, and a mixed batch is a
single review decision where two independent ones would have done. Ordered by how cheap they are to
judge:

1. `stale-doc` — prose describing a design the code no longer has.
2. `dead-file` — a module nothing imports and nothing loads.
3. `dead-pair` — a module nothing but its own suite imports, deleted with that suite as one unit
   (§ 2 gate 5). Both files count against `maxFiles`, so two pairs plus the ledger row fill a run.
4. `unrouted-script` — report only (§ 1), never a diff.

There is no asset class on purpose: `apps/web/src/assets/**` is both don't-touch and excluded by the
scanner, because a baked `.mp3` is regenerated with credits, not deleted after a grep.

## 7. The PR body is the audit trail

It used to be the product — the thing the owner read on a phone for ninety seconds and answered with a
merge button. Since § 5 the merge happens without them, so the body's job changed: it is now the
**record a person reconstructs from afterwards**, and `digest` quotes it the following morning. The bar
went up, not down. This example is a file **both** sensors name (§ 1b) — that is the merge bar, not a
nicety. Copy the shape:

```markdown
## What this deletes

`apps/web/src/hooks/useRotatingPlaceholder.js` — 37 lines, added 2026-07-12.
Revert this commit alone: `git revert <sha>`.

## Why it is dead

- `npm run prune:scan`: `unreferenced`, zero inbound from any file.
- `npm run verify:boundaries`: `warn no-orphans` on the same path — **both sensors agree** (§ 1b).
- `git grep -n useRotatingPlaceholder` → nothing outside the file itself, in any specifier form.
- Not an entry point; no glob, config, workflow, or rule loads it; no test names it.
- Age: added 2026-07-12, well past the 14-day in-flight gate.
- `npm run check:full` green with it gone.

## What it was for

Added in <sha> for the advisor float, which the office floor replaced in July.

## If this is wrong

`git revert <sha>` restores it; nothing else in the PR depends on it, and every file here has its own
commit for exactly that reason. Reverting it is also a decision: the path goes to the ledger's
`Rejected` table and is never proposed again (§ 5.5).
```

One such block per file, **one commit per file** — for a dead pair, one block and one commit
spanning both files (§ 5.2) — in that order, so a single unwanted deletion is `git revert` on one
SHA rather than surgery on a batch. Merge only after CI is green, and append
the row to the ledger's `completed` with the merge SHA and the undo command beside each path (§ 5.4).

## Verification

```bash
npm run routine:guard -- --preflight prune      # BEFORE starting (refuses behind an open PR)
npm run prune:scan                              # the candidate list
npm run verify:boundaries                       # the SECOND sensor; intersect with the above (§ 1b)
npm run check:full                              # AFTER deleting, BEFORE pushing
npm run routine:guard -- --postflight prune     # budget + the merge-policy line
npm run test -w apps/web                        # when the class is web source
```

`--postflight` passing **is** permission to merge, provided all five § 5 controls hold — the two-sensor
intersection first among them, since it is the one control nothing downstream catches. It is not
permission to merge a file only one sensor named, and not permission to skip `check:full` because the
tests were green: typecheck and lint prove the tree is internally consistent, only the build proves
nothing loaded the file at runtime.
