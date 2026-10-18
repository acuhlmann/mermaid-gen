---
name: god
todos: []
---

# Ledger: `god`

## Locked

- **ADR:** [0019-archislop-god.md](../../decisions/0019-archislop-god.md) — accepted 2026-10-14.
- **Host:** GitHub Actions (`.github/workflows/god.yml`), environment `god`.
- **Harness:** DeepSeek Harness (`dsh`), pins in `scripts/god/dsh/versions.json`. Spike GO on
  2026-10-14 (~$0.02, all 14 checks).
- **Signals:** `agent_turn` + `ux_signal` → Cloud Logging bucket `god-signals` (30 days). Reader SA
  `god-observer@[REDACTED].iam.gserviceaccount.com` (viewAccessor on that bucket only; WIF scoped to
  `acuhlmann/mermaid-gen`).
- **Config:** repo variables `GOD_*` (defaults from `godBudget.ts`). `GOD_ENABLED=true` since the
  owner flipped it by hand (the 2c God window is what makes it self-service); `GOD_AUTONOMY=propose`,
  `GOD_EVERY_HOURS=24`, `GOD_WINDOW_UTC=06-12`, `GOD_MAX_USD_PER_RUN=1`, `GOD_MAX_USD_PER_MONTH=20`.
- **Wallet:** GitHub Actions environment `god` secret **`OPENROUTER_GOD_KEY`** (default upstream;
  `--upstream deepseek` rollback in `scripts/god/upstream.mjs`). Not mounted on Cloud Run — Brain
  keys stay separate.
- **Data branch:** `god-log` (orphan). Per-run JSON records; this ledger is for code-PR rows only.
- **Schedule:** `17 * * * *` UTC; gate window default `06-12` UTC. Off the night ladder on purpose.

## Baselines

Filled from the first sufficient brief after signals accumulate in `god-signals`.

## Run log

