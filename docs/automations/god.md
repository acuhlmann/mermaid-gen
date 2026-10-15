---
name: god
tier: code-writing
schedule: none
host: GitHub Actions
mergePolicy: hold
maxFiles: 10
maxIssues: 1
prTitlePrefix:
  - 'god:'
branchPrefix:
  - god/
allowedPaths:
  - docs/automations/ledger/god.md
  - apps/server/src/agents/**
  - apps/server/src/prompts/**
  - apps/server/src/tools/**
  - apps/server/src/routes/**
  - apps/server/src/metrics/**
  - apps/web/src/state/uxSignalsClient.js
  - apps/web/src/features/**
  - apps/web/src/components/AppErrorBoundary.jsx
  - packages/shared/src/**
  - packages/shared/test/**
  - apps/server/test/**
  - apps/web/test/uxSignals*
  - apps/web/test/*Signal*
forbiddenPaths:
  - scripts/god/**
  - .github/workflows/god.yml
  - packages/shared/src/godBudget.ts
  - packages/shared/src/godSchemas.ts
  - packages/shared/src/uxSignals.ts
---

# Feature automation: `god` (ArchiSlop God)

**Read [`docs/automations/README.md`](README.md) first — it carries the rules this playbook assumes.**

**Read [`docs/guide/archislop-god.md`](../guide/archislop-god.md) for the visual architecture and
delivery checklist.**

ArchiSlop God improves the product from **anonymous production usage** ([ADR-0019](../decisions/0019-archislop-god.md)).
It is **not** a Cursor cron job: it runs in **GitHub Actions** with credentials split across jobs.
Until the scheduled pipeline ships, only the **manual harness spike** runs (see `.github/workflows/god.yml`).

## What God may do

- Propose repo changes that explain a **signal-backed** regression or friction (validator, prompt,
  funnel, repair path).
- Operate in tiers `observe` | `propose` | `ship` ([`godSchemas.ts`](../../packages/shared/src/godSchemas.ts));
  default autonomy is **propose** ([`godBudget.ts`](../../packages/shared/src/godBudget.ts)).
- When the brief attributes a regression to God's last merge, run **revert-first** only — no feature
  work that run.

## What God must never do

- Touch frozen rails (`scripts/god/**`, `godBudget.ts`, `godSchemas.ts`, `uxSignals.ts`, `god.yml`).
- Weaken a safety gate to make a metric look better.
- Author slot content for a live session ([ADR-0010](../decisions/0010-cast-agency-sign-off.md)).
- Read GitHub issues, PR comments, or any free-text production field — the brief is computed from
  enums and counts only.

## Schedule

`schedule: none` until the `gate → brief → act → verify → publish` workflow is registered. When
enabled, runs stay inside the owner's **06:00–12:00 UTC** window (`GOD_WINDOW_UTC`) — deliberately
**off** the night ladder ([`docs/routines/review.md`](../routines/review.md)).

## One slice per run

Same as every feature automation: one evidence-backed change, green `npm run check:affected` (verify
job holds the full required-check contract), append [`ledger/god.md`](ledger/god.md).

## Loader

`scripts/god/run.mjs` builds the task text the harness sees — it points here, the ledger, the brief,
and run history. Do not duplicate instructions in the workflow YAML; edit this playbook instead.
