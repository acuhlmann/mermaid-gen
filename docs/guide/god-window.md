# God window — owner panel at `/god`

The **God window** is a standalone owner-only page that answers: _Is God running, what did it last
do, what did it cost, and why did it stop?_ It does **not** sit inside the office floor or the main
ArchiSlop session chrome — that isolation is deliberate ([ADR-0019](../decisions/0019-archislop-god.md)
§10, ledger § owner window).

| If you want…                          | Read                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| Signals, workflow, `god-log`          | [ArchiSlop God](archislop-god.md)                                      |
| Env vars (`GOD_WINDOW_TOKEN`, ingest) | [Configuration](configuration.md)                                      |
| REST contract                         | [API endpoints](api-endpoints.md) (`/api/god/*`)                       |
| Deploy / Secret Manager               | [GCP deploy](../deploy/gcp.md) (God window token + live-ingest secret) |

## URL and access model

| Surface           | Path                                              | Who                                                             |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| **UI**            | `/god`                                            | Owner with the window token                                     |
| **Unlock**        | `POST /api/god/unlock`                            | Body `{ "token": "<GOD_WINDOW_TOKEN>" }` → sets HttpOnly cookie |
| **Data**          | `GET /api/god/status`, `GET /api/god/live/:runId` | Same cookie (12 h, `Path=/api/god`)                             |
| **Runner ingest** | `POST /api/god/live`                              | HMAC only (`GOD_INGEST_SECRET`) — not the owner cookie          |

**Not the visitor badge.** The site door code (`VISITOR_BADGE_SECRETS`) does not open spend or
cadence figures. `GOD_WINDOW_TOKEN` fails closed: if it is unset on the server, every `/api/god/*`
route answers **`503`** and the UI shows that the window is not configured.

**Unlock flow:** open `/god`, paste the owner token once, submit. The server rate-limits unlock
attempts per IP (10 / 15 min). Wrong tokens never reveal whether the deployment is configured.

Code: `apps/web/src/features/god/` (`GodWindow.jsx`, `godWindowClient.js`, `godRoute.js`),
`apps/server/src/middleware/godWindowGate.js`.

## Tabs (what each one shows)

All tabs read from **`GET /api/god/status`** except the live harness strip on **Now**, which also polls
**`GET /api/god/live/:runId`**.

### Now

- **This month** — `ticks`, `acts`, `monthSpendUsd`, `lastActAt` (from stamped month totals when
  `numbersFrom` is `records`).
- **Live run** (when ingest is wired) — if `activeIngests` lists a run with recent harness POSTs,
  the pane polls live events every ~2.5 s. Content is sanitized harness lines (tool names, paths,
  status text) — never user prompts. The buffer is **ephemeral** (per Cloud Run instance); after the
  run, **`god-log`** remains the durable record.
- **Most recent tick** — `lastTick`: verdict, tier, gate reason, spend, narration outcome
  (`finding` / `waiting` / `dropped`), brief digest counts when present.

### History

- Recent rows from the month rollup, with a banner when `numbersFrom` is `rollupRows` (under-count
  risk) vs `records`.
- **Skip reasons** tally and **unproductive** act counts when the month records them.

### Signals

- The **brief digest** on the last tick: agent turns, usage signals, sessions, findings, whether the
  tick cleared the signal floor (`sufficient`). Explains “below floor” no-ops without opening CI.

### Settings

- **Code defaults table** — `GOD_CONFIG_DEFAULTS` / `GOD_CONFIG_VARIABLES` from shared (what Actions
  variables mean when unset), plus hard limits from `GOD_HARD_LIMITS`. This is not a live read of
  GitHub repository variables.
- **Writes not wired** — changing tier, window, or caps still requires the narrow Actions token (not
  created yet). Per-tick **tier** and **gate reason** on Now/History remain the honest “what ran” view.

## `GET /api/god/status` fields (owner view)

| Field                                                | Meaning                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `source`                                             | `live` / `stale` / `none` — whether the `god-log` rollup read succeeded                  |
| `numbersFrom`                                        | `records` (month totals from run files) or `rollupRows` (surviving rollup only)          |
| `lastTick`, `months`, `repo`, `branch`               | Rollup identity and latest tick row                                                      |
| `reasonTally`, `unproductiveActs`, `unproductiveUsd` | Month-level “why skipped” and wasted acts                                                |
| `activeIngests`                                      | `[{ runId, updatedAt, lastSeq, eventCount }]` — runs with live ingest in the last 30 min |

`Cache-Control: no-store` on all `/api/god` responses.

## Enabling the window in production

1. Mint **`GOD_WINDOW_TOKEN`** (`openssl rand -hex 32`).
2. Store in Secret Manager as **`god-window-token`** and mount on Cloud Run as **`GOD_WINDOW_TOKEN`**
   (both deploy paths — see [`scripts/deploy-secret-lists.test.mjs`](../../scripts/deploy-secret-lists.test.mjs)).
3. Optional: **`GOD_WINDOW_COOKIE_SECRET`** for a dedicated cookie HMAC key; otherwise the key derives
   from the token.
4. Visit **`https://<your-host>/god`**, unlock, refresh.

For **live harness streaming** during an act job, also wire **`GOD_INGEST_SECRET`** — see
[ArchiSlop God § Live run streaming](archislop-god.md) and [GCP deploy § God's live-ingest secret](../deploy/gcp.md).

## Related tests

- `apps/web/test/godWindow.test.jsx`, `apps/web/test/godRoute.test.js`
- `apps/server/test/godWindowGate.test.js`, `apps/server/test/godStatusRoute.test.js`, `apps/server/test/godLiveRoute.test.js`
