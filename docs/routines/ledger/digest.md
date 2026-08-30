# Ledger: `digest`

**The run log for this routine is not in this file.** `digest` is `tier: report` and writes
nothing to the repository, so its per-run record is the comment thread on
[issue #452](https://github.com/acuhlmann/mermaid-gen/issues/452). This file holds only the Locked
decisions below, for a human or the `improve` routine to edit in an ordinary PR.

`docs/routines/README.md` rule 7 ("append a run-log row every time") is satisfied by the issue
thread, which is append-only, dated, and readable from a phone — the two properties a run log
needs. Duplicating it here would mean a branch, a CI run and a Cloud Run deploy every morning to
record that nothing happened.

## Locked

| Date       | Decision                                                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-30 | The digest **reports and never files**. It opens no issue, applies no label, closes nothing. A reporter that also files becomes a third filer competing with `review` and `improve`, and the backlog stops being a reliable statement of what is actually waiting.           |
| 2026-08-30 | It does **not** re-verify PR body claims. That is `review`'s Spec axis, it costs about an hour, and running it twice a night buys nothing.                                                                                                                                   |
| 2026-08-30 | Standing issue is **#452**. One issue, one thread, one URL — not a new issue per night, which would bury the four real issues in the backlog under a month of logs and make `gh issue list` useless to `resolve`.                                                            |
| 2026-08-30 | **Model is Sonnet 5, not Haiku 4.5.** Haiku was chosen because this is structured summarization; the first firing showed the job is not summarization but _evidence handling_ across ~10 sources, and a model that compacts mid-run fabricates the part it lost.             |
| 2026-08-30 | The watchdog's first item is **"a job that did not run"**. ADR-0014 named a stopped run log as the tell for the whole shelf failing, and then nothing was built to look — `anything` went dark on 2026-08-28 and it took a human reading a ledger four days later to notice. |

## Open observations

**2026-08-30 — the first live firing failed in four ways, and the failure was worth more than the
run.** Fired by hand as a smoke test before the routine's first scheduled run. It reported
`result: success` and posted nothing.

1. **It never posted.** It composed the digest and returned it as its final assistant message. The
   playbook's Post step said `gh issue comment`, and `gh` is unauthenticated in the cloud sandbox —
   so the step it was told to run could not have worked either way. Now: post through the GitHub
   MCP tool and read the comment count back to confirm.
2. **`gh` is unauthenticated in the sandbox at all.** The guard's own preflight printed
   `could not read open PRs (gh missing, unauthenticated or offline)` and skipped the
   one-branch-at-a-time check — the property that check exists to provide, absent on the only runs
   that matter. `fetchOpenPrs` now falls back to the GitHub REST API, which needs no credentials to
   list open PRs on a public repo. The wider lesson: **the `gh` snippets in every playbook on both
   shelves are aspirational**; the routines have always reached GitHub through MCP tools.
3. **It auto-compacted mid-run.** On Haiku, it `Read` all three routine ledgers whole — 200 KB, and
   `resolve.md` alone is 67 KB of prose rows. Compaction ate the gathered data. Now: `grep '^| 20'
| tail -2`, never a whole-file read.
4. **It then invented the missing half.** The digest it composed claimed `metaphor3d`, `anything`
   and `canvas-graph-edit` "fired and merged output" — none had ever run under the new ladder — and
   cited "#406 and #407 (dependabot)", which are not dependabot PRs. Model raised Haiku 4.5 →
   Sonnet 5, and § 1b now requires every line to trace to gathered output.

The general rule, worth more than any of the four: **a summarizer that loses its evidence does not
report that it lost it.** It reports fluently and wrongly, and marks itself `success`. Any routine
whose whole output is prose needs its inputs bounded and its claims tied to a command's output.
