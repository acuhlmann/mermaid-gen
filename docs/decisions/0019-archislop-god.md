# ADR-0019: ArchiSlop God — production signals drive an off-box self-improvement rung

## Status

Accepted — 2026-10-14 (owner decisions in the design session that produced it). Scopes
[ADR-0010](0010-cast-agency-sign-off.md) exactly as [ADR-0014](0014-autonomous-nfr-routines.md)
clause 5 does, and extends the shelf contract of ADR-0014, [ADR-0017](0017-routine-ownership-dependabot-and-the-attention-bar.md)
and [ADR-0018](0018-green-builds-self-healing-and-the-two-minute-ask.md) to a third host with the
deviations recorded below. Delivered in three PRs; § "Where this lives in code" marks what is
still to come.

## Context

The owner asked for the app to improve itself from what users actually do — with visibility into
what the improver did and is doing, configurable cadence and duration, paid from a DeepSeek account
whose prepaid balance is a hard money cap.

Nothing connected production to the fleet. Every rung works from repo state, benches or the
backlog. Production kept nothing durable: `recordAgentTurn` wrote content-free lines only when
`MERMAID_METRICS=1`, which no deploy set; every store is an in-process `Map` on a service that
scales to zero.

The literal shape — an agent that edits production — fails three ways. Cloud Run replaces the
container on every deploy and cold start (`--min-instances=0`), so an in-place edit is lost. An
agent fed by visitor behaviour while holding production secrets can be steered by any visitor.
And nothing would run the tests or leave a revert point. Three facts shaped the rest: the repo is
**public** (every input, log and artifact an agent sees is world-readable); **every merge to
`main` deploys** (so a ledger PR per run would be an hourly production deploy); and production's
Brain runs on DeepSeek with **no fallback** (a shared balance drained by a background agent breaks
the product).

## Decision

1. **Production records, never triggers.** The server writes content-free JSON lines
   (`agent_turn`, `ux_signal`) to stdout, which Cloud Run ships to Cloud Logging. A signal is a
   strict Zod union of enums, bounded integers and booleans — no ids, IPs, prompts, diagram text or
   error messages. Nothing in the serving process schedules, calls or wakes God.
2. **God runs off-box** in GitHub Actions: gate → brief → act → verify → publish. Each job holds at
   most one kind of credential; the jobs that execute agent-written code hold nothing that can
   write to GitHub.
3. **Every change is a PR.** Tiers: _observe_ (no code), _propose_ (PR opened ready, the owner
   merges — the default), _ship_ (`gh pr merge --auto`, per ADR-0018). Ship is a runtime setting,
   never a direct merge; God's bot identity holds no admin and cannot bypass the six required checks.
4. **Inputs are bounded.** God reads the repo at `main`, its playbook and ledger, a brief computed
   deterministically from signals (strict schema), and its own run history. It never reads issues,
   PR comments or any other free text — on a public repo anyone can write those. "Run now" takes an
   enum focus, never prose.
5. **Money is enforced outside the harness.** God bills a separate DeepSeek account whose prepaid
   balance is the hard cap. A local metering proxy holds the key (read from a file that is then
   deleted; the harness gets a dummy) and answers HTTP 402 past the per-run cap. Wall clock and job
   timeout bound duration, a monthly soft cap comes from run records, and frozen hard limits in
   `godBudget.ts` clamp every setting.
6. **The harness is DeepSeek Harness (`dsh`), pinned exactly, behind an adapter.** It has no hooks,
   no cost limits and no tool allowlist, so paths are enforced after the run
   (`routine-guard --postflight god`, exclusivity against other automations' paths, then the
   required checks), and its phone-home features — the session-log contributor and dynamic plugin
   loading — are switched off and verified. A spike with written go/no-go criteria gates the first
   code-writing run; on no-go the owner decides. No silent engine switch.
7. **God's rails are frozen.** `scripts/god/**` and the signal, schema, budget and owner-gate
   modules join `ALWAYS_FORBIDDEN`. A test fails if a measurement call disappears from a funnel, so
   God cannot improve a number by changing how it is measured.
8. **Memory lives on a `god-log` data branch**, one JSON record per run. Pushes there trigger
   nothing; the repo ledger gets rows only inside God's own code PRs.
9. **Revert-first.** When the brief attributes a regression to God's last merge, the only allowed
   action is a revert of that merge.
10. **Visibility and configuration live in the product, owner-only:** a God window (Now, History,
    Signals, Settings) behind its own door code. Settings are GitHub repository variables written
    through a narrow token that has no contents permission.

## Consequences

- **ADR-0010 is scoped, not superseded.** God operates on the repository, authors no slot content,
  and is started only by cron or the owner. The product still never spends agent compute on a
  user's behalf without a human; God's spend is the owner's, authorised once and bounded by their
  top-up.
- **Recorded deviations from the shelf contract.** (a) Per-run memory is `god-log`, not a ledger PR
  per run. (b) `verify` runs `check:affected` and relies on the required checks for the full suite.
  (c) A third host type beside Claude Routines and Cursor; its CI-only tooling (dsh,
  `actions/create-github-app-token`, artifact upload/download) is pinned exactly and no repo
  manifest or lockfile changes. (d) One new global error listener on the client — the "do not add
  an observer" rule in `apps/web/src/state/CLAUDE.md` governs the office stores, not this.
- **Usage signals default on**, with an opt-out in Settings and Global Privacy Control honoured, and
  every field documented. That is a product-direction call (rule 10, page bar #4) the owner made by
  approving the plan.
- **God's merges deploy like anyone's.** Under propose the owner chooses when. Its window (06–12
  UTC) keeps God off the night ladder and away from `deps`.
- **Attribution is weak at low traffic.** The brief says "insufficient" rather than guessing, and God
  waits.
- **Cost.** Hourly gate ticks are free (public repo); signal log volume is small; LLM spend is
  bounded per run, per month and by the balance.

## Alternatives considered

- **Hot-patching the running server.** Rejected for the three reasons in Context.
- **A scheduler inside the server.** Scale-to-zero means timers do not fire, and it would make the
  product trigger agent spend — ADR-0010's line.
- **A Claude Routine or Cursor automation as host.** Neither bills a separate prepaid DeepSeek
  account, and the owner chose dsh.
- **Claude Code CLI on DeepSeek's Anthropic-compatible endpoint.** More mature (hooks, permissions),
  but the owner chose dsh; the adapter seam keeps it available if the spike fails.
- **Raw prompts as God's input.** Any visitor could steer a code-writing agent, and every input
  lands in public logs.

## Where this lives in code

- Signals: `packages/shared/src/uxSignals.ts`, `apps/server/src/metrics/uxSignalMetrics.js`,
  `apps/server/src/metrics/agentTurnMetrics.js`, `apps/server/src/routes/signals.ts`.
- Budget and wire shapes: `packages/shared/src/godBudget.ts`, `packages/shared/src/godSchemas.ts`.
- Runner: `scripts/god/` (meter proxy, harness adapters, run wrapper) and `.github/workflows/god.yml`.
- Later PRs: the playbook `docs/automations/god.md`, the brief and gate scripts, the owner-gated
  `/api/god` routes, the God window, and the client signal emitter.
