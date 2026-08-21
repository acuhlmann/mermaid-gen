---
name: resolve
tier: code-writing
schedule: '0 3 * * *'
maxFiles: 6
allowedPaths:
  - docs/routines/ledger/resolve.md
  - apps/**
  - packages/**
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
---

# Routine: `resolve`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this playbook assumes.**

Works down the open-issue backlog `review` and `improve` leave behind. Those two routines file
findings and fix at most one bug each per run — nothing previously came back for the rest, so they
sat waiting for a human to hand them back to an agent. `resolve` is that hand-back, done on a
schedule.

`0 3 * * *` (11:00 HKT) sits two hours after `review` (`0 1 * * *`), so today's freshly filed issues
are visible in the backlog before this routine reads it.

## 1. Gather

```bash
git fetch origin main
```

List open issues labelled `ready-for-agent` or `needs-triage` (`docs/agents/triage-labels.md`).
Read the ledger's run log and `Locked`/`Open observations` sections first — an issue already
attempted twice with no human action is not a fresh pick (see Escalation below), and an issue
already escalated is not re-escalated on the same finding.

For a `needs-triage` issue: read it in full. If it already names the file, the symptom, and what
correct looks like, treat it as scoped even though the label hasn't caught up. If it genuinely does
not — no repro, no file, no clear "correct" — this routine cannot safely act on it: leave a comment
asking for the missing piece, relabel `needs-info`, and move on. Guessing at an underspecified
report is exactly the shape of mistake this routine exists to avoid.

## 2. Pick one

Take the **highest-confidence issue that fits the budget** — same bar as `review` § 3: if you would
not bet on it being real and locally fixable, do not attempt it. Prefer small, mechanical,
single-file fixes over anything that reads like a design question. Push everything else back into
the ledger's `todos` untouched.

Skip on sight, leave filed, do nothing further this run:

- Anything asking for a hub split or refactor (`docs/agents/balanced-coupling-priorities.md`: split
  on contact, and a schedule has no feature to be on contact with).
- Anything asking for a new dependency, a lint-severity promotion, or slot content (ADR-0014's three
  carve-outs — see `README.md` § What routines may not do).
- Anything whose fix cannot be expressed as `apps/**` / `packages/**` changes within `maxFiles`.

## 3. Fix — same bar as `review`, one issue per run

Write the regression test first, run it against the unfixed code, **observe it red**, then fix and
watch it go green. An issue you cannot make a test fail for is not one you understand well enough to
resolve unattended — comment why on the issue (what's missing to make it testable) and leave it
`ready-for-agent` for a future run or a human, whichever adds the missing piece.

Never widen the fix beyond the issue. Never touch a don't-touch path.

## 4. Escalate instead of merging — when uncertainty or risk is real

Default path: push the branch, open the PR, wait for `npm run check` + CI green, **merge it
yourself**, close the issue with a link to the merged PR. That is the common case and needs no
extra ceremony.

Take the escalation path instead — push the fix and open the PR, but **do not merge it**, comment on
the PR explaining exactly what you're unsure about or what's at risk, and switch the issue's label
to `ready-for-human` (leave a comment on the issue pointing at the PR) — when **any** of these hold:

- The fix touches a trust boundary: a sanitizer or allowlist that is the whole safety model for a
  slot (`mermaidSanitizer.ts`, `infographicSanitizer.js`, `chartSchema.ts`/`vega-lite` compile gate,
  `parseAnythingHtml`/`lintAnythingPolicy`/`runAnythingRuntimeCheck`, `parseFormsA2ui`), the Anything
  sandbox/CSP wiring (`AnythingRenderer.jsx`, `wrapAnythingSrcDoc` — never add `allow-same-origin`),
  or anything auth/session/secret-adjacent.
- The correct fix isn't obvious from the issue and the code — you're choosing between two plausible
  approaches, or the "what correct looks like" the issue names turns out to be ambiguous once you're
  in the code.
- The regression test needed real product-behaviour judgement to write (as opposed to being a direct
  transcription of the bug report) — a test you're not fully sure is asserting the right thing is not
  a green light, it's the uncertainty in a different shape.
- The diff would touch a path adjacent to (not on, but near) the don't-touch list, or a file the
  ratchet/ADR-0005 table is already tracking as a monolith under active budget pressure.
- CI is green but flaky-adjacent — the one documented exception in `README.md` § 3 aside, any red you
  had to reason your way past rather than cleanly reproduce and fix.

This is not a lower bar than "confident enough to fix" — it's what happens when a fix clears that
bar for _correctness_ (you can prove it with a test) but not for _unattended-merge risk_. Both can
be true at once, and conflating them is how a routine ends up merging something it was privately
unsure of.

## 5. Close

Append a ledger row: date, issue picked (number + title), outcome (merged PR number, or escalated
PR number + why), and anything skipped with a one-line reason. Move the issue's tracking entry in
the ledger `todos` to `completed` (merged) or leave it `pending` with the escalation noted (still
open, now on a human).

## Escalation nagging

If the same issue gets escalated three runs running with no human action on the PR, say so once in
the ledger and stop re-touching it that run — pick the next candidate instead. Re-escalating the same
finding every night is the routine version of the review nag rule, and it burns budget that could
fix something else.
