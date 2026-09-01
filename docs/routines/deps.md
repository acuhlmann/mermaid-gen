---
name: deps
tier: code-writing
schedule: '30 4,16 * * *'
maxFiles: 6
prTitlePrefix:
  - 'deps:'
branchPrefix:
  - deps/
allowedPaths:
  - package.json
  - apps/*/package.json
  - packages/*/package.json
  - apps/**
  - packages/**
  - docs/**
forbiddenPaths:
  - apps/server/src/mcp/apps/**
  - apps/web/src/assets/**
---

# Routine: `deps`

**Read [`docs/routines/README.md`](README.md) first — it carries the rules this routine assumes.**

Owns every dependency change from the alert to the merge: Dependabot's open PRs, the security
advisories behind them, and the code that breaks when a package moves. Nothing else on either shelf
read them; this routine exists because the alternative was a human noticing on day eight.

## Why a routine, and why the lockfile is not its to write

`resolve.md` § 2b carried this duty from 2026-08-30 to 2026-09-01 and it did not work — the section
ran "after the issue pick and only if the pick left budget", so on any night an issue was fixable the
queue went unread, and on the other nights one PR was merged out of a group of three. Three
dependabot PRs sat green and unmerged for a week each (#378, #379, #455). A duty attached to a routine
whose job is something else is not a duty.

Separating it also draws the one boundary that matters for supply chain: **`package-lock.json` stays
on the always-forbidden list** (`scripts/routine-guard.mjs` `ALWAYS_FORBIDDEN`), so no routine can
author a resolved tree. Dependabot writes lockfiles; this routine writes code and _commands_
Dependabot. Every fix here is either a merge, a Dependabot instruction, or a source change that lets
Dependabot's own PR go green. An upgrade that cannot be expressed that way is not this routine's work.

`'30 4,16 * * *'` (12:30 and 00:30 HKT) sits off the night ladder on purpose: dependency queues move
in bursts when an advisory lands, and twice-daily bounds how long a `high`-severity fix waits. It is
also the only job on either shelf not competing for the same 4-hour window, so a burst of Dependabot
PRs never delays a review or a resolve.

## 1. Gather

```bash
gh pr list --state open --author app/dependabot \
  --json number,title,createdAt,mergeable,statusCheckRollup,files
gh api /repos/acuhlmann/mermaid-gen/dependabot/alerts?state=open \
  --jq '.[] | "\(.number)|\(.security_advisory.severity)|\(.dependency.package.name)|\(.security_vulnerability.first_patched_version.identifier)"'
```

In the cloud sandbox `gh` has no token (README rule 9) — use the GitHub MCP tools for both reads and
every write, and confirm each write landed by reading it back.

Two facts to read from the payloads rather than assume:

- A **grouped** PR ("bump the npm_and_yarn group") carries several packages. Judge each entry in its
  body; the PR is one unit, so the whole group waits for its worst member.
- An **alert with no PR** is normal for weeks: Dependabot opens version PRs on its own schedule, and
  `first_patched_version: null` means there is literally nothing to bump to yet. That last case is
  waiting-upstream, not work.

## 2. Merge queue — same day, not after seven days

Merge every Dependabot PR that is **mergeable, has every required check green, and contains only
patch or minor** bumps. No age threshold: #378 and #379 were green on the day they opened and a human
found them eight days later. Age was never the point; the missing reader was.

Security PRs (the body cites a `GHSA-` or the PR carries the `dependencies` label plus an alert link)
go first, ahead of any plain version bump in the same run.

Before merging, read the diff of the manifest hunks. A bump that lands a **new transitive package**
the repo has never resolved is a supply-chain event, not a merge: leave it, comment what appeared, and
put it in the ledger's `todos` for a human — this is README § "What routines may not do" (no new
dependencies) applied to a diff that arrives wearing a routine's clothes.

## 3. Red or conflicted — classify, then act

| Cause                                                           | Action                                                                                                                                                                                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch behind `main` (conflict, or checks never ran)            | Comment `@dependabot rebase`. One per run per PR; a second conflict is a real problem, go to the next row.                                                                                                                                     |
| A check that is the documented load flake                       | Re-run it once (`gh run rerun --failed`). Second red is a real red — README § 3.                                                                                                                                                               |
| The bump breaks this repo's code, mechanically                  | Fix the **source**, not the lockfile: compat shim, renamed API, updated type. Push to your own branch, open a `deps:` PR, merge on green, then `@dependabot recreate` so the dependency PR reopens against the fixed code and § 2 can take it. |
| The bump breaks this repo's code and the fix is a design change | Stop. Comment on the PR with the analysis — what breaks, where, what the upgrade would cost. Ledger `todo`. Leave the PR open.                                                                                                                 |
| Upstream itself is broken (a failing package's own tests)       | Comment, ledger `todo`, leave open. Not ours to fix.                                                                                                                                                                                           |

`@dependabot recreate` is the only route back to a mergeable dependency PR after a source fix, and it
keeps the lockfile Dependabot-authored. **Never** push a lockfile onto a Dependabot branch, and never
resolve a conflict by hand-editing one.

**Never `@dependabot ignore`, `cancel`, or close a PR.** Dismissing an advisory is a risk decision
about somebody else's vulnerability, and it is on the page bar (README § 10) — the one thing in this
playbook that waits for the owner.

## 3b. An actionable alert with no PR yet

The common state, not the edge case: the 19 alerts created 2026-08-22 produced exactly one PR, eight
days later. So § 2 and § 3 can both be "nothing to do" while seven patched versions sit unapplied.

Read the alerts, not just the PRs:

```bash
gh api '/repos/acuhlmann/mermaid-gen/dependabot/alerts?state=open&per_page=50' \
  --jq '.[] | "\(.security_advisory.severity)|\(.security_vulnerability.package.name)|patched:\(.security_vulnerability.first_patched_version.identifier // "none yet")"'
```

Then split them, because the two halves need different things:

- **`patched: none yet`** — waiting upstream. Nothing to open, nothing to merge. Count them in the
  ledger row and stop; they are not a queue that can move.
- **A patched version, no PR** — actionable, and this routine still cannot make the PR itself: the fix
  is a `package.json` constraint _plus_ the resolved tree, and the tree is exactly what § "Why a
  routine" keeps out of an agent's hands. So:
  1. Check whether a PR exists under a different author (a version bump Dependabot opened as a
     _version_ update rather than a security one). If so, it is § 2's to merge.
  2. If there is none, leave a comment on the alert naming the patched version, and record it as a
     ledger `todo` — one line per package, severity first.
  3. Say the count in the digest's dependency-queue line (`digest` watchdog 5 reads exactly this).
     **"Open the update" is a button in the Security tab, and clicking it is page bar #2** — a
     permissioned UI action, not something a routine can do. The owner presses it once; § 2 merges
     what arrives. A routine that could not do the whole thing alone still made the remaining step a
     single click with a name on it, which is the point of the ledger.

Do not raise an alert to an issue labelled `ready-for-agent` for a package bump: `deps` re-reads the
alert list every firing, and an issue is a second, slower, staler copy of state the API already has.

## 4. Majors

A major is not automatically a human decision, and `ready-for-human` is not available to this routine:
the label is page-bar-only as of ADR-0017, and a queue that parks on majors is how `mermaid` sat at
11.16 while its patch bumps sat unmerged.

Attempt it, within `maxFiles`:

1. Read the release notes / migration guide named in the PR body.
2. If the breaking API is used in **fewer files than the budget allows**, fix the call sites, add or
   update the tests that pin the old behaviour, and land it as a `deps:` PR. Then
   `@dependabot recreate` (or open the bump yourself — see § 5 for when a routine may edit a manifest).
3. If it is broader than the budget, or the breakage is a _design_ change in how the package is used
   (a replaced transport, a removed mode, a new async model), that is a decision with a migration
   cost and an alternative worth discussing. Comment the analysis on the PR, put it in `todos`, and
   say so in the digest. It is not a page-bar item unless it also costs money or a licence.

**A manifest edit by this routine is allowed only for a version already resolved by Dependabot or
already published and cited in an alert.** Adding a package name that has never appeared in
`package.json` is out of scope forever (README § What routines may not do). `package-lock.json` stays
untouched whatever the case: run `npm install --package-lock-only` never, and if a command would
rewrite it, that command is not this routine's.

## 5. Verify a bump actually works, not just that CI is green

CI covers the test suites. It does not cover the built bundle's size or the runtime paths the suites
stub. When the bump touches a rendering or parse dependency (`mermaid`, `@antv/*`, `vega-*`,
`dompurify`, `marked`, `@copilotkit/*`), run the two key-free corpus benches and compare against the
last recorded numbers in the ledger:

```bash
node --import ./scripts/register-antv-layout-esm.mjs --import tsx \
  apps/server/scripts/benchMermaid.js --tag deps-$(date +%F)
node apps/server/scripts/benchAnything.js --tag deps-$(date +%F)
```

Read **`expectationMatch`**, not `acceptRate` (the accept rate is a property of the corpus). A flipped
expectation is a behavioural change in the dependency: do not merge it, investigate per § 3.

Never `benchAnythingGeneration.js` — it drives a real model and spends tokens.

## 6. Close

Append a ledger row: date, PRs merged (numbers), PRs left open **with their cause and their age**,
alerts newly fixed (CVE → version), alerts still open, and the bench verdict when § 5 ran. Record the
queue's worst item in the ledger's `todos` so the next firing starts where this one stopped.

```bash
npm run routine:guard -- --preflight deps    # BEFORE starting
npm run precommit
npm run check
npm run routine:guard -- --postflight deps    # BEFORE pushing
```

The preflight one-branch-at-a-time check matches on the `deps:` title prefix. Dependabot's own open
PRs are **not** that branch and must not stop this routine from running: on 2026-08-30 the guard was
deliberately taught to ignore a foreign fleet, and this routine's whole subject matter is a foreign
author's branches.
