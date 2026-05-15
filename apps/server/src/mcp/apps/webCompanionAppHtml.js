import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT, MCP_APP_PREVIEW_BOX_CSS } from './mcpAppDiagramPreview.js';

/**
 * Hybrid workflow: human controls ArchiSlop in the browser; external agent runs in Cursor/MCP.
 * Read-only context panel — approvals happen in the web UI, not here.
 */
export const webCompanionAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Web companion</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}${MCP_APP_PREVIEW_BOX_CSS}
.hero { border: 1px solid var(--accent); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; background: rgba(59,130,246,0.1); }
.hero strong { display: block; margin-bottom: 4px; }
.cta-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.cta-row button.primary { font-size: 15px; padding: 8px 16px; }
.queue-item { border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin: 8px 0; }
.queue-item .meta { font-size: 12px; color: var(--muted); margin-top: 4px; }
.event { border-left: 3px solid var(--border); padding: 4px 8px; margin: 4px 0; font-size: 12px; }
.event.action { border-color: var(--accent); }
.event time { color: var(--muted); margin-right: 6px; }
.agent-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); margin: 2px 4px 2px 0; font-size: 12px; }
#feed { max-height: 200px; overflow: auto; }
.hidden { display: none !important; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Web companion</h1>
  <div class="hero" id="hero">
    <strong>You control this session in the browser</strong>
    <span class="muted">This panel is read-only context while an external agent works in Cursor. Approve joins and diagram edits in the ArchiSlop web app (handshake dialog + Insights proposal cards).</span>
  </div>
  <div class="cta-row">
    <button type="button" class="primary" id="open-web">Open ArchiSlop</button>
    <button type="button" id="open-canvas">Preview canvas</button>
    <button type="button" id="open-events">Live events</button>
  </div>

  <div id="focus-panel" class="panel hidden">
    <h2 id="focus-title">—</h2>
    <p id="focus-body" class="muted"></p>
    <p class="cta-row" id="focus-actions"></p>
    <div id="focus-preview" class="preview-box muted hidden"></div>
  </div>

  <div class="panel">
    <h2>Needs your attention in web</h2>
    <div id="queue"><p class="muted">Nothing pending.</p></div>
  </div>

  <div class="panel">
    <h2>Connected agents</h2>
    <div id="agents"><p class="muted">Loading…</p></div>
  </div>

  <div class="panel">
    <h2>Recent activity</h2>
    <div id="feed"><p class="muted">Waiting for events…</p></div>
  </div>

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

function openWeb() {
  if (!webCanvasUrl) return;
  app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
}

const els = {
  hero: document.getElementById("hero"),
  focusPanel: document.getElementById("focus-panel"),
  focusTitle: document.getElementById("focus-title"),
  focusBody: document.getElementById("focus-body"),
  focusActions: document.getElementById("focus-actions"),
  focusPreview: document.getElementById("focus-preview"),
  queue: document.getElementById("queue"),
  agents: document.getElementById("agents"),
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
};

let webCanvasUrl = null;
let bridge = null;
const events = [];
const maxEvents = 40;

function summarize(envelope) {
  const t = envelope.type;
  const p = envelope.payload ?? {};
  if (t === "proposal_received") return (p.origin?.agentName || "Agent") + " proposed a " + (p.contentType || "edit");
  if (t === "proposal_resolved") return "Proposal " + (p.status || "resolved");
  if (t === "handshake_request") return (p.proposedName || "Agent") + " wants to join";
  if (t === "handshake_resolved") return "Handshake " + (p.status || "");
  if (t === "state_changed") return "Diagram updated on canvas";
  if (t === "attributed_insight") return (p.origin?.agentName || "Someone") + " posted a " + (p.variant || "note");
  return t || "event";
}

function pushEvent(envelope) {
  events.unshift(envelope);
  if (events.length > maxEvents) events.length = maxEvents;
  renderFeed();
}

function renderFeed() {
  if (!events.length) {
    els.feed.innerHTML = '<p class="muted">Waiting for events…</p>';
    return;
  }
  els.feed.innerHTML = events.map((e) => {
    const ts = e.at ? new Date(e.at).toLocaleTimeString() : "";
    const needsAction = e.type === "handshake_request" || e.type === "proposal_received";
    return '<div class="event' + (needsAction ? " action" : "") + '">' +
      (ts ? '<time>' + esc(ts) + '</time>' : '') +
      esc(summarize(e)) +
      '</div>';
  }).join("");
}

function renderQueue(boot, snap) {
  const items = [];
  for (const h of boot?.pendingHandshakes ?? []) {
    items.push({
      kind: "handshake",
      title: (h.proposedEmoji || "🤖") + " " + (h.proposedName || "External agent"),
      detail: "Wants to join — approve in the web handshake dialog.",
    });
  }
  for (const p of snap?.proposals ?? []) {
    if (p.status && p.status !== "pending") continue;
    const diff = p.diffSummary;
    const diffLine = diff ? "+" + (diff.linesAdded ?? 0) + " / -" + (diff.linesRemoved ?? 0) + " lines" : "";
    items.push({
      kind: "proposal",
      title: (p.origin?.agentName || "Agent") + " — " + (p.contentType || "edit"),
      detail: (p.reason || "").slice(0, 120) + (diffLine ? " · " + diffLine : ""),
    });
  }
  if (!items.length) {
    els.queue.innerHTML = '<p class="muted">Nothing pending — you are caught up.</p>';
    return;
  }
  els.queue.innerHTML = items.map((it) =>
    '<div class="queue-item"><strong>' + esc(it.title) + '</strong>' +
    '<div class="meta">' + esc(it.detail) + '</div>' +
    '<div class="cta-row" style="margin-top:8px"><button type="button" class="primary" data-open-web="1">Resolve in web</button></div></div>'
  ).join("");
  els.queue.querySelectorAll("[data-open-web]").forEach((btn) => {
    btn.addEventListener("click", openWeb);
  });
}

function renderAgents(snap) {
  if (!snap?.presence?.length) {
    els.agents.innerHTML = '<p class="muted">No external agents connected.</p>';
    return;
  }
  els.agents.innerHTML = snap.presence.map((a) =>
    '<span class="agent-chip" style="border-color:' + esc(a.color || "#3b82f6") + '">' +
    esc((a.emoji || "🤖") + " " + (a.agentName || "Agent")) +
    (a.focus?.nodeId ? ' · <code>' + esc(a.focus.nodeId) + '</code>' : '') +
    '</span>'
  ).join("");
}

function showFocusHandshake(data) {
  els.focusPanel.classList.remove("hidden");
  els.focusTitle.textContent = "Agent wants to join";
  els.focusBody.textContent =
    (data.proposedEmoji || "🤖") + " " + (data.proposedName || data.agentName || "External agent") +
    " — approve or deny in the ArchiSlop browser tab (handshake dialog).";
  els.focusActions.innerHTML = '<button type="button" class="primary" data-open-web="1">Open web to approve</button>';
  els.focusPreview.classList.add("hidden");
  els.focusActions.querySelector("[data-open-web]")?.addEventListener("click", openWeb);
}

function showFocusProposal(data) {
  els.focusPanel.classList.remove("hidden");
  const agent = data.origin?.agentName ?? "External agent";
  els.focusTitle.textContent = agent + " proposed a " + (data.contentType || "mermaid") + " edit";
  els.focusBody.textContent = data.reason || "(no reason given)";
  const diff = data.diffSummary;
  const diffLine = diff
    ? "+" + (diff.linesAdded ?? 0) + " / -" + (diff.linesRemoved ?? 0) + " lines changed"
    : "";
  els.focusActions.innerHTML =
    '<button type="button" class="primary" data-open-web="1">Review in web Insights</button>' +
    (diffLine ? '<span class="muted">' + esc(diffLine) + '</span>' : '') +
    '<button type="button" data-full-review="1">Full diff (MCP)</button>';
  els.focusActions.querySelector("[data-open-web]")?.addEventListener("click", openWeb);
  els.focusActions.querySelector("[data-full-review]")?.addEventListener("click", () => {
    if (data.proposalId) openMcpTool("open_proposal_review", { proposalId: data.proposalId });
  });
  const proposed = data.diagramSource ?? "";
  if (data.contentType === "mermaid" && proposed.trim()) {
    els.focusPreview.classList.remove("hidden");
    els.focusPreview.textContent = "Rendering preview…";
    renderMermaidPreview(els.focusPreview, proposed);
  } else {
    els.focusPreview.classList.add("hidden");
  }
}

function handleToolResult(result) {
  const data = parsePayload(result);
  if (!data) return;
  webCanvasUrl = data.webCanvasUrl ?? webCanvasUrl;
  if (data.requestId && (data.proposedName || data.status === "pending" || data.status === "awaiting_user_approval")) {
    showFocusHandshake(data);
    refresh();
    return;
  }
  if (data.proposalId) {
    showFocusProposal(data);
    refresh();
    return;
  }
  refresh();
}

async function refresh() {
  try {
    const [snapResult, bootResult] = await Promise.all([
      app.callServerTool({ name: "get_session_snapshot", arguments: {} }),
      app.callServerTool({ name: "get_session_bootstrap", arguments: {} }).catch(() => null),
    ]);
    const snap = parsePayload(snapResult);
    const boot = bootResult ? parsePayload(bootResult) : null;
    if (!snap) return;
    webCanvasUrl = snap.webCanvasUrl ?? boot?.webCanvasUrl ?? webCanvasUrl;
    renderQueue(boot, snap);
    renderAgents(snap);
    els.status.textContent =
      "Rev mermaid " + (snap.revisions?.mermaid ?? "?") +
      " · infographic " + (snap.revisions?.infographic ?? "?") +
      " · updated " + new Date().toLocaleTimeString();
  } catch (e) {
    els.status.textContent = "Refresh failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Web Companion", version: "1.0.0" });
wireAppNav("companion");
app.ontoolresult = (result) => handleToolResult(result);
document.getElementById("open-web").addEventListener("click", openWeb);
document.getElementById("open-canvas").addEventListener("click", () => openMcpTool("open_diagram_canvas"));
document.getElementById("open-events").addEventListener("click", () => openMcpTool("open_session_events"));

app.connect().then(async () => {
  await refresh();
  bridge = createSessionEventBridge({
    onEvent: (e) => {
      pushEvent(e);
      if (e.type === "handshake_request" || e.type === "proposal_received" || e.type === "handshake_resolved" || e.type === "proposal_resolved") {
        refresh();
      }
    },
    onSnapshot: () => refresh(),
  });
  await bridge.start();
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
