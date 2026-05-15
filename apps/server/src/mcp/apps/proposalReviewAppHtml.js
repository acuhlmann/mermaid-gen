import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_DIAGRAM_PREVIEW_SCRIPT, MCP_APP_PREVIEW_BOX_CSS } from './mcpAppDiagramPreview.js';

export const proposalReviewAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Review proposal</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_PREVIEW_BOX_CSS}
.tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.tabs button { padding: 4px 10px; font-size: 12px; }
.tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 520px) { .grid, .preview-grid { grid-template-columns: 1fr; } }
h3 { font-size: 0.85rem; color: var(--muted); margin-bottom: 4px; }
.stats { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.stat { font-size: 12px; padding: 2px 8px; border-radius: 4px; background: rgba(59,130,246,0.15); }
.stat.del { background: rgba(239,68,68,0.15); }
.stat.add { background: rgba(34,197,94,0.15); }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.chip { font-size: 11px; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; }
.chip.add { background: rgba(34,197,94,0.2); }
.chip.del { background: rgba(239,68,68,0.2); }
.chip.mod { background: rgba(234,179,8,0.2); }
#unified { max-height: 240px; overflow: auto; }
.diff-line { display: block; padding: 0 4px; margin: 0; white-space: pre-wrap; word-break: break-word; }
.diff-line.add { background: rgba(34,197,94,0.18); }
.diff-line.del { background: rgba(239,68,68,0.18); }
.diff-line.same { opacity: 0.55; }
.hidden { display: none !important; }
.feedback { width: 100%; min-height: 72px; font: inherit; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel); color: var(--text); resize: vertical; }
  </style>
</head>
<body>
  <h1>Diagram edit proposal</h1>
  <p id="web-hint" class="panel hidden"></p>
  <p class="muted" id="meta"></p>
  <p id="reason" class="panel"></p>
  <div id="stats" class="stats"></div>
  <div id="graph-changes" class="hidden"></div>
  <div class="tabs">
    <button type="button" class="active" data-tab="preview">Preview</button>
    <button type="button" data-tab="unified">Unified diff</button>
    <button type="button" data-tab="split">Source</button>
    <button type="button" data-tab="feedback">Request changes</button>
  </div>
  <div id="panel-preview">
    <div class="preview-grid">
      <div>
        <h3>Current</h3>
        <div id="preview-before" class="preview-box muted">Rendering…</div>
      </div>
      <div>
        <h3>Proposed</h3>
        <div id="preview-after" class="preview-box muted">Rendering…</div>
      </div>
    </div>
    <p class="muted" id="preview-note"></p>
  </div>
  <div id="panel-unified" class="hidden">
    <pre id="unified"></pre>
  </div>
  <div id="panel-split" class="grid hidden">
    <div>
      <h3>Current (rev <span id="rev-before">?</span>)</h3>
      <pre id="before"></pre>
    </div>
    <div>
      <h3>Proposed</h3>
      <pre id="after"></pre>
    </div>
  </div>
  <div id="panel-feedback" class="hidden panel">
    <p class="muted">Send revision notes to the proposing agent. The proposal stays pending until you accept or reject.</p>
    <textarea id="feedback-text" class="feedback" placeholder="e.g. Rename node B to Checkout; keep the payment subgraph."></textarea>
    <div class="row" style="margin-top:8px">
      <button type="button" class="primary" id="send-feedback">Send feedback</button>
    </div>
  </div>
  <p id="warnings" class="muted hidden"></p>
  <p id="status" class="muted"></p>
  <div class="row" id="actions">
    <button type="button" id="open-web">Open in ArchiSlop</button>
    <button type="button" class="danger" id="reject">Reject</button>
    <button type="button" class="primary" id="accept">Accept</button>
  </div>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_DIAGRAM_PREVIEW_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const els = {
  webHint: document.getElementById("web-hint"),
  meta: document.getElementById("meta"),
  reason: document.getElementById("reason"),
  stats: document.getElementById("stats"),
  graphChanges: document.getElementById("graph-changes"),
  unified: document.getElementById("unified"),
  before: document.getElementById("before"),
  after: document.getElementById("after"),
  revBefore: document.getElementById("rev-before"),
  warnings: document.getElementById("warnings"),
  status: document.getElementById("status"),
  actions: document.getElementById("actions"),
  accept: document.getElementById("accept"),
  reject: document.getElementById("reject"),
  openWeb: document.getElementById("open-web"),
  panelPreview: document.getElementById("panel-preview"),
  panelUnified: document.getElementById("panel-unified"),
  panelSplit: document.getElementById("panel-split"),
  panelFeedback: document.getElementById("panel-feedback"),
  previewBefore: document.getElementById("preview-before"),
  previewAfter: document.getElementById("preview-after"),
  previewNote: document.getElementById("preview-note"),
  feedbackText: document.getElementById("feedback-text"),
  sendFeedback: document.getElementById("send-feedback"),
};

