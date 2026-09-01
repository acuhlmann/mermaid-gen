# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label
string from this table.

## What each label commits the repo to

A label is not a description of an issue, it is a promise about who reads it next. Two of the five
were rewritten on 2026-09-01 (ADR-0017) because their promises were not being kept.

- **`ready-for-agent` promises that some agent can write the file.** `resolve` gathers it, and skips
  it when the fix lands outside every playbook's `allowedPaths` — which happened to #461, #462 and
  #473, three correctly scoped issues stuck behind a `scripts/` path no routine could reach. Check
  with `npm run routine:guard -- --reachable <path>` before applying it; on `NONE`, file
  `needs-triage` and let `improve` § 2b widen the budget.
- **`ready-for-human` is the page bar, not the "hard" bin.** [`docs/routines/README.md`](../routines/README.md)
  rule 10 lists the four conditions that qualify (money, credentials or permissions, irreversible
  destruction, product direction). No routine on either shelf may apply the label: an issue parked
  there is a human's backlog, and the human does not read the tracker — #402 and #431 sat five and
  eight days on a `maxFiles` number and a lint warning respectively. `resolve` re-gathers any
  `ready-for-human` older than three days and re-triages it, on the assumption that a routine was
  over-cautious rather than that a person is busy.

Four of the five exist on the repo (`needs-triage`, `ready-for-agent`, `ready-for-human`, `wontfix`).
**`needs-info` does not** — create it before a routine applies it
(`gh label create needs-info --description 'Waiting on reporter for more information'`), because
`resolve` § 1 reaches for it on underspecified issues. These exact strings are what the routines'
gather steps and `routine-guard`'s ownership rules match on, so rename none of them.

## `log` — not a triage role

One label sits outside the five: **`log`** marks an append-only thread that is a record, never
work. Today the only one is [#452](https://github.com/acuhlmann/mermaid-gen/issues/452), where the
`digest` routine posts one comment a night.

It exists because of a specific trap. `resolve` gathers `ready-for-agent`, `needs-triage` **and
unlabelled** issues — the unlabelled case was added deliberately, since `improve`'s `gh issue
create` calls used to file without a label and nothing labels them afterwards. So an issue that
carries no triage label is, by that rule, work. A standing log thread carrying no label would be
picked up as a task every night, forever. `log` is what takes it out of the gather set without
implying anything about triage.

Every routine that reads the backlog must exclude it. If you add a second standing thread, label
it `log` too rather than inventing a name for it.
