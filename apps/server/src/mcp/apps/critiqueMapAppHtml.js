import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';

export const critiqueMapAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Critique review</title>
  <style>${MCP_APP_BASE_CSS}</style>
</head>
<body>
  <h1>Critique review</h1>
  <p class="muted" id="from"></p>
  <div class="panel" id="critique"></div>
  <h2>Actionable items</h2>
  <ul id="items"></ul>
  <p id="status" class="muted"></p>
  <div class="row">
    <button type="button" class="primary" id="fix-selected" disabled>Request fix (selected)</button>
    <button type="button" id="view-canvas">View diagram</button>
  </div>
  <script type="module">
${MCP_APP_ESM_IMPORT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function parseActionable(text) {
  const m = text.match(/##\\s*Actionable[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)/i);
  if (!m) return [];
  return m[1].split("\\n").map((l) => l.replace(/^[-*]\\s+/, "").trim()).filter(Boolean);
}

const els = {
  from: document.getElementById("from"),
  critique: document.getElementById("critique"),
  items: document.getElementById("items"),
  status: document.getElementById("status"),
  fixSelected: document.getElementById("fix-selected"),
};

let payload = null;
const selected = new Set();

function renderItems(items) {
  els.items.innerHTML = "";
  selected.clear();
  items.forEach((label, i) => {
    const li = document.createElement("li");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "item-" + i;
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(i); else selected.delete(i);
      els.fixSelected.disabled = selected.size === 0;
    });
    const lab = document.createElement("label");
    lab.htmlFor = cb.id;
    lab.textContent = label;
    li.append(cb, " ", lab);
    els.items.append(li);
  });
  els.fixSelected.disabled = items.length === 0;
}

function render(data) {
  payload = data;
  if (!data) {
    els.status.textContent = "No critique data.";
    return;
  }
  const agent = data.origin?.agentName ?? "External agent";
  els.from.textContent = agent + " · " + (data.variant || "critique");
  els.critique.textContent = data.text || "";
  const items = parseActionable(data.text || "");
  if (!items.length) {
    els.items.innerHTML = '<li class="muted">No actionable section found in this critique.</li>';
    els.fixSelected.disabled = true;
  } else {
    renderItems(items);
  }
}

els.fixSelected.addEventListener("click", async () => {
  if (!payload || selected.size === 0) return;
  const items = parseActionable(payload.text || "");
  const picked = [...selected].sort((a,b)=>a-b).map((i) => items[i]).filter(Boolean);
  els.status.textContent = "Requesting fix…";
  els.fixSelected.disabled = true;
  try {
    const result = await app.callServerTool({
      name: "request_critique_fix",
      arguments: {
        items: picked,
        contentType: payload.contentType || "mermaid",
        critiqueInsightId: payload.insightId,
      },
    });
    const body = parsePayload(result);
    els.status.textContent = body?.status === "queued"
      ? "Fix request queued for the session (use ArchiSlop web to apply)."
      : (body?.message || JSON.stringify(body));
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  }
  els.fixSelected.disabled = false;
});

document.getElementById("view-canvas").addEventListener("click", async () => {
  const ct = payload?.contentType || "mermaid";
  try {
    await app.callServerTool({ name: "open_diagram_canvas", arguments: { contentType: ct } });
  } catch (e) { /* host may open App */ }
});

const app = new App({ name: "ArchiSlop Critique Map", version: "1.1.0" });
app.ontoolresult = (result) => render(parsePayload(result));
app.connect();
  </script>
</body>
</html>`;
