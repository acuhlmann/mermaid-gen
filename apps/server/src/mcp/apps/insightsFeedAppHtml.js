import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';

export const insightsFeedAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Insights feed</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}
.insight { border-left: 3px solid var(--accent); padding: 8px 10px; margin: 8px 0; background: var(--panel); border-radius: 0 8px 8px 0; }
.insight.critique { border-color: #f59e0b; }
.insight.suggestion { border-color: #22c55e; }
.insight-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 4px; }
.variant { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.insight-body { white-space: pre-wrap; word-break: break-word; font-size: 13px; }
.insight time { font-size: 11px; color: var(--muted); }
.react-row { margin-top: 6px; }
.react-row button { font-size: 14px; padding: 2px 6px; }
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Insights feed</h1>
  <p class="muted">Attributed notes, critiques, and suggestions in this session (newest first).</p>
  <div class="row" style="margin-bottom:8px">
    <button type="button" id="refresh">Refresh</button>
    <button type="button" id="compose">Compose</button>
    <button type="button" id="open-web">Open ArchiSlop</button>
  </div>
  <div id="list"><p class="muted">Loading…</p></div>
  <p class="muted" id="status"></p>
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

const els = { list: document.getElementById("list"), status: document.getElementById("status") };
let webCanvasUrl = null;
let bridge = null;
let lastInsights = [];

function renderFeed(data) {
  webCanvasUrl = data?.webCanvasUrl ?? webCanvasUrl;
  const items = data?.insights ?? [];
  lastInsights = items;
  if (!items.length) {
    els.list.innerHTML = '<p class="muted">No insights yet.</p>';
    return;
  }
  els.list.innerHTML = items.map((row, i) => {
    const origin = row.origin ?? {};
    const label = (origin.emoji || "💬") + " " + esc(origin.agentName || "Participant");
    const variant = row.variant || "note";
    const ts = row.createdAt ? new Date(row.createdAt).toLocaleString() : "";
    const critiqueBtn = variant === "critique"
      ? '<button type="button" data-critique-idx="' + i + '">Critique map</button>'
      : "";
    return '<article class="insight ' + esc(variant) + '" data-idx="' + i + '">' +
      '<div class="insight-head"><span>' + label + '</span>' +
      '<span class="variant">' + esc(variant) + '</span>' +
      (ts ? '<time>' + esc(ts) + '</time>' : '') +
      '</div><div class="insight-body">' + esc(row.text) + '</div>' +
      '<div class="react-row row">' + critiqueBtn +
      '<button type="button" data-react="' + i + '" data-emoji="👍">👍</button>' +
      '<button type="button" data-react="' + i + '" data-emoji="🎯">🎯</button>' +
      '</div></article>';
  }).join("");
  els.list.querySelectorAll("[data-critique-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = lastInsights[Number(btn.getAttribute("data-critique-idx"))];
      if (!row) return;
      openMcpTool("open_critique_review", {
        text: row.text,
        variant: "critique",
        insightId: row.insightId,
      });
    });
  });
  els.list.querySelectorAll("[data-react]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = lastInsights[Number(btn.getAttribute("data-react"))];
      if (!row?.insightId) return;
      try {
        await app.callServerTool({
          name: "react",
          arguments: {
            target: { kind: "insight", insightId: row.insightId },
            emoji: btn.getAttribute("data-emoji"),
          },
        });
        els.status.textContent = "Reacted " + btn.getAttribute("data-emoji");
      } catch (e) {
        els.status.textContent = "React failed: " + (e?.message ?? String(e));
      }
    });
  });
}

async function refresh() {
  els.status.textContent = "Refreshing…";
  try {
    const result = await app.callServerTool({ name: "get_insights", arguments: { limit: 50 } });
    renderFeed(parsePayload(result));
    els.status.textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Insights Feed", version: "1.1.0" });
wireAppNav("insights");
app.ontoolresult = (result) => renderFeed(parsePayload(result));
document.getElementById("refresh").addEventListener("click", () => refresh());
document.getElementById("compose").addEventListener("click", () => openMcpTool("open_compose_insight"));
document.getElementById("open-web").addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
app.connect().then(async () => {
  await refresh();
  bridge = createSessionEventBridge({
    onEvent: (e) => {
      if (e.type === "attributed_insight") refresh();
    },
  });
  await bridge.start();
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
