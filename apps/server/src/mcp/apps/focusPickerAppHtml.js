import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT, MCP_APP_PREVIEW_BOX_CSS } from './mcpAppDiagramPreview.js';

export const focusPickerAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Focus picker</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}${MCP_APP_PREVIEW_BOX_CSS}
.node-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.node-list button { font-family: ui-monospace, monospace; font-size: 12px; }
.node-list button.focused { outline: 2px solid var(--accent); }
.presence-focus { font-size: 12px; color: var(--muted); margin: 6px 0; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Focus picker</h1>
  <p class="muted">Highlight a node on the shared canvas for humans and other agents.</p>
  <div class="tabs" id="slot-tabs">
    <button type="button" class="active" data-slot="mermaid">Mermaid</button>
    <button type="button" data-slot="infographic">Infographic</button>
  </div>
  <div id="preview-box" class="preview-box muted">Loading…</div>
  <p class="presence-focus" id="others-focus"></p>
  <h2>Nodes</h2>
  <div class="node-list" id="nodes"></div>
  <div class="row">
    <button type="button" id="clear-focus">Clear my focus</button>
    <button type="button" id="refresh">Refresh</button>
  </div>
  <p class="muted" id="status"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}
${MCP_APP_DIAGRAM_PREVIEW_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

function parseMermaidNodeIds(source) {
  const ids = new Set();
  const re = /(^|[^\\w])([A-Za-z][\\w-]*)\\s*(?:\\[|\\(|\\{|>|--)/gm;
  let m;
  while ((m = re.exec(source || "")) !== null) {
    const id = m[2];
    if (!["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "subgraph", "end", "style", "linkStyle", "click"].includes(id)) {
      ids.add(id);
    }
  }
  return [...ids].slice(0, 40);
}

function parseInfographicNodeIds(source) {
  const ids = new Set();
  for (const line of (source || "").split("\\n")) {
    const m = line.match(/^\\s*([A-Za-z][\\w-]*)\\s*:/);
    if (m) ids.add(m[1]);
  }
  return [...ids].slice(0, 40);
}

let activeSlot = "mermaid";
let myAgentId = null;
let currentSource = "";

const els = {
  preview: document.getElementById("preview-box"),
  nodes: document.getElementById("nodes"),
  othersFocus: document.getElementById("others-focus"),
  status: document.getElementById("status"),
};

document.querySelectorAll("#slot-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeSlot = btn.dataset.slot;
    document.querySelectorAll("#slot-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.slot === activeSlot);
    });
    load();
  });
});

async function setFocus(nodeId) {
  els.status.textContent = "Setting focus…";
  try {
    await app.callServerTool({
      name: "set_focus",
      arguments: { contentType: activeSlot, nodeId, label: nodeId },
    });
    els.status.textContent = "Focus: " + nodeId;
    renderNodeButtons(parseIds(currentSource));
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

async function clearFocus() {
  try {
    await app.callServerTool({
      name: "set_focus",
      arguments: { contentType: activeSlot, nodeId: null },
    });
    els.status.textContent = "Focus cleared";
    renderNodeButtons(parseIds(currentSource));
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

function parseIds(source) {
  return activeSlot === "mermaid" ? parseMermaidNodeIds(source) : parseInfographicNodeIds(source);
}

function renderNodeButtons(ids) {
  els.nodes.innerHTML = ids.length
    ? ids.map((id) => '<button type="button" data-node="' + esc(id) + '">' + esc(id) + '</button>').join("")
    : '<span class="muted">No nodes parsed — type an id in set_focus manually.</span>';
  els.nodes.querySelectorAll("[data-node]").forEach((btn) => {
    btn.addEventListener("click", () => setFocus(btn.getAttribute("data-node")));
  });
}

async function loadPresence() {
  try {
    const snap = parsePayload(await app.callServerTool({ name: "get_session_snapshot", arguments: {} }));
    const lines = (snap?.presence ?? [])
      .filter((a) => a.focus?.contentType === activeSlot && a.focus?.nodeId)
      .map((a) => esc((a.emoji || "🤖") + " " + (a.agentName || "Agent")) + " → " + esc(a.focus.nodeId));
    els.othersFocus.textContent = lines.length ? "Others focused: " + lines.join(" · ") : "";
  } catch { /* ignore */ }
}

async function load() {
  els.status.textContent = "Loading…";
  try {
    const state = parsePayload(await app.callServerTool({
      name: "get_session_state",
      arguments: { contentType: activeSlot },
    }));
    currentSource = state?.diagramSource ?? "";
    if (activeSlot === "mermaid") await renderMermaidPreview(els.preview, currentSource);
    else renderInfographicPreview(els.preview, currentSource);
    renderNodeButtons(parseIds(currentSource));
    await loadPresence();
    els.status.textContent = "Rev " + (state?.revisionId ?? "?");
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Focus Picker", version: "1.0.0" });
wireAppNav("canvas");
document.getElementById("clear-focus").addEventListener("click", () => clearFocus());
document.getElementById("refresh").addEventListener("click", () => load());
app.connect().then(() => load());
  </script>
</body>
</html>`;
