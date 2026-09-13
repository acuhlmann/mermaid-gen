---
name: prune
todos:
  - id: batch-1-stale-doc
    content: 'DONE 2026-09-13, see Run log and Completed. `docs/recipes/add-legacy-stream-event.md` deleted in `prune: stale-doc — 1 file(s)`, held for owner merge.'
    status: completed
  - id: batch-2-dead-components
    content: 'Class `dead-file`, docs-free: `SlopitectStatusBoard.jsx` (54 lines, added 2026-05-16, 0 referrers), `AgentReactionBubble.jsx` (16, 2026-05-16, 0), `useRotatingPlaceholder.js` (37, 2026-07-12, 0), `exampleDiagram.js` (22, 2026-07-12, 0), `GraphEditUndoToast.jsx` (23, 2026-08-17 — **inside the 14-day age gate on 2026-09-07**, re-check before taking it), `AdvisorThinkingIndicator.jsx` (68, 2026-05-17 — reads `test-only` now because a comment in `scripts/prune-scan.test.mjs` names it; playbook § 1 self-reference rule, and the reason a test must not pin a dead file). Each verified by hand on 2026-09-07 in all four specifier forms. maxFiles is 5, so this batch splits: take the oldest four, park the rest. **Update 2026-09-13**: re-ran `npm run verify:boundaries` per § 1b — it now also flags `AgentReactionBubble.jsx`, `GraphEditUndoToast.jsx` and `exampleDiagram.js` as `no-orphans` (it did not on 2026-09-07), so those three are now in the **intersection** with `prune:scan` and are the highest-confidence next batch; `SlopitectStatusBoard.jsx` and `useRotatingPlaceholder.js` remain `prune:scan`-only (dep-cruiser does not scan `scripts/`, and these two are `apps/web` files it still does not flag) — hand-check those two per § 1b before including them. The GraphEditUndoToast.jsx 14-day gate has since cleared (added 2026-08-17, now 27 days old) but note: this run also hit the shallow-clone graft-boundary artifact (see Open observations below) on an unrelated file, so re-verify age with the ledger-recorded dates, not a fresh `git log` in a shallow checkout'
    status: pending
  - id: batch-3-thinking-family
    content: 'POSSIBLY DEAD, NOT PROVEN — `thinkingMarkdownTable.tsx`, `thinkingSyntaxCode.tsx`, `thinkingFencedBlock.ts` (468 lines together). The first is **live**: `InsightsPane.jsx:15` imports it extensionlessly, which is the false positive that reshaped the scanner. The other two came up unreferenced on 2026-09-07 and were NOT individually re-checked afterwards, because the scanner changed under them. Re-run § 1 and apply gate 2 by hand before touching any of the three; they read like one family that lost two of its members'
    status: pending
  - id: test-only-pairs
    content: 'ISSUES, NOT PRS — four modules named only by their own test: `AdvisorFloatPortal.jsx` (73, `test/useAdvisorFloatPortal.test.jsx`), `RenderAsMascot.jsx` (186, `renderAsMascot.test.jsx`), `FlowchartLabelField.jsx` (53, `flowchartLabelField.test.jsx`), `useAdvisorFloatMaxHeight.js` (54, `useAdvisorFloatMaxHeight.test.jsx`). `routine-guard` forbids deleting a test and rule 1 wants a written reason, so prune cannot ship these: the module and its suite have to be decided together. File one issue naming all four pairs, then let `resolve` carry it'
    status: pending
  - id: spike-scripts
    content: 'Class `dead-file` in `scripts/` — `elevenlabs-barker-spike.mjs` (210 lines, added 2026-08-01) and `richard-uncertainty.mjs` (77, 2026-08-01), both with zero referrers. Check first whether they are auditions somebody still wants to replay: `cast-audition.mjs`, `chirp3-audition.mjs` and `barker-fidelity.mjs` are named in `docs/audio-assets.md` or its neighbours and are NOT candidates, so the family is not uniformly dead and the age gate plus gate 3 apply. A one-off spike that produced a baked asset is debris; one that produced a decision is documentation'
    status: pending
  - id: unrouted-scripts-report
    content: 'REPORT ONLY, NEVER A DIFF (playbook § 1) — three root scripts nothing invokes: `verify:boundaries:graph`, `ar:cleanup:prune`, `secret:openrouter:cloud-run`. `package.json` belongs to `deps` and "no agent-authored resolved trees" keeps it off this shelf. Two of the three are almost certainly false alarms of a useful kind: `ar:cleanup:prune` and `secret:*` are invoked by hand by a person, which no grep sees. **So the signal in this class is not "delete it", it is "this command is undiscoverable"** — worth a docs line, not a deletion. `prune:scan` was the fourth until this change documented it in AGENTS/CLAUDE/sensors, which is the whole argument for reading that class as a discoverability report: the fix was a line of prose and the finding disappeared'
    status: pending
  - id: sensor-disagreement-entryrenderas
    content: 'ONLY DEPENDENCY-CRUISER SEES IT (playbook § 1b) — `apps/web/src/components/EntryRenderAs.jsx` is a `no-orphans` warning in `npm run verify:boundaries` but NOT a `prune:scan` candidate, because `docs/agent-blast-radius.md` and `scripts/test-affected-lib.mjs` both name it. Two readings and the run must pick one deliberately: either the blast-radius doc + the co-change mapper still describe a live pairing (then the module is wanted and dep-cruiser is right that something should wire it in), or they are pointing at a component nobody renders (then those two references are the **first** things to delete, and only after them does the module become a candidate). Do not open a PR that deletes the component and leaves both pointers dangling — that is a broken doc, not a cleanup'
    status: pending
  - id: decide-the-schedule
    content: "FOR THE OWNER, not a run: this playbook declares `schedule: none` on purpose. If the first two or three manual runs are worth reading, a cron costs one front-matter line plus a `claude -p '/schedule …'` call (creating a cron routine is not page-bar work; deleting one is). Cadence suggestion when the time comes: weekly, off the night ladder like `deps`, because a deletion batch landing behind three feature automations is the fleet fighting itself. Until then `digest` treats it as manual-only"
    status: pending
