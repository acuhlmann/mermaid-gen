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
- **Data branch:** `god-log` (orphan). Per-run JSON records; this ledger is for code-PR rows only.
- **Schedule:** `17 * * * *` UTC; gate window default `06-12` UTC. Off the night ladder on purpose.

## Baselines

Filled from the first sufficient brief after signals accumulate in `god-signals`.

## Run log

| Date (UTC) | Trigger | Verdict | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | PR  |
| ---------- | ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 2026-10-15 | setup   | —       | Stage 2b lands: gate + brief hourly; act pipeline still later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |     |
| 2026-10-15 | code    | —       | Observe act wired. Propose still does not open a PR.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |
| 2026-10-15 | code    | —       | Propose opens a ready PR after postflight and check:affected. Ship does not merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |     |
| 2026-10-16 | code    | —       | Brief learns: findings for all ten God metrics, recent-action deprioritisation, and `regressionSuspect` derived from god-log history (brief job now stages history).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |     |
| 2026-10-17 | code    | —       | Money rails fixed: cadence and monthly spend now derive from `runs/*.json`, and the tick→branch merge moved out of the workflow heredoc into a tested `mergeGodLogTick`. The `cp`-before-merge order had rewritten `index/2026-10.json` to a single row every tick (52 run records, 1 index row), so `GOD_MAX_USD_PER_MONTH` and `GOD_EVERY_HOURS` would have read a one-run history the first time God spent.                                                                                                                                                                                                                                                                                                                                                             |     |
| 2026-10-17 | code    | —       | Idle God is now self-explanatory: each run record carries `reason` (an enum spanning the gate's and `decideAct`'s vocabularies, so no loose string can reach a prompt) and `digest` (the brief's five counts plus `sufficient`). Both are `.optional()` — a required field would have made `loadRunRecords` drop all 52 pre-existing records. `recordTick.test.mjs` scans both producers and fails on an unlisted reason literal.                                                                                                                                                                                                                                                                                                                                          |     |
| 2026-10-17 | code    | —       | Stage 2c, read half: `GET /api/god/status` (`apps/server/src/god/godLogView.ts`, `routes/godStatus.ts`) serves the month rollup to the owner. Credential-free because the repo and `god-log` are public; reports only what a tick recorded, never a recomputed gate decision (Actions variables are unreadable from the server, so recomputing would lie). The rollup row is now schema-pinned (`GodRollupRowSchema`, validated on write in `recordTick.mjs`) and carries the full `digest`; the view itself joined the frozen rails so God cannot edit the panel showing its own spend.                                                                                                                                                                                   |     |
| 2026-10-17 | code    | —       | The observe contract now records **which** of its three outcomes happened (`narration`: `finding` / `waiting` / `dropped`), so an act that billed, completed and named nothing is no longer indistinguishable from one that correctly waited. Only a `completed` run owes the contract an answer — a crashed harness leaves the field absent rather than booking its cost against silence. `monthTotals` adds `unproductiveActs`/`unproductiveUsd`, **omitted rather than zeroed** when the month's acts predate the field (every month on the branch today, October included). While writing the test I asserted that `finalizeActRecord` drops the finding when a patch lands; it does not, and no doc claims it does — the belief was mine, corrected against the code. |     |
| 2026-10-17 | code    | —       | Live ingest was documented as shipped but there is no receiver: no route in `apps/server/src`, and the workflow passes neither `--ingest-url` nor `--ingest-secret-file`, so the client has always taken its unconfigured no-op branch. The client header claimed the server rejects stale timestamps and replayed sequence numbers — that contract exists nowhere, so it is now labelled the intended spec. Added `stats.misconfigured` (404, 405, 501) because best-effort delivery never throws: an owner who mints the secret and wires the flag would otherwise get green runs, zero events, and a counter that reads exactly like a network hiccup. The no-op test asserts the whole stats shape, so it caught the new field immediately.                            |     |

## Open observations

- **No scheduled tick has ever acted, and the reason is measured, not suspected.** Every hourly tick
  is `noop`. Inside the 06-12 UTC window the gate goes `go=true reason=go`; the live brief builds (no
  fixture fallback) on 2 agent turns and 3 ux signals against a floor of 30 new signals
  (`GOD_HARD_LIMITS.minNewSignals`), so the act decision returns `insufficient`. A per-slot finding
  needs 20 turns of one slot (`MIN_SAMPLE_FOR_FINDING`) on top of that. Nothing is broken: the rails
  work and the tank is empty. Traffic is the only thing that unblocks this, and lowering the floor is
  a documented owner decision rather than a bug fix.
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
- Live-ingest HMAC and GitHub App for settings/PR open are not created yet.

## Remaining work

Ordered by what is unblocked. Everything here was checked against the tree on 2026-10-17; the
file-and-symbol names below are real, not assumed.

### 1. The owner God window (unblocked, but needs one product decision first)

The data half is done: `GET /api/god/status` returns everything a Now or History tab would show, and
it is reachable without a new credential because the repo and the `god-log` branch are public. The
pane itself is what is missing.

**The open decision is where it mounts, and it is not a code question.** The obvious shell —
`apps/web/src/components/FloatingWindow.jsx` — is the _office_ window chrome: it is wired to
`state/overlayStack.js` (minimize and focus live there so the taskbar pill can restore a window), to
`utils/officeCast.js` for chrome copy, and to taskbar groups and snap points. A God pane put there
takes an office window slot and inherits the domain with the heaviest invariant docs in the repo
(`docs/agents/domains/office.md`, `docs/office-window-manager.md`). The realistic options:

- **A standalone owner route** (`/god`) outside the office floor: no overlay-stack entanglement, its
  own door-code page, no office cast or i18n bundle obligations. Cheapest to reason about.
- **The Desk OS tray or menu**: reuses the chrome the owner already reads, but it is office code and
  inherits office rules and locale bundles.
- **The existing settings surface**: a God group beside the usage-signals toggle in
  `features/shell/AppWorkspaceSlot.jsx`, which already owns the owner-facing switches. Small diff,
  but a run history in a settings panel is the wrong shape for a list that wants paging.

Recommendation: the standalone route. It keeps God out of the office domain, and the office rules say
do not add client observers — a separate route avoids touching the floor's getter contract entirely.

Facts for whoever builds it, so they do not re-derive them:

- The one exported thing a God client needs is `API_BASE_URL`, from `apps/web/src/state/diagramSession.ts`.
  There is no shared fetch helper to reuse: `jsonFetch` and `sessionUrl` are module-private to
  `apps/web/src/state/sessionEventsClient.js`, so the precedent to copy is that file (or
  `llmModelsByProfile.js`, which does a cached `api/health` read), not an import of it.
- `GET /api/god/status` fields: `source` (`live` / `stale` / `none`), `numbersFrom` (`records` or
  `rollupRows`), `ticks`, `acts`, `monthSpendUsd`, `unproductiveActs`, `unproductiveUsd`,
  `lastTick` (with `gateReason`, `digest`, `narration`), `lastActAt`, `lastActNarration`,
  `reasonTally`, `recent`, `issues`.
- **`null` is a value, not a gap.** `unproductiveActs` and `unproductiveUsd` are null when the month's
  acts predate `narration`. Render "not measured", never a dash that reads as zero — the whole point of
  those fields is that a zero would look like good news.
- `source: stale` means the last good numbers survived a failed refresh; `none` is the 503 path. Both
  need a visible stamp of `generatedAt` or the owner will read old numbers as current.
- `issues` codes are `rollup_unreadable`, `rollup_rows_dropped`, `rollup_totals_missing`,
  `fetch_failed`, `source_invalid`.
- Tests are vitest, colocated under `apps/web/test/`. Visible strings need the i18n treatment in
  `apps/web/src/i18n/` (see `deepMergeLocale.js` and `getUiLocaleBundle.js`).
- No new secret is needed for the read view, and the door-code gate already covers `/api/god/*`
  because `createVisitorBadgeGate` is mounted before every router in `loadServerApp.js`.

### 2. Settings tab (blocked on a credential, not on code)

Writing `GOD_*` repository variables needs the narrow Actions token with no contents permission, which
does not exist yet — so the Settings tab cannot ship read-only either, since the config values live in
Actions variables the server cannot read. Until the token exists, the honest Settings view is the
`GOD_DEFAULTS` table in the guide plus the recorded `reason` per tick, which already shows which
window and tier the gate actually used.

### 3. Live ingest (blocked on a route plus a secret)

`scripts/god/ingestClient.mjs` is finished and tested and has nothing to talk to: no
`POST /api/god/live` exists in `apps/server/src`, `god.yml` passes neither `--ingest-url` nor
`--ingest-secret-file`, and the HMAC secret was never created. `stats.misconfigured` now makes that
visible in the run report rather than silent. Building it means the route (signature check, stale
timestamp, replayed `seq`) and one `GOD_*` secret, and nothing in the runner changes.

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
