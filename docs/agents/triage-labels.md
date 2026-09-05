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
- **`ready-for-agent` also promises an agent is _scheduled_ to take it.** Reachability is only half of
  rule 11's promise: a product slice whose fix is a new mutator, a hit-test, or an affordance is
  writable by an agent and will still never be picked, because `resolve` § 2 refuses design questions
  on sight and no feature automation works another automation's queue. That shape is `enhancement`
  (see below), not `ready-for-agent`. #495, #523 and #536 were gathered, examined and refused every
  night they were open.
- **A routine's filing carries its name.** Every issue body opened by a routine or automation starts
  with the line `filed-by: <name>` — `ready-for-agent` and friends say who may act, this says who
  acted. Routines post on the owner's credentials (`docs/routines/README.md` rule 9), so without the
  line a filing has no author and `npm run routine:guard -- --filings` cannot price a rung's own
  inflow, which is what `README.md` rule 12 holds it to. Issues filed before 2026-09-05 carry no
  trailer and are counted `unattributed`: they charge nobody and age nobody's debt.
- **`ready-for-human` is the page bar, not the "hard" bin.** [`docs/routines/README.md`](../routines/README.md)
  rule 10 lists the four conditions that qualify (money, credentials or permissions, irreversible
  destruction, product direction). No routine on either shelf may apply the label: an issue parked
  there is a human's backlog, and the human does not read the tracker — #402 and #431 sat five and
  eight days on a `maxFiles` number and a lint warning respectively. `resolve` re-gathers any
  `ready-for-human` older than three days and re-triages it, on the assumption that a routine was
  over-cautious rather than that a person is busy.

All five exist on the tracker now, `needs-info` included (it was missing when this file was written,
and `resolve` § 1 reaches for it on underspecified issues). These exact strings are what the routines'
gather steps and `routine-guard`'s ownership rules match on, so rename none of them.

## `enhancement` — product work, not agent backlog

GitHub's default label, pressed into a second job this repo needs: **the finding is real and nobody on
either shelf is scheduled to do it.** A new mutator, a hit-test, an affordance, a slice whose shape is
still a design question. It is the counterpart to `ready-for-human` — where that label means the owner
must act (rule 10's four conditions and nothing else), this one means the owner's _roadmap_ must act,
which no scheduled routine may claim on its own issue.

Why a label rather than a queue: `resolve` gathers `ready-for-agent`, `needs-triage` and unlabelled
issues and is told to skip a design question on sight (`resolve.md` § 2), so an `enhancement` wearing
`ready-for-agent` is re-examined and re-refused every night it is open — cost to the routine, benefit to
nobody, and a backlog count that cannot fall. `enhancement` takes it out of the gather set the same way
`log` does, without implying the finding is wrong.

Nothing here reduces the work. It says which queue the work is in.

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