let proposalId = null;
let webCanvasUrl = null;
let lastPayload = null;
let busy = false;

function showTab(tab) {
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  els.panelPreview.classList.toggle("hidden", tab !== "preview");
  els.panelUnified.classList.toggle("hidden", tab !== "unified");
  els.panelSplit.classList.toggle("hidden", tab !== "split");
  els.panelFeedback.classList.toggle("hidden", tab !== "feedback");
}

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

function renderUnified(diffSummary) {
  if (!diffSummary?.unified?.length) {
    els.unified.textContent = "(no diff)";
    return;
  }
  els.unified.innerHTML = diffSummary.unified
    .map((row) => {
      const prefix = row.kind === "add" ? "+ " : row.kind === "del" ? "- " : "  ";
      return '<span class="diff-line ' + esc(row.kind) + '">' + esc(prefix + row.text) + "</span>";
    })
    .join("");
}

function renderStats(diffSummary) {
  if (!diffSummary) { els.stats.innerHTML = ""; return; }
  els.stats.innerHTML =
    '<span class="stat add">+' + diffSummary.linesAdded + " lines</span>" +
    '<span class="stat del">-' + diffSummary.linesRemoved + " removed</span>" +
    (diffSummary.linesChanged ? '<span class="stat">~' + diffSummary.linesChanged + " changed</span>" : "");
}

function renderGraphChanges(data) {
  const g = data.graphDiff ?? data.diffSummary?.graphDiff;
  const ct = data.contentType || "mermaid";
  if (!g) { els.graphChanges.classList.add("hidden"); return; }
  const parts = [];
  if (ct === "mermaid") {
    if (g.edgesAdded?.length) {
      parts.push("<strong>Edges added:</strong> ");
      parts.push(g.edgesAdded.map((e) => '<span class="chip add">' + esc(e.from) + "→" + esc(e.to) + "</span>").join(" "));
    }
    if (g.edgesRemoved?.length) {
      parts.push("<strong>Edges removed:</strong> ");
      parts.push(g.edgesRemoved.map((e) => '<span class="chip del">' + esc(e.from) + "→" + esc(e.to) + "</span>").join(" "));
    }
    if (g.nodesAdded?.length) {
      parts.push("<strong>Nodes added:</strong> ");
      parts.push(g.nodesAdded.map((id) => '<span class="chip add">' + esc(id) + "</span>").join(" "));
    }
    if (g.nodesRemoved?.length) {
      parts.push("<strong>Nodes removed:</strong> ");
      parts.push(g.nodesRemoved.map((id) => '<span class="chip del">' + esc(id) + "</span>").join(" "));
    }
  } else if (ct === "infographic") {
    if (g.addedIds?.length) {
      parts.push("<strong>Items added:</strong> ");
      parts.push(g.addedIds.map((id) => '<span class="chip add">' + esc(id) + "</span>").join(" "));
    }
    if (g.modifiedIds?.length) {
      parts.push("<strong>Items modified:</strong> ");
      parts.push(g.modifiedIds.map((id) => '<span class="chip mod">' + esc(id) + "</span>").join(" "));
    }
    if (g.removedIds?.length) {
      parts.push("<strong>Items removed:</strong> ");
      parts.push(g.removedIds.map((id) => '<span class="chip del">' + esc(id) + "</span>").join(" "));
    }
    if (g.templateChanged) parts.push('<span class="chip mod">template changed</span>');
  }
  if (!parts.length) { els.graphChanges.classList.add("hidden"); return; }
  els.graphChanges.classList.remove("hidden");
  els.graphChanges.innerHTML = '<div class="chips">' + parts.join(" ") + "</div>";
}

