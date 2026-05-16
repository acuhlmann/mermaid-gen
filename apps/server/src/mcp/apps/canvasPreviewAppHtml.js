import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT, MCP_APP_PREVIEW_BOX_CSS } from './mcpAppDiagramPreview.js';

export const canvasPreviewAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Canvas preview</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_PREVIEW_BOX_CSS}
.source-panel { margin-top: 8px; }
.source-panel summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
.source-panel pre { max-height: 160px; }
  </style>
</head>
<body>
  <h1>Session canvas</h1>
  <p class="muted" id="meta">Loading…</p>
  <div class="tabs" id="slot-tabs">
    <button type="button" class="active" data-slot="mermaid">Mermaid</button>
    <button type="button" data-slot="infographic">Infographic</button>
  </div>
  <div class="tabs" id="view-tabs" style="margin-top:4px">
    <button type="button" class="active" data-view="preview">Preview</button>
    <button type="button" data-view="source">Source</button>
  </div>
  <div id="panel-preview">
    <div id="preview-box" class="preview-box muted">Rendering…</div>
    <p class="muted" id="preview-note"></p>
  </div>
  <div id="panel-source" class="hidden">
    <pre id="source"></pre>
  </div>
  <details class="source-panel">
    <summary>Copy-friendly source</summary>
    <pre id="source-copy"></pre>
  </details>
  <p class="row" style="margin-top:10px">
    <button type="button" class="primary" id="open-web">Open in ArchiSlop</button>
    <button type="button" id="refresh">Refresh</button>
  </p>
  <p id="status" class="muted"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_DIAGRAM_PREVIEW_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const els = {
  meta: document.getElementById("meta"),
  previewBox: document.getElementById("preview-box"),
  previewNote: document.getElementById("preview-note"),
  source: document.getElementById("source"),
  sourceCopy: document.getElementById("source-copy"),
  panelPreview: document.getElementById("panel-preview"),
  panelSource: document.getElementById("panel-source"),
  openWeb: document.getElementById("open-web"),
  refresh: document.getElementById("refresh"),
  status: document.getElementById("status"),
};

let payload = null;
let activeSlot = "mermaid";
let activeView = "preview";
let webCanvasUrl = null;

function slotData() {
  if (!payload?.slots) return { revisionId: 0, diagramSource: "" };
  return payload.slots[activeSlot] ?? { revisionId: 0, diagramSource: "" };
}

function showView(view) {
  activeView = view;
  document.querySelectorAll("#view-tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
  els.panelPreview.classList.toggle("hidden", view !== "preview");
  els.panelSource.classList.toggle("hidden", view !== "source");
}

document.querySelectorAll("#view-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView(btn.dataset.view);
    renderSlot();
  });
});

document.querySelectorAll("#slot-tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeSlot = btn.dataset.slot;
    document.querySelectorAll("#slot-tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.slot === activeSlot);
    });
    renderSlot();
  });
});

async function renderSlot() {
  const slot = slotData();
  const source = slot.diagramSource ?? "";
  els.meta.textContent =
    "Rev " + slot.revisionId + " · " + activeSlot +
    (payload?.sessionId ? " · " + payload.sessionId.slice(0, 12) + "…" : "");
  els.source.textContent = source || "(empty)";
  els.sourceCopy.textContent = source || "(empty)";
  if (activeView === "source") return;
  if (activeSlot === "mermaid") {
    els.previewNote.textContent = "Live Mermaid preview (sandboxed). Open web for editor + built-in agents.";
    await renderMermaidPreview(els.previewBox, source);
  } else {
    els.previewNote.textContent = "Live AntV infographic preview (sandboxed). Open web for editor + built-in agents.";
    await renderInfographicPreview(els.previewBox, source);
  }
}

function applyPayload(data) {
  if (!data) {
    els.status.textContent = "No canvas data.";
    return;
  }
  payload = data;
  webCanvasUrl = data.webCanvasUrl ?? webCanvasUrl;
  activeSlot = data.contentType ?? data.activeContentType ?? activeSlot;
  document.querySelectorAll("#slot-tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.slot === activeSlot);
  });
  renderSlot();
  els.status.textContent = "";
}

async function loadCanvas() {
  els.status.textContent = "Refreshing…";
  try {
    const result = await app.callServerTool({
      name: "get_session_state",
      arguments: { contentType: activeSlot },
    });
    const body = parsePayload(result);
    if (body?.slots) applyPayload(body);
    else if (body) {
      applyPayload({
        ...payload,
        activeContentType: activeSlot,
        contentType: activeSlot,
        slots: {
          ...(payload?.slots ?? {}),
          [activeSlot]: {
            revisionId: body.revisionId,
            diagramSource: body.diagramSource,
          },
        },
        webCanvasUrl: body.webCanvasUrl ?? webCanvasUrl,
        sessionId: body.sessionId ?? payload?.sessionId,
      });
    }
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
}

const app = new App({ name: "ArchiSlop Canvas Preview", version: "1.0.0" });
app.ontoolresult = (result) => applyPayload(parsePayload(result));
els.openWeb.addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
els.refresh.addEventListener("click", () => loadCanvas());
app.connect();
  </script>
</body>
</html>`;
