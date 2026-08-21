# Cursor automation: Anything mode (daily)

Use this checklist when creating or updating the Cursor automation at
[cursor.com/automations](https://cursor.com/automations).

## Settings

| Field              | Value                                      |
| ------------------ | ------------------------------------------ |
| **Name**           | Anything mode — daily improvement          |
| **Trigger**        | Scheduled                                  |
| **Cron**           | `0 1 * * *`                                |
| **Timezone**       | `Asia/Hong_Kong` (GMT+8) — 01:00 Hong Kong |
| **UTC equivalent** | `0 17 * * *` (previous calendar day)       |
| **Repository**     | `acuhlmann/mermaid-gen`                    |
| **Branch**         | `main`                                     |
| **PR creation**    | Enabled (merge when CI is green)           |

## Stagger

Do not collide with existing schedules:

| Job                                | Cron (UTC)   | Local (HKT)          |
| ---------------------------------- | ------------ | -------------------- |
| Existing Cursor feature automation | `0 0 * * *`  | 08:00                |
| NFR `resolve`                      | `0 3 * * *`  | 11:00                |
| NFR `review`                       | `0 6 * * *`  | 14:00                |
| NFR `improve`                      | `0 8 * * *`  | 16:00                |
| **This automation**                | `0 17 * * *` | **01:00** (next day) |
| Metaphor3D feature automation      | `0 20 * * *` | 04:00 (next day)     |

## Prompt

Paste exactly (from [`cursor-trigger-anything.txt`](cursor-trigger-anything.txt)):

```
Run the feature automation `anything`.
Read docs/automations/README.md (the contract), then docs/automations/anything.md (the playbook),
and follow them exactly. Those two files are authoritative; this message adds nothing to them.
```

## First run

1. Save and enable the automation.
2. Trigger a manual run once and watch the full cycle (preflight → slice → `npm run check` → PR).
3. Confirm the ledger row lands in `docs/automations/ledger/anything.md`.
