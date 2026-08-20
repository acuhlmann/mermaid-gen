---
name: review
tier: report
schedule: '0 6 * * *'
maxFiles: 2
allowedPaths:
  - docs/routines/ledger/review.md
  - docs/agents/ratchet.json
forbiddenPaths:
  - apps/**
  - packages/**
  - scripts/**
---

# Routine: `review`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Reviews everything that landed on `main` in the last 24 hours and reports what it finds. It writes
**no product code**: its only outputs are GitHub issues, a ledger row, and a push notification.

## Why this runs at all

The daily feature routine self-merges its PRs minutes after opening them, and the repo has had zero
open issues and no PR that ever waited for a human. Feature work therefore lands unreviewed by
construction. This routine is the counterweight — not a gate (nothing is blocked on it), but a
second pair of eyes that arrives the morning after.

`0 6 * * *` is chosen deliberately: the feature routine fires at 20:00 UTC and its PRs land 1.5–6 h
later, so 06:00 reliably sees a settled `main`.

## Work queue

### 1. Establish the window

```bash
git fetch origin main
git log --oneline --since='24 hours ago' origin/main
```

If nothing landed, append a "quiet" row to the ledger and stop. That is a successful run.

Read the ledger's `## Run log` first — a finding already filed yesterday must not be filed again.
Match on the issue title, and if in doubt search the tracker before opening anything.

### 2. Two-axis review

Follow [`.claude/skills/mattpocock/engineering/code-review/SKILL.md`](../../.claude/skills/mattpocock/engineering/code-review/SKILL.md),
with the merge-base of the window as the fixed point. Both axes run as **parallel sub-agents** so
they do not pollute each other's context, and their findings are reported separately — never merged
or reranked, because a change can pass one axis and fail the other.

- **Standards** — does the diff follow this repo's documented conventions, plus the Fowler smell
  baseline the skill carries? Skip anything the sensors already enforce; `npm run check` has
  already spoken on formatting, boundaries and types.
- **Spec** — does the diff do what its PR body and any linked issue said it would? Scope creep
  counts: behaviour nobody asked for is a finding.

### 3. The archislop trap checklist

These are failure modes this repo has actually shipped and written up, which makes them the
highest-yield things to look for. Every one of them is a test or a feature that **passes while
examining nothing**, so none of them show up as a red build.

| Look for                                                                       | Why it matters                                                                                          | Reference                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A `vi.mock` path that resolves nowhere                                         | Vitest does not raise; the real module runs and the suite passes for the wrong reason                   | `apps/web/test/viMockPathsResolve.test.js`                                   |
| A loop over a derived set with no companion non-empty assertion                | A sweep over an empty list passes while testing nothing                                                 | `AGENTS.md` § Safety and hygiene                                             |
| `rerender(...)` and `advanceTimersByTimeAsync(...)` in one `act` block         | The clock advances before the timer exists; measured as zero `fetch` calls vs one                       | `AGENTS.md` § Safety and hygiene                                             |
| A mounting floor test missing the midday clock pin **or** the `0.75` PRNG seed | Passes in isolation, fails in file order — or is red only in the afternoon                              | [`docs/agents/isometric-floor-tests.md`](../agents/isometric-floor-tests.md) |
| A locale key added to `en` only                                                | Office bundles swap wholesale (silently dead feature); UI bundles deep-merge (silently English forever) | `CLAUDE.md` § Office layer gotchas                                           |
| A wire field added producer-side only                                          | Server works, web silent                                                                                | [`docs/agent-blast-radius.md`](../agent-blast-radius.md)                     |
| A new `packages/shared` module used without `npm run build -w packages/shared` | Resolves to `dist`, so the import is `undefined` at runtime, not a module error                         | `CLAUDE.md`                                                                  |
| A second composition of office floor activity outside `floorActivityFor`       | Six components draw figures; a second site is how the room starts disagreeing with itself               | ADR-0011                                                                     |
| An ADR contradicted without being named                                        | `docs/agents/domain.md` requires surfacing the conflict, not overriding it silently                     | [`docs/agents/domain.md`](../agents/domain.md)                               |

### 4. Benchmarks

All six drivers are corpus-only, need no API key, and exit non-zero on expectation drift:

```bash
node apps/server/scripts/benchMermaid.js --tag review-$(date +%F)
node apps/server/scripts/benchInfographic.js --tag review-$(date +%F)
node apps/server/scripts/benchChart.js --tag review-$(date +%F)
node apps/server/scripts/benchMetaphor.js --tag review-$(date +%F)
node apps/server/scripts/benchAnything.js --tag review-$(date +%F)
```

**Not `benchAnythingGeneration.js`.** That one drives a real model, so it costs tokens and needs a
key — it is a human-initiated measurement, not something a daily unattended run should spend. The
five above are corpus-only.

Report `acceptRate`, `expectationMatch` and `latency.p95` against the newest committed snapshot in
`apps/server/bench-results/`. **Do not commit new snapshots** — that directory is on the don't-touch
list, and a daily run would bury the meaningful baselines under noise. Latency on a shared runner is
informational only; a p95 move is worth a sentence in the digest, never an issue on its own.

An expectation drift (a case that used to be accepted and now is not, or vice versa) **is** worth an
issue, because that is a real validator behaviour change.

### 5. File the findings

One issue per finding, labelled per [`docs/agents/triage-labels.md`](../agents/triage-labels.md):

- `ready-for-agent` when the issue names the file, the symptom, and what correct looks like — i.e.
  another agent could pick it up with no further context.
- `needs-triage` otherwise.

Only `wontfix` exists on the repo today; the other four labels may need creating on first use.

Issue bodies name the commit or PR, quote the hunk, and say what the failure would look like in
practice. A finding you cannot state as a concrete failure is not yet a finding — leave it in the
ledger as an observation instead of filing noise.

**Confidence bar:** if you would not bet on it being real, do not file it. An issue tracker that
fills with speculative findings gets ignored, which costs more than the findings were worth.

### 6. Close the loop

Append a ledger row: date, commits reviewed, issues filed (with numbers), bench verdict. Send the
push notification as one line: `review: N commits, M issues, benches OK`.

## Escalation

If the same finding appears three runs running and no issue has been actioned, say so in the digest
once and then stop repeating it. Nagging is how a routine gets muted.
