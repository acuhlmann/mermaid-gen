# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

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

**Note:** `wontfix` already exists on the repo. The other four triage labels may need to be created in GitHub the first time they are applied (`gh label create` or via the Issues UI).
