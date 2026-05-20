# Quick start (local)

1. `npm run setup` then `cp .env.example .env` and set at least `OPENROUTER_API_KEY` (or Vertex vars) for AI features.
2. `npm run dev` — API on `http://localhost:4000` (`PORT`), Vite UI on `http://localhost:5173` (`VITE_API_BASE_URL` must point at the API).
3. Open the UI, edit in Monaco, use **Go** in the prompt bar. Toggle **Diagram** vs **Infographic** in the toolbar; each mode keeps its own source slot.
4. **Invite agent** (toolbar) copies an MCP URL + pairing code for Cursor / VS Code / Claude Desktop — see [External agents (MCP)](external-agents.md).
5. `curl http://localhost:4000/api/health` — `llmConfigured: true` means intent/transform/analyze will run; the canvas still works when false.

Full setup and environment variables: [Configuration](configuration.md).