| Date (UTC) | Trigger | Verdict | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | PR  |
| ---------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-15 | setup   | —       | Stage 2b lands: gate + brief hourly; act pipeline still later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |     |
| 2026-10-15 | code    | —       | Observe act wired. Propose still does not open a PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |     |
| 2026-10-15 | code    | —       | Propose opens a ready PR after postflight and check:affected. Ship does not merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |     |
| 2026-10-16 | code    | —       | Brief learns: findings for all ten God metrics, recent-action deprioritisation, and `regressionSuspect` derived from god-log history (brief job now stages history).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |     |
| 2026-10-17 | code    | —       | Money rails fixed: cadence and monthly spend now derive from `runs/*.json`, and the tick→branch merge moved out of the workflow heredoc into a tested `mergeGodLogTick`. The `cp`-before-merge order had rewritten `index/2026-10.json` to a single row every tick (52 run records, 1 index row), so `GOD_MAX_USD_PER_MONTH` and `GOD_EVERY_HOURS` would have read a one-run history the first time God spent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |     |
| 2026-10-17 | code    | —       | Idle God is now self-explanatory: each run record carries `reason` (an enum spanning the gate's and `decideAct`'s vocabularies, so no loose string can reach a prompt) and `digest` (the brief's five counts plus `sufficient`). Both are `.optional()` — a required field would have made `loadRunRecords` drop all 52 pre-existing records. `recordTick.test.mjs` scans both producers and fails on an unlisted reason literal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |
| 2026-10-17 | code    | —       | Stage 2c, read half: `GET /api/god/status` (`apps/server/src/god/godLogView.ts`, `routes/godStatus.ts`) serves the month rollup to the owner. Credential-free because the repo and `god-log` are public; reports only what a tick recorded, never a recomputed gate decision (Actions variables are unreadable from the server, so recomputing would lie). The rollup row is now schema-pinned (`GodRollupRowSchema`, validated on write in `recordTick.mjs`) and carries the full `digest`; the view itself joined the frozen rails so God cannot edit the panel showing its own spend.                                                                                                                                                                                                                                                                                                                |     |
| 2026-10-17 | code    | —       | The observe contract now records **which** of its three outcomes happened (`narration`: `finding` / `waiting` / `dropped`), so an act that billed, completed and named nothing is no longer indistinguishable from one that correctly waited. Only a `completed` run owes the contract an answer — a crashed harness leaves the field absent rather than booking its cost against silence. `monthTotals` adds `unproductiveActs`/`unproductiveUsd`, **omitted rather than zeroed** when the month's acts predate the field (every month on the branch today, October included). While writing the test I asserted that `finalizeActRecord` drops the finding when a patch lands; it does not, and no doc claims it does — the belief was mine, corrected against the code.                                                                                                                              |     |
| 2026-10-17 | code    | —       | Live ingest was documented as shipped but there is no receiver: no route in `apps/server/src`, and the workflow passes neither `--ingest-url` nor `--ingest-secret-file`, so the client has always taken its unconfigured no-op branch. The client header claimed the server rejects stale timestamps and replayed sequence numbers — that contract exists nowhere, so it is now labelled the intended spec. Added `stats.misconfigured` (404, 405, 501) because best-effort delivery never throws: an owner who mints the secret and wires the flag would otherwise get green runs, zero events, and a counter that reads exactly like a network hiccup. The no-op test asserts the whole stats shape, so it caught the new field immediately.                                                                                                                                                         |     |
| 2026-10-18 | code    | —       | Synthetic probes, owner-approved: production carries about ten signals a day against a floor of 30, and the repo-signal alternative measured empty too (1 real CI failure in 100 runs; bench snapshots last touched in August). A gate `go` now runs `probe.mjs` first — the real server behind the meter proxy, two fixed prompts per slot, ≤ $0.25 taken from the tick's cap with the act's minimum held back. The run record keeps counts and spend (`probe`); `monthTotals` and `deriveCadence` count both, because a probe that named nothing would otherwise leave God due again every hour of the window. The brief pools seven days into `probes` and names slots that miss an absolute target (`source: probe`, half severity, never `regressionSuspect`). Smoke-tested locally against a fake upstream: server boots on the proxy token, spend meters, `agent_turn` lines come back per slot. |     |
| 2026-10-18 | code    | —       | Wallet moved to **`OPENROUTER_GOD_KEY`** (#819, ADR-0019 §5 amended): God's probe/act/spike bill a dedicated OpenRouter key so the owner caps the autonomous rung at the gateway and an empty God wallet cannot drain `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY`. `scripts/god/upstream.mjs` owns path, auth, model-id rewrite, and balance reads per wallet; `--upstream deepseek` is the rollback. Meter proxy answers OpenRouter's missing `count_tokens`, binds spend on what the wallet reports, and disables thinking on the chat wire so probes match production Brain.                                                                                                                                                                                                                                                                                                                           |     |
| 2026-10-18 | code    | —       | Owner God window shipped (#811 + follow-ups): standalone `/god` (`apps/web/src/features/god/`), `GOD_WINDOW_TOKEN` gate, `GET /api/god/status` + `POST /api/god/unlock`. Pane mounts outside the ArchiSlop tree (`markAppReady`, no `installUxSignals`). Deploy trap documented: `god-window-token` must appear in both deploy secret lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |     |
| 2026-10-18 | code    | —       | Live ingest shipped: `POST /api/god/live` (HMAC `GOD_INGEST_SECRET`), ephemeral in-memory buffer, `GET /api/god/live/:runId` for the owner, `activeIngests` on status, Now-tab polling, `god.yml` passes `--ingest-url` when the `god` environment has the secret plus `GOD_INGEST_URL` or `PUBLIC_BASE_URL`. Cloud Run mount: `god-ingest-token` (both deploy secret lists).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |     |
| 2026-10-18 | docs    | —       | Owner God window guide: [`docs/guide/god-window.md`](../../guide/god-window.md) (`/god`, unlock, Now/History/Signals/Settings, status + live APIs, production setup). Linked from archislop-god, ADR-0019, api-endpoints, configuration, README, playbook, gcp.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |

## Open observations

- **No scheduled tick has ever acted, and the reason is measured, not suspected.** Every hourly tick
  is `noop`. Inside the 06-12 UTC window the gate goes `go=true reason=go`; the live brief builds (no
  fixture fallback) on 2 agent turns and 3 ux signals against a floor of 30 new signals
  (`GOD_HARD_LIMITS.minNewSignals`), so the act decision returns `insufficient`. A per-slot finding
  needs 20 turns of one slot (`MIN_SAMPLE_FOR_FINDING`) on top of that. Nothing is broken: the rails
  work and the tank is empty. Traffic is the only thing that unblocks this, and lowering the floor is
  a documented owner decision rather than a bug fix. **2026-10-18:** the owner chose synthetic probes
  over lowering the floor; the first week of probe runs is what will show whether they name anything.
- **Correction, same day: no _scheduled_ tick has ever acted, but one tick did act.** Re-reading the
  whole branch (not the last 25 records) found `38759172829`: `trigger: manual`, `tier: observe`,
  harness `dsh 0.2.0-rc.2`, 16 s, **$0.018813**, `verdict: observed`, and `findingId` and `hypothesis`
  both null. So October is 54 records — 53 `noop` plus that one act. Two things follow: the rung can
  reach the harness when the owner dispatches it, and the one time it did, it billed and completed
  without naming a finding. The observe narration contract accepted nothing, and nothing downstream
  noticed. That gap is the next candidate, not the signal floor.
- **The month rollup's lost rows are no longer harmless, and are now repaired at read time.**
  `index/2026-10.json` still carries one row while `runs/` holds 54 records, and the owner status view
  reads that file. The fold therefore stamps the true month totals (`ticks`, `acts`, `monthSpendUsd`,
  `lastActAt`) onto it from the records, and the view reports `numbersFrom: records` — so a truncated
  month can no longer be presented as a small one, including its spend.
- Ship (`gh pr merge --auto`) is still later. Propose stops at an open PR.
- Live-ingest HMAC must be minted and mirrored (Cloud Run `god-ingest-token` + `god` Actions `GOD_INGEST_SECRET`); until then ingest stays disabled. Settings/PR GitHub App not created yet.

## Remaining work

Ordered by what is unblocked. Checked against the tree on 2026-10-18.

### 1. Owner God window — **shipped** (#811, 2026-10-18)

Standalone `/god` with Now / History / Signals tabs (Settings placeholders until item 2). Operator map:
[`docs/guide/archislop-god.md`](../../guide/archislop-god.md), [`docs/deploy/gcp.md`](../../deploy/gcp.md)
§ God window owner token, [`docs/guide/api-endpoints.md`](../../guide/api-endpoints.md). Mounting,
signal, and deploy invariants are in the run-log rows above — not repeated here.

### 2. Settings tab (blocked on a credential, not on code)

Writing `GOD_*` repository variables needs the narrow Actions token with no contents permission, which
does not exist yet. The Settings tab now shows the **code defaults** and **hard limits** from
`godBudget.ts` (read-only, no inputs) plus the note that live values live in Actions variables the
server cannot read. Until the token exists, the tier and gate reason on **Now** remain the honest
record of what the last tick actually used.

### 3. Live ingest — **shipped** (needs operator wiring)

`POST /api/god/live` (HMAC) and `GET /api/god/live/:runId` (owner cookie) ship in
`apps/server/src/routes/godLive.ts` with verification in `packages/shared/src/godIngest.ts`. `god.yml`
passes `--ingest-url` / `--ingest-secret-file` when `GOD_INGEST_SECRET` and a public base URL are set.
Until Cloud Run and the `god` environment share that secret, ingest stays a no-op and `stats.misconfigured`
may still increment on misconfigured URLs.

### 4. Ship tier (owner decision plus one credential)

Propose stops at an open PR. `ship` is a playbook change plus the token that lets a God-opened PR
actually run the six required checks — the default `GITHUB_TOKEN` opens a PR that starts none of them.
The merge-policy toggle is designed; it is deliberately unreachable until the rung has opened a PR
worth merging.

### 5. Not blocked on any of the above

- **Traffic.** The act rung stops at `insufficient`: about 5 events a day against a floor of 30, with
  a per-slot finding needing 20 turns of one slot. No code here changes that, and lowering the floor is
  a documented owner decision rather than a fix.
- **`monthTotals` cannot judge history.** Acts recorded before `narration` make a month unjudgeable
  rather than clean, so October 2026 stays unreported forever. Deliberate.
- **`decideGodRun` still has no server consumer.** The status view deliberately does not call it; it
  reports what a tick recorded. If a future owner view ever wants "what would happen right now?", that
  needs the Actions token from item 2 first, because recomputing without it would print a confident
  answer about a configuration the process cannot see.
- **The reason drift sensor covers two producers** (`actDecision.mjs`, `godBudget.ts`). A third place
  that emits a stop reason would not be scanned, and its reason would silently fail to record.
- **Local tree, not God:** `verify:deps` and two server tests fail on this machine from installed
  packages that disagree with the lockfile pins (`@a2ui/web_core`, `@ag-ui/core` missing its
  `./schemas` export). Proven pre-existing by stashing. CI installs from the lockfile, so its six
  checks are the authority.
