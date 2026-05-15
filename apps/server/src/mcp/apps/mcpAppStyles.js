/** Shared inline CSS for ArchiSlop MCP Apps (sandboxed iframes). */
export const MCP_APP_BASE_CSS = `
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.45;
  --bg: #0f1419;
  --panel: #1a2332;
  --border: #2d3a4f;
  --text: #e8edf4;
  --muted: #8b9cb3;
  --accent: #3b82f6;
  --danger: #ef4444;
  --success: #22c55e;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #f8fafc;
    --panel: #ffffff;
    --border: #e2e8f0;
    --text: #0f172a;
    --muted: #64748b;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 12px;
  background: var(--bg);
  color: var(--text);
}
h1, h2, h3 { margin: 0 0 8px; font-size: 1rem; font-weight: 600; }
.muted { color: var(--muted); font-size: 0.85rem; }
.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
button {
  font: inherit;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--border);
  padding: 6px 12px;
  background: var(--panel);
  color: var(--text);
}
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.danger { background: var(--danger); border-color: var(--danger); color: #fff; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
pre, code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
pre {
  margin: 0;
  padding: 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
  overflow: auto;
  max-height: 200px;
  white-space: pre-wrap;
  word-break: break-word;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid var(--border);
}
.status-ok { color: var(--success); }
.status-err { color: var(--danger); }
.diff-add { background: rgba(34, 197, 94, 0.15); }
.diff-del { background: rgba(239, 68, 68, 0.15); }
ul { margin: 0; padding-left: 1.2rem; }
li { margin: 4px 0; }
`;

export const MCP_APP_ESM_IMPORT =
  'import { App } from "https://esm.sh/@modelcontextprotocol/ext-apps@1.7.1";';

export const MCP_APP_CSP_CONNECT = ['https://esm.sh', 'https://cdn.jsdelivr.net'];
export const MCP_APP_CSP_RESOURCES = ['https://cdn.jsdelivr.net', 'https://esm.sh'];
