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

ArchiSlop God ([ADR-0019](../decisions/0019-archislop-god.md)) improves the product from
**content-free production signals**. It runs off-box in GitHub Actions, not as a Claude Routine or
Cursor automation. The hourly tick is free; LLM spend only starts when the `act` job lands (a later
PR). Until then the workflow runs **gate → brief** only and records a noop on `god-log`.

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
- This run's `brief.json` and `history.json` (paths in the task text; outside the checkout)

## 1. Tiers and sandbox

| Tier                | Sandbox         | What happens                                                                            |
| ------------------- | --------------- | --------------------------------------------------------------------------------------- |
| `observe`           | read-only       | Findings go to `god-log` only; no PR                                                    |
| `propose` (default) | workspace-write | PR opened ready; owner merges                                                           |
| `ship`              | workspace-write | `gh pr merge --auto` only when this playbook's hold is lifted **and** Settings say ship |
| `revert`            | workspace-write | Forced by the brief; the only allowed action is reverting God's last merge              |

A dispatch may **lower** the configured tier, never raise it.

## 2. One hypothesis per run

Pick the highest-severity finding in the brief that clears the evidence bar. Name the metric
(`accept_rate`, `repair_attempts_avg`, …). One hypothesis, one PR.

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

## 7. Verify deviation

God's verify job runs `check:affected` locally and relies on the six required status checks for the
full suite (ADR-0019). That is a recorded deviation from routines README rule 3.