---

# Ledger: `prune`

Durable memory for the [`prune`](../prune.md) routine. **Read the Rejected section before choosing a
batch** — a path the owner already declined is not fresh work, and re-proposing it is how this shelf
gets muted.

**State at creation, 2026-09-07** (measured at `4ab1857d`, not assumed): no cron exists; the routine
has never run; `npm run prune:scan` reports 17 candidates over 1522 tracked files, of which 12 are
source modules the author of this ledger checked by hand and found genuinely unreferenced. `main` is
green. Nothing has been deleted.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-07 | **This routine never merges, and no future run may decide otherwise.** `mergePolicy: hold` is the point of it: a deletion is page-bar #3 (irreversible destruction) in `README.md` rule 10, so the owner is the gate for this one job and for nothing else on either shelf. Green CI is permission to push, not to merge. |
| 2026-09-07 | **The scanner is not prune's to edit.** `scripts/prune-scan.mjs` sits in `forbiddenPaths` while `scripts/**` sits in `allowedPaths` — the tool that decides what is dead cannot be maintained by the thing that wants it dead (`routine-guard.mjs` reasoning, #461, one level down).                                      |
| 2026-09-07 | **A closed PR is a decision.** Every path in it goes to Rejected verbatim, comment or no comment, and is never proposed again by any run. The close is the answer.                                                                                                                                                        |
| 2026-09-07 | **One class per run, one commit per file**, ≤ 5 files. The owner must be able to merge the half they agree with.                                                                                                                                                                                                          |
| 2026-09-07 | **`test-only` is an issue, never a PR.** The guard forbids deleting a test; a module and its suite are one decision and prune cannot make it.                                                                                                                                                                             |
| 2026-09-07 | **A file younger than 14 days is in-flight work.** Three feature automations ship code nightly; a same-week deletion is the fleet eating its own commits (#442/#446 in a new hat).                                                                                                                                        |

## Open observations

**2026-09-07 — the loading surfaces are the interesting part of the sensor, not the orphans.** A link
graph over this repository's own files cannot see a reference made by convention: `AGENTS.md` § Domain
gotchas, a glob-scoped `.cursor/rules/*.mdc`, a nested `CLAUDE.md`, `**/SKILL.md`, a bundler glob, a
`readdirSync`. Every one of those is "unreferenced" to a naive checker and every one is load-bearing.
`NEVER_CANDIDATE` in the scanner is that list, and it is the reason the root-context files the goal is
about are safe from the routine meant to shrink context.

**2026-09-07 — "nothing imports me" is not the same claim in `.jsx` and in `scripts/`.** The 15 root
`npm run` targets that no file invokes are mostly things a human runs by hand from a guide, so the
finding in that class is _undiscoverable_, not _dead_. A candidate class whose semantics are "the repo
cannot see you" needs a different action than deletion, and this routine should consider dropping it
rather than reporting it forever.

**2026-09-07 — the deletion cost of an agent context is measurable and nobody was measuring it.**
`ratchet.json` has a `contextBytes` family for `CLAUDE.md`/`AGENTS.md` because those are read in full
by every session; a stale `docs/` page is read by whichever session greps its area, which is nobody's
metric. If this routine earns a cron, the number worth reporting is bytes removed per run.

**2026-09-13 — the shallow-clone graft boundary is not hypothetical, it hit the very candidate this
run took.** `git log --follow -p -- docs/recipes/add-legacy-stream-event.md` in this run's checkout
showed the file as `new file mode` at commit `84d825a` (2026-09-06), which is one of the seven commits
listed in `.git/shallow` — i.e. a grafted root with no visible parent, not a real add date. Taken at
face value that reads as 7 days old, inside the 14-day gate, which would have parked a candidate the
previous run had already verified (by a fuller-history route) as added 2026-05-21. Playbook § 2 gate 4
already calls this out in prose; this is the first run where it actually fired. The tell matched the
playbook exactly: `addedAt: null` in the scanner's own notes for every candidate this run, plus a
commit whose message (a mermaid class-declaration fix) had nothing to do with the file in its diff.
Trusted the ledger's previously-recorded date instead of the local `git log` and proceeded. Anyone
re-deriving age in a shallow checkout should check `.git/shallow` for the path's apparent add-commit
before trusting `git log --follow`'s date on it.

## Rejected — never re-propose

Append the path, the date, and the owner's reason if they gave one. A path in this table is filtered
out of § 1's candidate list before a batch is chosen.

| Path | Date | Reason |
| ---- | ---- | ------ |

## Run log

Append one row per firing, including a run that found candidates and deliberately took none.

| Date       | Triggered by   | Class       | Files (−lines) | PR                                                        | Merged by | Notes                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------- | -------------- | ----------- | -------------- | --------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-13 | owner (manual) | `stale-doc` | 1 (−10)        | [#670](https://github.com/acuhlmann/mermaid-gen/pull/670) | —         | First-ever firing. Took ledger's own recommended "first slice": `docs/recipes/add-legacy-stream-event.md`, superseded by `add-agent-stream-event.md` (added 2026-09-07, not in the recipes index). Age gate hit the shallow-clone graft-boundary artifact (see Open observations); trusted the ledger's 2026-05-21 date over local `git log`. `npm run check:full` and `apps/web` tests green. `held PR #670 awaiting-review`. |
