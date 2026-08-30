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
| 2026-08-30 | The watchdog's first item is **"a job that did not run"**. ADR-0014 named a stopped run log as the tell for the whole shelf failing, and then nothing was built to look — `anything` went dark on 2026-08-28 and it took a human reading a ledger four days later to notice. |

## Open observations

_(none yet)_
