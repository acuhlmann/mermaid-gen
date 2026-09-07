---
name: prune
tier: code-writing
schedule: none
host: Claude
mergePolicy: hold
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
This routine asks one question of one file at a time — **is this still wanted?** — and the answer is
not its to give.

**It is the only routine on either shelf that never merges its own PR.** That is not caution about
deletion, it is the shelf's own rule: `README.md` rule 10 page-bar #3 is _irreversible destruction_,
and "delete this document" is a decision about what the project wants to remember, which is the
owner's call. Every other routine decides and lands; this one proposes and stops. The goal is a
smaller repository and a **shorter context for every agent that opens it** — a stale file is not
free, it is read by each new session that greps the area it describes.

## 0. Not scheduled. The owner starts this run by hand.

`schedule: none` is the whole story: **there is no cron for this routine**, and it must not acquire
one by itself. Standing up a rung spends the owner's subscription (rule 1) and creating a trigger is
page-bar #2 — so a run that concludes "I should really do this weekly" writes that sentence into its
ledger and ends.

To run it, open a session in this repository and paste:

```
Run the NFR routine `prune`.
Read docs/routines/README.md (the contract), then docs/routines/<name>.md (the playbook),
and follow them exactly. Those two files are authoritative; this message adds nothing to them.
```

Substitute `prune` for `<name>`. Preflight with `npm run routine:guard -- --preflight prune`; when
it refuses because a `prune:` PR is already open, **that is the intended brake** — the previous
batch is still waiting on the owner. Record `held PR #nnn awaiting-review` in the ledger and stop. Do
not open a second branch under another name, do not close the open PR to make room, and do not merge
it yourself to clear the way (§ 5).

`digest` treats this playbook as manual-only and will not report it as a job that failed to run
([`digest.md`](digest.md) § Watchdog 1).

`host: Claude` in the front-matter is **provisional** — it names where this would run if the owner
ever schedules it, not where it runs now. Nothing reads the key while `schedule:` is `none`, so it is
a placeholder for a decision that is the owner's (README § Adding a routine, step 3: split on duty,
and `resolve` already holds the Cursor slot).

## 1. Where candidates come from

```bash
npm run prune:scan          # grouped, human-readable, with a proof command per hit
npm run prune:scan -- --json
```

[`scripts/prune-scan.mjs`](../../scripts/prune-scan.mjs) answers "which tracked file does nothing
else in this repository refer to?" across three classes:

| Class    | It reports                                                                                                                            | Whether `prune` may open a PR for it                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `doc`    | a document unreachable from `README.md`/`AGENTS.md`/`CLAUDE.md`/`STRUCTURE.md`, a nested `CLAUDE.md`, or a loaded `.cursor` rule      | yes                                                                                   |
| `source` | a module no import, config entry, glob, or directory scan reaches (`unreferenced`), or one that only its own test names (`test-only`) | `unreferenced` yes, `test-only` **no** — file an issue                                |
| `script` | a root `npm run` target no doc, playbook, workflow, or other script invokes                                                           | **never** — `package.json` is `deps`' file; report it in the PR body, do not write it |

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
to the ledger as `todos` for a later run with a hand-check.** A candidate both sensors agree on is a
deletion the owner can approve from two independent pieces of evidence; a candidate only one sensor
sees is exactly where a tool's blind spot lives, and this routine's whole risk model is that it does
not get to be the only thing that looked. If a future run finds itself wanting to _weaken_ either
sensor to make the lists agree, it has found a bug to report, not a queue to clear.

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
5. **It is not merely a file with a test.** `routine-guard` refuses any test-file deletion, and it is
   right: a file whose own suite still passes is _covered_, which is a different claim from _wanted_.
   So a candidate that has a test file, or is named by exactly one, is **an issue, not a PR** — say
   in the body that its tests need a decision too, and let `resolve` or a human carry the pair.
   Filing obeys rule 12 like anything else: `maxIssues: 1` per rolling 24 h, **`filed-by: prune` as the
   first line of the body** (without it the filing has no author and the cap is unenforceable), and
   **all the pairs in one issue** — five open tickets for one recurring class is the failure that rule
   was written against, and a deletion candidate repeats nightly if nothing batches it. Pay-before-file
   can block this rung outright: when prune already carries too many of its own open findings, it
   closes one before opening another, and the held `prune:` PR is never the thing it pays with.

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

