import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';

export const sessionDashboardAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Session dashboard</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}
.agent { border-left: 3px solid var(--accent); padding-left: 8px; margin: 6px 0; }
.proposal-row { margin: 8px 0; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.proposal-row .diff { font-size: 11px; color: var(--muted); margin-top: 4px; }
.handshake-row { margin: 6px 0; padding: 6px 8px; border: 1px dashed var(--border); border-radius: 6px; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Session war room</h1>
  <p class="muted">Live presence, handshakes, and pending proposals.</p>
  <div class="panel">
    <h2>Pending handshakes</h2>
    <div id="handshakes"><p class="muted">None</p></div>
  </div>
  <div class="panel">
    <h2>Connected agents</h2>
    <div id="presence"><p class="muted">Loading…</p></div>
  </div>
  <div class="panel">
    <h2>Pending proposals</h2>
    <div id="proposals"><p class="muted">Loading…</p></div>
  </div>
  <p class="row">
    <button type="button" id="open-events">Live events</button>
    <button type="button" id="open-web">Open ArchiSlop</button>
    <button type="button" id="open-canvas">Preview canvas</button>
  </p>
  <p class="muted" id="refresh-note"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}
${MCP_APP_SESSION_BRIDGE_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

let webCanvasUrl = null;
let bridge = null;

async function openReview(proposalId) {
  if (!proposalId) return;
  try {
    await app.callServerTool({ name: "open_proposal_review", arguments: { proposalId } });
  } catch (e) {
    alert("Could not open review: " + (e?.message ?? String(e)));
  }
}

async function refresh() {
  const [snapResult, bootResult] = await Promise.all([
    app.callServerTool({ name: "get_session_snapshot", arguments: {} }),
    app.callServerTool({ name: "get_session_bootstrap", arguments: {} }).catch(() => null),
  ]);
  const snap = parsePayload(snapResult);
  const boot = bootResult ? parsePayload(bootResult) : null;
  if (!snap) return;
  webCanvasUrl = snap.webCanvasUrl ?? webCanvasUrl;

  const hs = document.getElementById("handshakes");
  const pendingHs = boot?.pendingHandshakes ?? [];
  if (!pendingHs.length) {
    hs.innerHTML = '<p class="muted">No pending join requests.</p>';
  } else {
    hs.innerHTML = pendingHs.map((h) =>
      '<div class="handshake-row">' +
      esc((h.proposedEmoji || "🤖") + " " + (h.proposedName || "Agent")) +
      ' <button type="button" data-approve="' + esc(h.requestId) + '">Approve</button>' +
      '</div>'
    ).join("");
    hs.querySelectorAll("[data-approve]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await app.callServerTool({
            name: "resolve_handshake",
            arguments: { requestId: btn.getAttribute("data-approve"), decision: "approve" },
          });
          refresh();
        } catch (e) {
          alert(e?.message ?? String(e));
        }
      });
    });
  }

  const pres = document.getElementById("presence");
  if (!snap.presence?.length) {
    pres.innerHTML = '<p class="muted">No external agents connected.</p>';
  } else {
    pres.innerHTML = snap.presence.map((a) =>
      '<div class="agent" style="border-color:' + esc(a.color || "#3b82f6") + '">' +
      esc((a.emoji || "🤖") + " " + (a.agentName || "Agent")) +
      (a.focus?.nodeId ? ' · focus: <code>' + esc(a.focus.nodeId) + '</code>' : '') +
      '</div>'
    ).join("");
  }
  const prop = document.getElementById("proposals");
  if (!snap.proposals?.length) {
    prop.innerHTML = '<p class="muted">No pending proposals.</p>';
  } else {
    prop.innerHTML = snap.proposals.map((p) => {
      const diff = p.diffSummary;
      const diffLine = diff
        ? "+" + (diff.linesAdded ?? 0) + " / -" + (diff.linesRemoved ?? 0) + " lines"
        : "";
      return '<div class="proposal-row">' +
        '<strong>' + esc(p.origin?.agentName) + '</strong> — ' + esc(p.contentType) +
        ': ' + esc(p.reason?.slice(0, 80)) + (p.reason?.length > 80 ? '…' : '') +
        ' <code>' + esc(p.proposalId?.slice(0, 8)) + '</code>' +
        (diffLine ? '<div class="diff">' + esc(diffLine) + '</div>' : '') +
        '<div class="row" style="margin-top:6px"><button type="button" data-review="' + esc(p.proposalId) + '">Review</button></div>' +
        '</div>';
    }).join("");
    prop.querySelectorAll("[data-review]").forEach((btn) => {
      btn.addEventListener("click", () => openReview(btn.getAttribute("data-review")));
    });
  }
  document.getElementById("refresh-note").textContent =
    "Revisions: mermaid " + snap.revisions?.mermaid + ", infographic " + snap.revisions?.infographic +
    ", 3D " + (snap.revisions?.metaphor3d ?? 0) + ", chart " + (snap.revisions?.chart ?? 0) +
    " · refreshed " + new Date().toLocaleTimeString();
}

const app = new App({ name: "ArchiSlop Session Dashboard", version: "1.2.0" });
wireAppNav("dashboard");
app.ontoolresult = () => refresh();
document.getElementById("open-web").addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
document.getElementById("open-canvas").addEventListener("click", () => openMcpTool("open_diagram_canvas"));
document.getElementById("open-events").addEventListener("click", () => openMcpTool("open_session_events"));
app.connect().then(async () => {
  await refresh();
  bridge = createSessionEventBridge({
    onEvent: () => refresh(),
    onSnapshot: () => refresh(),
  });
  await bridge.start();
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
