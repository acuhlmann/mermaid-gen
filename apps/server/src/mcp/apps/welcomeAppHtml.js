import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';

export const welcomeAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Welcome</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}
.step { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; }
.step-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--border);
}
.step.done .step-num { background: var(--success); color: #fff; }
.step.active .step-num { background: var(--accent); color: #fff; }
.step-body { flex: 1; }
code.rev { font-size: 11px; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Welcome to ArchiSlop</h1>
  <p class="muted" id="message">Loading…</p>
  <div class="panel" id="steps"></div>
  <p class="row">
    <button type="button" class="primary" id="next-action">Next step</button>
    <button type="button" id="open-events">Live events</button>
    <button type="button" id="open-web">Open web canvas</button>
  </p>
  <p class="muted">Prompt: <code>archislop_collaboration_guide</code></p>
  <p class="muted" id="status"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

let boot = null;
let webCanvasUrl = null;

function renderSteps(data) {
  const stepsEl = document.getElementById("steps");
  const bound = data?.bound;
  const registered = data?.agentRegistered;
  const handshake = data?.handshakeStatus;
  const rev = data?.revisions ?? {};
  const steps = [
    {
      id: "bind",
      label: bound ? "Room bound · " + esc(data.sessionId?.slice(0, 12) + "…") : "Bind room with pairing code",
      detail: bound ? "Code: " + esc(data.pairingCode) : "Call join_session or open session pairing",
      done: bound,
    },
    {
      id: "register",
      label: registered ? "Agent registered · " + esc(data.agentName) : "Register and get approved",
      detail: handshake === "pending" ? "Handshake pending approval" : "Call register_agent",
      done: registered,
      active: bound && !registered,
    },
    {
      id: "canvas",
      label: "Preview canvas",
      detail: "Mermaid rev <code class='rev'>" + esc(rev.mermaid) + "</code> · Infographic rev <code class='rev'>" + esc(rev.infographic) + "</code> · 3D rev <code class='rev'>" + esc(rev.metaphor3d ?? 0) + "</code> · Chart rev <code class='rev'>" + esc(rev.chart ?? 0) + "</code>",
      done: registered,
      active: registered,
    },
    {
      id: "collab",
      label: "Collaborate",
      detail: "get_session_state → propose_diagram_edit · drop_insight · set_focus",
      done: registered,
      active: registered,
    },
  ];
  stepsEl.innerHTML = steps.map((s) => {
    const cls = ["step", s.done ? "done" : "", s.active && !s.done ? "active" : ""].filter(Boolean).join(" ");
    return '<div class="' + cls + '">' +
      '<span class="step-num">' + (s.done ? "✓" : "") + '</span>' +
      '<div class="step-body"><strong>' + s.label + '</strong><p class="muted">' + s.detail + '</p></div></div>';
  }).join("");
}

function nextAction() {
  if (!boot?.bound) return openMcpTool("open_session_pairing");
  if (!boot?.agentRegistered) return openMcpTool("register_agent", { name: "External agent", wait: false });
  return openMcpTool("open_diagram_canvas");
}

async function refresh() {
  document.getElementById("status").textContent = "Refreshing…";
  try {
    const result = await app.callServerTool({ name: "get_session_bootstrap", arguments: {} });
    boot = parsePayload(result);
    webCanvasUrl = boot?.webCanvasUrl ?? webCanvasUrl;
    document.getElementById("message").textContent = boot?.message ?? "";
    renderSteps(boot);
    document.getElementById("status").textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (e) {
    document.getElementById("status").textContent = "Failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Welcome", version: "1.0.0" });
wireAppNav("welcome");
document.getElementById("next-action").addEventListener("click", () => nextAction());
document.getElementById("open-events").addEventListener("click", () => openMcpTool("open_session_events"));
document.getElementById("open-web").addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
app.ontoolresult = (result) => {
  const data = parsePayload(result);
  if (data?.sessionId || data?.bound !== undefined) {
    boot = data;
    renderSteps(data);
  }
};
app.connect().then(() => refresh());
setInterval(refresh, 12000);
  </script>
</body>
</html>`;