## 5. `mergePolicy: hold` — the PR is the deliverable

Push, open the PR, **stop**. Do not merge on green CI. Do not merge because the owner is asleep. Do
not merge a batch the owner approved piecemeal in a comment without re-asking. `routine-guard
--postflight prune` prints the policy back at you at the moment you are about to push; read that line.

- File **one** PR per run, titled `prune: <class> — <n> file(s)`.
- Leave the triggering issue's labels alone. `ready-for-human` is page-bar-only and you may not apply
  it to your own finding (rule 10). The held PR _is_ the escalation; a label on top of it adds nothing.
- Record `held PR #nnn awaiting-review` as a ledger row. `digest` watchdog 2 reports its age, and
  unlike a `resolve` hold — which holds because it is unsure — this hold is **not** an admission of
  uncertainty. It is the design. Do not "unblock" it.
- **When the owner merges**: append the row to `completed`, name the bytes or lines gone, and note any
  follow-up the deletion exposed (a guide section that now describes a file that isn't there is
  `improve`'s or `resolve`'s work, not a hot-fix in a merged deletion PR).
- **When the owner closes it**: that close is the decision, with or without a comment. Move every path
  in it to the ledger's **Rejected** section, verbatim, in the same run that notices. **A rejected
  path is never proposed again** — not by this run, not by a future one, not "because the evidence
  changed". Re-nagging an owner about something they already declined is how a shelf gets muted, and
  § 1's candidate list must be filtered against `Rejected` before a batch is chosen.

## 6. One run, one class

Take the highest-value class that fits `maxFiles: 5` and leave the rest in the ledger's `todos`.
Docs and code in one PR means the owner cannot merge the half they agree with, and a mixed batch is a
single review decision where two independent ones would have done. Ordered by how cheap they are to
judge:

1. `stale-doc` — prose describing a design the code no longer has.
2. `dead-file` — a module nothing imports and nothing loads.
3. `unrouted-script` — report only (§ 1), never a diff.

There is no asset class on purpose: `apps/web/src/assets/**` is both don't-touch and excluded by the
scanner, because a baked `.mp3` is regenerated with credits, not deleted after a grep.

## 7. The PR body is the whole product

The owner reads this on a phone and decides in ninety seconds. This example is a file **both** sensors
name (§ 1b) — that is the bar for a first proposal, not a nicety. Copy the shape:

```markdown
## What this deletes

`apps/web/src/components/AgentReactionBubble.jsx` — 16 lines, added 2026-05-16.

## Why it is dead

- `npm run prune:scan`: `unreferenced`, zero inbound from any file.
- `npm run verify:boundaries`: `warn no-orphans` on the same path — a second, independent sensor.
- `git grep -n AgentReactionBubble` → nothing outside the file itself, in any specifier form.
- Not an entry point; no glob, config, workflow, or rule loads it; no test names it.
- `npm run check:full` green with it gone.

## What it was for

Added in <sha> for the advisor float, which the office floor replaced in July.

## If I am wrong

`git revert <sha>` restores it; nothing else in the PR depends on it.
```

One such block per file, one commit per file, in that order — so dropping the third candidate is
dropping the third commit rather than unwinding a PR.

## Verification

```bash
npm run routine:guard -- --preflight prune      # BEFORE starting (refuses behind a held PR)
npm run prune:scan                              # the candidate list
npm run check:full                              # AFTER deleting, BEFORE pushing
npm run routine:guard -- --postflight prune     # budget + the hold reminder
npm run test -w apps/web                        # when the class is web source
```

`--postflight` passing is **not** permission to merge. For this routine it is permission to push.
