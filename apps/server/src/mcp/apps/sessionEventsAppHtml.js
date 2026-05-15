import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';

export const sessionEventsAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Session events</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}
.event { border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin: 6px 0; font-size: 12px; }
.event-type { font-weight: 600; color: var(--accent); }
.event time { color: var(--muted); font-size: 11px; }
.event-actions { margin-top: 6px; }
#feed { max-height: min(480px, 60vh); overflow: auto; }
.live-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--success); margin-right: 6px; }
.live-dot.poll { background: var(--muted); }
.hidden { display: none !important; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1><span class="live-dot" id="live-dot"></span>Session events</h1>
  <p class="muted">Live collaboration feed (SSE with long-poll fallback).</p>
  <div class="row" style="margin-bottom:8px">
    <button type="button" id="clear">Clear</button>
    <button type="button" id="open-web">Open ArchiSlop</button>
  </div>
  <div id="pairing-alert" class="panel hidden" style="border-color:#f59e0b">
    <strong>Pairing code rotated.</strong> Call <code>join_session</code> with a fresh code from Invite agent.
  </div>
  <div id="feed"></div>
  <p class="muted" id="status">Connecting…</p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}
${MCP_APP_SESSION_BRIDGE_SCRIPT}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

const els = {
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
  liveDot: document.getElementById("live-dot"),
  pairingAlert: document.getElementById("pairing-alert"),
};
let webCanvasUrl = null;
let bridge = null;
const maxEvents = 80;
const events = [];

function summarize(envelope) {
  const t = envelope.type;
  const p = envelope.payload ?? {};
  if (t === "proposal_received") return (p.origin?.agentName || "Agent") + " proposed " + (p.contentType || "edit");
  if (t === "proposal_resolved") return "Proposal " + (p.status || "resolved");
  if (t === "proposal_changes_requested") return "Changes requested on proposal";
  if (t === "handshake_request") return (p.proposedName || "Agent") + " wants to join";
  if (t === "handshake_resolved") return "Handshake " + (p.status || "");
  if (t === "attributed_insight") return (p.origin?.agentName || "Someone") + ": " + (p.variant || "note");
  if (t === "presence_update") return "Presence updated (" + (p?.length ?? "?") + " agents)";
  if (t === "state_changed") return "Diagram updated (" + (p.contentType || "") + ")";
  if (t === "reaction") return (p.emoji || "👍") + " reaction";
  if (t === "pairing_rotated") return "Pairing code rotated";
  if (t === "critique_fix_request") return "Critique fix requested";
  return t || "event";
}

function renderFeed() {
  if (!events.length) {
    els.feed.innerHTML = '<p class="muted">Waiting for events…</p>';
    return;
  }
  els.feed.innerHTML = events.map((e) => {
    const ts = e.at ? new Date(e.at).toLocaleTimeString() : "";
    const actions = [];
    if (e.type === "proposal_received" && e.payload?.proposalId) {
      actions.push('<button type="button" data-review="' + esc(e.payload.proposalId) + '">Review</button>');
    }
    if (e.type === "attributed_insight" && e.payload?.variant === "critique" && e.payload?.text) {
      actions.push('<button type="button" data-critique="1">Critique map</button>');
    }
    return '<article class="event">' +
      '<span class="event-type">' + esc(e.type) + '</span> ' +
      (ts ? '<time>' + esc(ts) + '</time>' : '') +
      '<p>' + esc(summarize(e)) + '</p>' +
      (actions.length ? '<div class="event-actions row">' + actions.join("") + '</div>' : '') +
      '</article>';
  }).join("");
  els.feed.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openMcpTool("open_proposal_review", { proposalId: btn.getAttribute("data-review") });
    });
  });
  els.feed.querySelectorAll("[data-critique]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = events.find((x) => x.type === "attributed_insight" && x.payload?.variant === "critique");
      if (row?.payload) {
        openMcpTool("open_critique_review", {
          text: row.payload.text,
          variant: "critique",
          insightId: row.payload.insightId,
        });
      }
    });
  });
}

function pushEvent(envelope) {
  events.unshift(envelope);
  if (events.length > maxEvents) events.length = maxEvents;
  renderFeed();
}

async function onEvent(envelope) {
  if (envelope.type === "pairing_rotated") {
    els.pairingAlert.classList.remove("hidden");
  }
  pushEvent(envelope);
  els.status.textContent = "Live · seq " + (envelope.seq ?? "—") + " · " + new Date().toLocaleTimeString();
}

const app = new App({ name: "ArchiSlop Session Events", version: "1.0.0" });
wireAppNav("events");
document.getElementById("clear").addEventListener("click", () => {
  events.length = 0;
  renderFeed();
});
document.getElementById("open-web").addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
app.ontoolresult = (result) => {
  const data = parseToolJson(result);
  if (data?.webCanvasUrl) webCanvasUrl = data.webCanvasUrl;
};
app.connect().then(async () => {
  try {
    const boot = parseToolJson(await app.callServerTool({ name: "get_session_bootstrap", arguments: {} }));
    webCanvasUrl = boot?.webCanvasUrl ?? webCanvasUrl;
  } catch { /* ignore */ }
  bridge = createSessionEventBridge({
    onEvent,
    onSnapshot: (snap) => {
      if (snap?.pendingProposals?.length) {
        for (const p of snap.pendingProposals) {
          pushEvent({ type: "proposal_received", payload: p, at: new Date().toISOString() });
        }
      }
    },
  });
  await bridge.start();
  els.status.textContent = "Connected";
  els.liveDot.classList.remove("poll");
}).catch((e) => {
  els.status.textContent = "Failed: " + (e?.message ?? String(e));
  els.liveDot.classList.add("poll");
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
