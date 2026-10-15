# Anonymous usage signals

ArchiSlop records a small set of anonymous usage signals so it can improve itself: a scheduled
agent, ArchiSlop God ([ADR-0019](../decisions/0019-archislop-god.md)), reads them in aggregate and
proposes fixes as pull requests. For how that loop fits together (diagrams and what is shipped
today), see **[ArchiSlop God](archislop-god.md)**. This page lists **everything** a signal can contain.

## What is never collected

- What you type: prompts, diagram source, critique text, file names.
- What identifies you: no session id, user id, name, IP address or user agent is stored with a
  signal, and the server writes nothing about the request itself.
- Error messages or stack traces: an error is recorded as its type only (`TypeError`, …), because
  messages can quote your content.

Every signal is checked against a strict schema
([`packages/shared/src/uxSignals.ts`](../../packages/shared/src/uxSignals.ts)) both in the browser
and on the server. A field that is not on the list below, or any free text, makes the signal invalid
and it is dropped.

## What a signal can contain

| Signal                    | Recorded when                                   | Fields                                                    |
| ------------------------- | ----------------------------------------------- | --------------------------------------------------------- |
| `retry`                   | You retry a failed run                          | mode, failure type                                        |
| `restore`                 | You restore an earlier result                   | mode, how many entries back                               |
| `autofix`                 | Automatic syntax repair starts or fails         | mode, repair path, started/failed                         |
| `critique_fix`            | You apply critique suggestions                  | mode, all/selected, how many                              |
| `mode_switch`             | You switch deliverable format                   | from mode, to mode                                        |
| `run_failed`              | An agent run fails                              | mode, failure type, Fast/Quality                          |
| `run_cancelled`           | An agent run is cancelled                       | mode, how long it had run (bucketed)                      |
| `run_stop`                | You press Stop                                  | mode                                                      |
| `manual_edit_after_agent` | You edit the source after an agent's result     | mode, how soon after (bucketed)                           |
| `client_error`            | The page hits an uncaught error                 | where it was caught, error type                           |
| `session_summary`         | You leave the page                              | session length (bucketed), runs, accepted, failed (≤1000) |
| `render_repair`           | The server repairs a render error (server-side) | mode, outcome                                             |
| `graph_edit`              | You edit on the canvas (server-side)            | mode, whether the last change came from an agent          |

The server also records one line per agent run (`agent_turn`): mode, model, duration, whether the
result was accepted, repair attempts and an error class.

## Where it goes and for how long

Signals are written as log lines to Google Cloud Logging for the production service and kept for
the bucket's retention period (30 days by default). ArchiSlop God reads them only as counts and
rates over a time window. The repository is public, so those aggregates can appear in public run
logs and pull requests — another reason no individual content is ever collected.

## Turning it off

**Settings → Share anonymous usage.** Turning it off stops collection immediately and discards
anything not yet sent. If your browser sends Global Privacy Control, collection is off until you
turn it on. Operators can stop all usage signals server-side with `UX_SIGNALS=0`
([configuration](configuration.md)).
