# Recipes

Step-by-step playbooks for recurring changes. Each recipe names the files to touch and the order to touch them in. The point is to keep you from rediscovering the pattern every time.

| Recipe                                                 | When to use                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [add-mcp-tool.md](add-mcp-tool.md)                     | Exposing a new tool to external agents (Cursor/Claude/VS Code) over MCP                        |
| [add-rule-pack.md](add-rule-pack.md)                   | Adding a new Mermaid or Infographic diagram-type rule pack                                     |
| [add-intent-variant.md](add-intent-variant.md)         | Adding a new transform mode (like Refine / Innovate / Go Mad)                                  |
| [add-agent-stream-event.md](add-agent-stream-event.md) | Wiring a new AG-UI custom event through emitter → route → web handler                          |
| [add-session-event.md](add-session-event.md)           | Adding a new collaboration event (presence/proposal/handshake-style) on the session-events SSE |

If a recipe is missing for something you find yourself doing twice, write one — the format is loose: 5–10 numbered steps, each naming the file and what changes.
