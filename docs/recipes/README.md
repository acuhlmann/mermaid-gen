# Recipes

Step-by-step playbooks for recurring changes. Each recipe names the files to touch and the order to touch them in. The point is to keep you from rediscovering the pattern every time.

| Recipe                                                 | When to use                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [add-content-type-slot.md](add-content-type-slot.md)   | Adding a new diagram slot (`contentType`) end-to-end                                                   |
| [add-mcp-tool.md](add-mcp-tool.md)                     | Exposing a new tool to external agents (Cursor/Claude/VS Code) over MCP                                |
| [add-rule-pack.md](add-rule-pack.md)                   | Adding a new Mermaid or Infographic diagram-type rule pack                                             |
| [add-intent-variant.md](add-intent-variant.md)         | Adding a new transform mode (like Gilfoyle / Dinesh / Erlich / Russ / Barker)                          |
| [add-agent-stream-event.md](add-agent-stream-event.md) | Wiring a new AG-UI custom event through emitter → route → web handler                                  |
| [add-session-event.md](add-session-event.md)           | Adding a new collaboration event (presence/proposal/handshake-style) on the session-events SSE         |
| [change-diagram-schema.md](change-diagram-schema.md)   | Changing Zod session/diagram/patch shapes in `packages/shared`                                         |
| [add-eslint-rule.md](add-eslint-rule.md)               | Adding a new ESLint rule with agent-readable guidance                                                  |
| [add-dep-cruiser-layer.md](add-dep-cruiser-layer.md)   | Adding a new dependency-cruiser layer/boundary rule                                                    |
| [convert-js-leaf-to-ts.md](convert-js-leaf-to-ts.md)   | Converting a small `.js` module to `.ts` and adding it to a strict island (ADR-0006 ratchet)           |
| [add-anything-lib.md](add-anything-lib.md)             | Adding (or version-bumping) a library in the Anything-mode `@lib:` allowlist (ADR-0008)                |
| [replicate-tv-character.md](replicate-tv-character.md) | Replicating a named TV character as an office cast member (Silicon Valley program — status + playbook) |

If a recipe is missing for something you find yourself doing twice, write one — the format is loose: 5–10 numbered steps, each naming the file and what changes.
