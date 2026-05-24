# Modularity reviews

The semantic counterpart to the static sensors. Uses Vlad Khononov's [Balanced Coupling Model](https://coupling.dev) to surface coupling imbalances that linting and dependency-cruiser miss: hidden duplication, distributed-monolith risks, hub modules, parameter-handling smells, misplaced responsibilities.

Run a modularity review when you finish a feature, before splitting a monolith file (ADR-0005), or any time `npm run verify:boundaries` is clean but something still *feels* tangled.

## Claude Code

Install the plugin once per machine:

```
/plugin marketplace add vladikk/modularity
/plugin install modularity@vladikk-modularity
```

Then in any session:

```
/modularity:review
```

Point it at a specific file or directory in the prompt — e.g., "review modularity of `apps/server/src/mcp/mcpServer.js`". The skill will load the Balanced Coupling Model and produce a structured review (strength × distance × volatility per coupling).

## Cursor

Cursor cannot install the plugin natively. The skill markdown is mirrored into [`.cursor/skills/modularity/`](../../.cursor/skills/modularity/) so Cursor agents read the same methodology:

- [`.cursor/skills/modularity/balanced-coupling/SKILL.md`](../../.cursor/skills/modularity/balanced-coupling/SKILL.md) — the model itself
- [`.cursor/skills/modularity/review/SKILL.md`](../../.cursor/skills/modularity/review/SKILL.md) — review prompt
- [`.cursor/skills/modularity/design/SKILL.md`](../../.cursor/skills/modularity/design/SKILL.md) — design prompt
- [`.cursor/skills/modularity/document/SKILL.md`](../../.cursor/skills/modularity/document/SKILL.md) — documentation prompt

Ask Cursor to "follow `.cursor/skills/modularity/review/SKILL.md` and review `<file>`".

## Refreshing the mirror

When the plugin updates upstream:

```
npm run sync:modularity
```

Resolves the source in this order:

1. `$MODULARITY_PLUGIN_PATH` if set
2. `~/.claude/plugins/marketplaces/vladikk-modularity` (Claude Code install location)
3. Fallback: shallow `git clone` of `https://github.com/vladikk/modularity.git`

Then copies `skills/*` into `.cursor/skills/modularity/`. Commit the result.

## Where modularity hits in archislop

The most-leveraged targets today:

- `apps/web/src/state/diagramStore.js` — central state hub (ADR-0005)
- `apps/server/src/mcp/mcpServer.js` — MCP tool registration (ADR-0005)
- `apps/web/src/App.jsx` and `InsightsPane.jsx` — UI monoliths
- The `Mermaid` and `Infographic` agent pair (`apps/server/src/agents/`) — symmetric design opportunity per ADR-0001

For ADR conflicts surfaced by a review, see [`docs/agents/domain.md`](domain.md).