async function renderPreviews(data) {
  const ct = data.contentType || "mermaid";
  const before = data.currentDiagramSource ?? "";
  const after = data.diagramSource ?? "";
  if (ct === "mermaid") {
    els.previewNote.textContent =
      "Live Mermaid preview (CDN). If previews stay blank, use Unified diff or the web Insights proposal card.";
    await renderMermaidPreview(els.previewBefore, before);
    await renderMermaidPreview(els.previewAfter, after);
  } else {
    els.previewNote.textContent = "Infographic DSL — open ArchiSlop web for full AntV preview.";
    renderInfographicPreview(els.previewBefore, before);
    renderInfographicPreview(els.previewAfter, after);
  }
}

function render(data) {
  if (!data) {
    els.status.textContent = "No proposal data.";
    return;
  }
  lastPayload = data;
  proposalId = data.proposalId ?? proposalId;
  webCanvasUrl = data.webCanvasUrl ?? webCanvasUrl;
  const agent = data.origin?.agentName ?? "External agent";
  els.meta.textContent = agent + " · " + (data.contentType || "mermaid") + " · base rev " + (data.baseRevisionId ?? "?");
  els.reason.textContent = data.reason || "(no reason given)";
  els.revBefore.textContent = String(data.baseRevisionId ?? "?");
  const before = data.currentDiagramSource ?? "";
  const after = data.diagramSource || "";
  els.before.textContent = before;
  els.after.textContent = after;
  renderStats(data.diffSummary);
  renderUnified(data.diffSummary);
  renderGraphChanges(data);
  renderPreviews(data);
  const warns = data.metadata?.warnings;
  if (Array.isArray(warns) && warns.length) {
    els.warnings.textContent = "Validator: " + (data.metadata.validator || "?") + " — " + warns.join("; ");
    els.warnings.classList.remove("hidden");
  } else els.warnings.classList.add("hidden");
  const st = data.status ?? "pending";
  if (webCanvasUrl && (st === "pending" || !data.status)) {
    els.webHint.classList.remove("hidden");
    els.webHint.innerHTML =
      '<span class="muted">ArchiSlop is open in your browser — use the <strong>proposal card in Insights</strong> to accept or reject. This MCP App is optional; Accept/Reject here may not work in Cursor.</span>';
  } else {
    els.webHint.classList.add("hidden");
  }
  if (st === "accepted") {
    els.status.innerHTML = '<span class="status-ok">Accepted</span> — applied to canvas.';
    els.actions.style.display = "none";
  } else if (st === "rejected") {
    els.status.innerHTML = '<span class="status-err">Rejected</span>';
    els.actions.style.display = "none";
  } else if (st === "changes_requested") {
    els.status.innerHTML = '<span class="status-ok">Feedback sent</span> — waiting for a revised proposal.';
  } else if (st === "stale" || st === "stale_revision") {
    els.status.textContent = "Proposal is stale (diagram changed).";
    els.actions.style.display = "none";
  } else {
    els.status.textContent = "Review preview and diff, then accept, reject, or request changes.";
    els.actions.style.display = "flex";
  }
}

async function resolve(decision) {
  if (!proposalId || busy) return;
  busy = true;
  els.accept.disabled = true;
  els.reject.disabled = true;
  els.status.textContent = "Submitting…";
  try {
    const result = await app.callServerTool({ name: "resolve_proposal", arguments: { proposalId, decision } });
    const body = parsePayload(result);
    render({ ...lastPayload, ...body, proposalId, status: body?.status ?? (decision === "accept" ? "accepted" : "rejected") });
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
    els.accept.disabled = false;
    els.reject.disabled = false;
    busy = false;
  }
}

els.sendFeedback.addEventListener("click", async () => {
  const comment = els.feedbackText.value.trim();
  if (!proposalId || !comment || busy) return;
  busy = true;
  els.sendFeedback.disabled = true;
  els.status.textContent = "Sending feedback…";
  try {
    const result = await app.callServerTool({
      name: "request_proposal_changes",
      arguments: { proposalId, comment },
    });
    const body = parsePayload(result);
    render({ ...lastPayload, ...body, proposalId, status: "changes_requested" });
    showTab("preview");
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
  els.sendFeedback.disabled = false;
  busy = false;
});

const app = new App({ name: "ArchiSlop Proposal Review", version: "1.2.0" });
app.ontoolresult = (result) => render(parsePayload(result));
els.accept.addEventListener("click", () => resolve("accept"));
els.reject.addEventListener("click", () => resolve("reject"));
els.openWeb.addEventListener("click", () => {
  if (webCanvasUrl) app.openLink({ url: webCanvasUrl }).catch(() => window.open(webCanvasUrl, "_blank"));
});
app.connect();
  </script>
</body>
</html>`;
