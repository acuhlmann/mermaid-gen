# Quick start (local)

1. Use **Node.js 26+** (see [`.nvmrc`](../../.nvmrc); CI and Docker follow the same pin). `npm run setup` then `cp .env.example .env` and set at least one LLM backend: `DEEPSEEK_API_KEY` (local default when set), `OPENROUTER_API_KEY`, or Vertex vars (`VERTEX_PROJECT_ID` / ADC). On Windows, keep LF line endings ([`.gitattributes`](../../.gitattributes)); see [sensors — Line endings](../agents/sensors.md#line-endings-windows--linux) if Prettier fails on CRLF.
2. `npm run dev` — API on `http://localhost:4000` (`PORT`), Vite UI on `http://localhost:5173` (`VITE_API_BASE_URL` must point at the API). **VS Code/Cursor:** copy [`.vscode/launch.example.json`](../../.vscode/launch.example.json) → `.vscode/launch.json` (gitignored) and optionally [`.vscode/settings.example.json`](../../.vscode/settings.example.json) → `.vscode/settings.json`; then use **Archislop: Dev (server + web)**. See [`.vscode/README.md`](../../.vscode/README.md).
3. Open the UI, edit in Monaco, use **Go** in the prompt bar. Switch modes (**Auto**, **Diagram**, **Infographic**, **3D**, **Chart**, **Forms**, **Anything**) from the AI corner controls; each mode keeps its own server slot. The mode picker persists across reloads (`archislop:content-mode`); slot source survives reload while the server session is still alive (Anything HTML is not written to the client cache).
4. **Invite agent** (toolbar) copies an MCP URL + pairing code for Cursor / VS Code / Claude Desktop — see [External agents (MCP)](external-agents.md).
5. `curl http://localhost:4000/api/health` — `llmConfigured: true` means intent/transform/analyze will run; the canvas still works when false.

Full setup and environment variables: [Configuration](configuration.md).
