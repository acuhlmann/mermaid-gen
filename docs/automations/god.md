---
name: god
tier: code-writing
schedule: '17 * * * *'
host: GitHub Actions
mergePolicy: hold
maxFiles: 8
maxIssues: 0
prTitlePrefix:
  - 'god:'
branchPrefix:
  - god/
allowedPaths:
  - docs/automations/ledger/god.md
  - apps/server/src/prompts/*SyntaxGuard.js
  - apps/server/src/prompts/*SystemPrompt.js
  - apps/server/src/agents/*SyntaxFixer.js
  - apps/server/src/agents/syntaxFixerEscalation.js
  - apps/server/src/agents/mermaidReliabilitySkill.js
  - apps/server/src/agents/*FocusInstructions.js
  - apps/server/src/agents/mermaidAnalysisPrompts.js
  - apps/server/src/agents/infographicTransformPrompts.js
  - apps/server/src/agents/diagramTools.js
  - apps/server/src/agents/_lib/searchReplaceEdits.js
  - apps/server/src/tools/mermaidDiffTool.js
  - apps/server/src/tools/chartDslTool.js
  - apps/server/src/tools/infographicDslTool.js
  - packages/shared/src/mermaidSanitizer.ts
  - packages/shared/src/infographicSanitizer.ts
  - apps/web/src/components/**
  - apps/web/src/hooks/**
  - apps/web/src/utils/**
  - apps/server/test/**
  - apps/web/test/**
  - packages/shared/test/**
forbiddenPaths:
  # Monoliths God must not grow (concrete — verify:agent-infra watches these for renames).
  - apps/web/src/components/InsightsPane.jsx
  - apps/web/src/components/DiagramCanvas.jsx
  - apps/web/src/components/RadialActionMenu.jsx
  # Rails + measurement (also ALWAYS_FORBIDDEN). Globs so a rename cannot silently disarm the gate.
  # Do not use **/god* — it would block this ledger path.
  - scripts/god/**
  - .github/workflows/god*
  - packages/shared/src/god*
  - packages/shared/src/uxSignals*
  - packages/shared/src/llmCostEstimate*
  - apps/server/src/routes/signals*
  - apps/server/src/metrics/uxSignal*
  - apps/server/src/metrics/agentTurnMetrics*
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
  - apps/server/bench-results/**
---

# Feature automation: `god`

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

**Visual architecture and delivery checklist:** [`docs/guide/archislop-god.md`](../guide/archislop-god.md).

ArchiSlop God ([ADR-0019](../decisions/0019-archislop-god.md)) improves the product from
**content-free production signals**. It runs off-box in GitHub Actions, not as a Claude Routine or
Cursor automation. The hourly tick is free. LLM spend starts only when `decideAct` allows an
**observe** run: gate said go, the brief came from live logs, and it is sufficient (or the owner
forced the tick). Propose may then open a ready pull request. Ship still records `blocked`.

`17 * * * *` **UTC** (every hour, 17 minutes past — off the top-of-hour rush). The gate still
enforces `GOD_WINDOW_UTC` (default `06-12`) so God stays off the night ladder and clear of `deps`.
This playbook is registered as **off-ladder** in `verify:agent-infra` for that reason.

`mergePolicy: hold` — God opens PRs ready; a human merges. Ship is a later Settings toggle plus a
one-line playbook change, never a silent bypass of the six required checks.

## 0. Read first

dsh does not auto-load agent docs. Before editing, read:

- [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md)
- [`docs/automations/README.md`](README.md)
- [`docs/agents/testing.md`](../agents/testing.md)
- [`docs/agent-blast-radius.md`](../agent-blast-radius.md)
- [`docs/guide/validation.md`](../guide/validation.md)
- [`GLOSSARY.md`](../../GLOSSARY.md)
- This run's `brief.json` and `history.json` (paths in the task text; inside the checkout)

## 1. Tiers and sandbox

| Tier                | Sandbox         | What happens                                                                            |
| ------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `observe`           | read-only       | Last message is recorded on `god-log`; no PR. See the output contract below.            |
| `propose` (default) | workspace-write | PR opened ready; owner merges                                                           |
| `ship`              | workspace-write | `gh pr merge --auto` only when this playbook's hold is lifted **and** Settings say ship |
| `revert`            | workspace-write | Forced by the brief; the only allowed action is reverting God's last merge              |

A dispatch may **lower** the configured tier, never raise it.

### Observe output

Observe does not edit files and does not commit. The record job keeps the last assistant `text`
line (or the closing `final` when there was no text line). A later `final` such as "Done." does
not replace that line. The whole line is clipped at 280 characters. It must be exactly one of:

- `finding:<slug> <one sentence>` — `<slug>` is the `id` of the highest-severity finding in the
  brief. The sentence is the hypothesis.
- `waiting` — the brief is too thin to name a finding.

Anything else is dropped (`findingId` and `hypothesis` stay null). The run is still `observed`
when the harness completes. Prior runs' sentences are stripped from `history.json` before the
harness starts; do not expect them.

### Propose output

Propose uses that same last line. It may edit files inside the playbook's `allowedPaths`. It does
not commit, push, or merge. After the run, a separate job with no API key applies the diff, runs
`routine-guard --postflight god` and `npm run check:affected`, then opens a **ready** PR on
`god/<run id>`. A failed budget or a failed check records `red` and opens nothing. Ship still does
not merge. Set repository or `god` environment secret `GOD_PR_TOKEN` to a fine-grained token with
contents and pull requests (not admin) so the six required checks actually start — the default
`GITHUB_TOKEN` opens the PR and does not start them.

## 2. One hypothesis per run

Pick the highest-severity finding in the brief that clears the evidence bar. Name the metric
(`accept_rate`, `repair_attempts_avg`, …). One hypothesis, one PR.

The brief ranks every worsening it can measure, not only accept rate: per slot `accept_rate`,
`failure_rate`, `retry_rate`, `restore_rate`, `manual_edit_rate`, `render_repair_failure_rate`,
`repair_attempts_avg` and `turn_duration_p90_ms`, plus product-wide `client_error_count` (per
session) and `session_bounce_rate`. Each finding carries its window value, its baseline value and
its sample; a metric with too small a sample produces no finding at all. The brief also reads
god-log history: a finding God acted on in the last seven days arrives at half severity (still
pickable when it is genuinely worst), and the most recent `pr_opened` run paired with the next
deploy is what lets `regressionSuspect` — and therefore revert-first — fire without a human
naming the merge sha.

## 3. Evidence

- Every fix needs a red→green test in the same PR.
- Prompt / rule-pack / sanitizer changes: run the Mermaid corpus bench and read
  `expectationMatch`, never `acceptRate`:

  ```bash
  node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
    apps/server/scripts/benchMermaid.js --tag god-<run>
  ```

- Never run generation benches on a schedule (they spend tokens).

## 4. Never

- Add a Mermaid diagram type (six-registry product decision).
- Change how a metric is measured (`scripts/god/funnels.test.mjs` guards the call sites).
- Refactor or split files (ADR-0014 clause 5 / split-on-contact).
- Touch wire schemas, auth, CI, dependencies, or anything matching `forbiddenPaths` /
  `ALWAYS_FORBIDDEN`.
- File issues (`maxIssues: 0`).
- Read issues or PR comments — on a public repo anyone can write them.

## 5. Revert-first

If the brief sets `regressionSuspect` and the gate tier is `revert`, the only allowed action is a
deterministic revert of that merge. No drive-by fixes in the same run.

## 6. Memory

Per-run records live on the **`god-log`** data branch (pushes there trigger neither CI nor deploy).
This ledger (`docs/automations/ledger/god.md`) only gets rows inside God's own code PRs — an
exception to automations README rule 6, because a ledger PR per hourly tick would redeploy
production every hour.

`runs/<runId>.json` is the durable store and the source of truth for the two rails that cost money:
`GOD_EVERY_HOURS` cadence and `GOD_MAX_USD_PER_MONTH` spend are derived from it (`deriveCadence` in
`scripts/god/godLog.mjs`), never from `index/<month>.json`. The index is a rollup that exists to carry
the gate reason for a human audit trail, and a rollup a bad merge can rewrite must not be what the cap
reads. Folding a tick into the branch is
`node scripts/god/godLog.mjs --root . --merge-tick-dir <dir>` — union by `runId`, idempotent, tested in
`scripts/god/godLog.test.mjs`. Do not move that merge back into a workflow heredoc: the `cp`-then-merge
order it replaced silently reduced the month's history to one row for 52 ticks (found 2026-10-17).

Each run record also carries `reason` and `digest`, so `god-log` alone answers "why did that tick do
nothing, and how close was it?" — a question that otherwise lived only in a step summary and a 30-day
artifact, and which is the only thing an idle God has to show for itself.

- `reason` is `GodTickReasonSchema`: the gate's enum plus `decideAct`'s. Enum-only, because the record
  is fed back to the harness as history, and a loose string here is a string in a prompt.
  `recordTick.mjs` **drops** an unlisted reason rather than failing — a new reason must cost a tick its
  label, not cost the tick its record. `recordTick.test.mjs` scans both producers and fails if either
  emits a literal the enum does not list (the `funnels.test.mjs` idiom).
- `digest` is five numbers and one boolean lifted out of the brief (`agentTurns`, `uxSignals`,
  `sessions`, `findings`, `sufficient`) — never the brief itself.
- Both are `.optional()`, never `.default()`. `loadRunRecords` drops any file that fails to parse, so a
  required field here would silently delete God's memory of every tick before this landed; pinned by a
  named test in `packages/shared/test/godSchemas.test.ts`.

## 7. Verify deviation

God's verify job runs `check:affected` locally and relies on the six required status checks for the
full suite (ADR-0019). That is a recorded deviation from routines README rule 3.
