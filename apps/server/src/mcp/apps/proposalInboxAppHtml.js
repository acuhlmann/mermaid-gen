import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT, MCP_APP_PREVIEW_BOX_CSS } from './mcpAppDiagramPreview.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';

export const proposalInboxAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — My proposals</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_PREVIEW_BOX_CSS}${MCP_APP_SHELL_CSS}
.proposal { border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin: 8px 0; background: var(--panel); }
.proposal.pending { border-color: var(--accent); }
.proposal.accepted { border-color: var(--success); }
.proposal.rejected, .proposal.stale { border-color: var(--danger); opacity: 0.85; }
.status-tag { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.thumb { max-height: 120px; margin-top: 6px; }
.thumb svg { max-width: 100%; height: auto; }
.feedback { margin-top: 6px; padding: 6px 8px; background: rgba(234,179,8,0.12); border-radius: 6px; font-size: 12px; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>My proposals</h1>
  <p class="muted">Diagram edits you submitted in this session (newest first).</p>
  <div class="row" style="margin-bottom:8px">
    <button type="button" id="refresh">Refresh</button>
    <button type="button" id="open-web">Open ArchiSlop</button>
  </div>
  <div id="list"><p class="muted">Loading…</p></div>
  <p class="muted" id="hint">Revise with <code>get_session_state</code> then <code>propose_diagram_edit</code>.</p>
  <p class="muted" id="status"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}
${MCP_APP_SESSION_BRIDGE_SCRIPT}
${MCP_APP_DIAGRAM_PREVIEW_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

const els = { list: document.getElementById("list"), status: document.getElementById("status") };
let webCanvasUrl = null;
let bridge = null;

async function renderThumb(container, contentType, source) {
  container.innerHTML = "";
  if (!source?.trim()) return;
  const box = document.createElement("div");
  box.className = "thumb preview-box";
  container.appendChild(box);
  if (contentType === "mermaid") await renderMermaidPreview(box, source.slice(0, 4000));
  else renderInfographicPreview(box, source.slice(0, 4000));
}

async function waitForProposal(proposalId, btn) {
  if (!proposalId) return;
  btn.disabled = true;
  btn.textContent = "Waiting…";
  els.status.textContent = "Waiting for human review (up to ~50s)…";
  try {
    const result = await app.callServerTool({
      name: "wait_for_resolution",
      arguments: { proposalId, timeoutMs: 50000 },
    });
    const body = parsePayload(result);
    els.status.textContent = "Outcome: " + (body?.status ?? "unknown");
    await refresh();
  } catch (e) {
    els.status.textContent = "Wait failed: " + (e?.message ?? String(e));
  } finally {
    btn.disabled = false;
    btn.textContent = "Wait for resolution";
  }
}

async function renderList(data) {
  webCanvasUrl = data?.webCanvasUrl ?? webCanvasUrl;
  const items = data?.proposals ?? [];
  if (!items.length) {
    els.list.innerHTML = '<p class="muted">No proposals from you yet.</p>';
    return;
  }
  els.list.innerHTML = "";
  for (const p of items) {
    const card = document.createElement("article");
    card.className = "proposal " + esc(p.status || "pending");
    const changes = p.changesRequested?.comment;
    const waitBtn = p.status === "pending"
      ? '<button type="button" class="primary wait-btn" data-id="' + esc(p.proposalId) + '">Wait for resolution</button>'
      : "";
    card.innerHTML =
      '<div class="row"><strong>' + esc(p.contentType) + '</strong>' +
      ' <span class="status-tag">' + esc(p.status) + '</span>' +
      ' <code>' + esc((p.proposalId || "").slice(0, 8)) + '</code></div>' +
      '<p class="muted">' + esc(p.reason || "") + '</p>' +
      (changes ? '<p class="feedback"><strong>Changes requested:</strong> ' + esc(changes) + '</p>' : '') +
      '<div class="row" style="margin-top:6px">' + waitBtn + '</div>' +
      '<div class="thumb-host"></div>';
    els.list.appendChild(card);
    const host = card.querySelector(".thumb-host");
    await renderThumb(host, p.contentType, p.diagramSource);
    const wait = card.querySelector(".wait-btn");
    if (wait) wait.addEventListener("click", () => waitForProposal(p.proposalId, wait));
  }
}

async function refresh() {
  els.status.textContent = "Refreshing…";
  try {
    const result = await app.callServerTool({ name: "get_my_proposals", arguments: { includeResolved: true, limit: 20 } });
    await renderList(parsePayload(result));
    els.status.textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Proposal Inbox", version: "1.1.0" });
wireAppNav("inbox");
app.ontoolresult = (result) => renderList(parsePayload(result));
document.getElementById("refresh").addEventListener("click", () => refresh());
document.getElementById("open-web").addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
app.connect().then(async () => {
  await refresh();
  bridge = createSessionEventBridge({
    onEvent: (e) => {
      if (["proposal_resolved", "proposal_changes_requested", "proposal_received"].includes(e.type)) refresh();
    },
  });
  await bridge.start();
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
