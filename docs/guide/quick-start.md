# Quick start (local)

1. `npm run setup` then `cp .env.example .env` and set at least one LLM backend: `DEEPSEEK_API_KEY` (local default when set), `OPENROUTER_API_KEY`, or Vertex vars (`VERTEX_PROJECT_ID` / ADC).
2. `npm run dev` — API on `http://localhost:4000` (`PORT`), Vite UI on `http://localhost:5173` (`VITE_API_BASE_URL` must point at the API). **VS Code/Cursor:** copy [`.vscode/launch.example.json`](../../.vscode/launch.example.json) to `.vscode/launch.json` (gitignored) and use **Archislop: Dev (server + web)** — do not debug `src/index.js` with `tsx` (the API will not bind to `:4000`).
3. Open the UI, edit in Monaco, use **Go** in the prompt bar. Switch modes (**Diagram**, **Infographic**, **3D**, **Chart**, **Anything**) from the AI corner controls; each mode keeps its own source slot (Chart and Anything revert to Mermaid on reload).
4. **Invite agent** (toolbar) copies an MCP URL + pairing code for Cursor / VS Code / Claude Desktop — see [External agents (MCP)](external-agents.md).
5. `curl http://localhost:4000/api/health` — `llmConfigured: true` means intent/transform/analyze will run; the canvas still works when false.

Full setup and environment variables: [Configuration](configuration.md).
