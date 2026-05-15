import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';

export const handshakeAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Approve external agent</title>
  <style>${MCP_APP_BASE_CSS}</style>
</head>
<body>
  <h1>Approve external agent</h1>
  <p class="muted" id="subtitle">An external agent wants to collaborate on this diagram. If ArchiSlop is open in your browser, use the handshake dialog there instead — this MCP App is for MCP-only hosts.</p>
  <div id="card" class="panel">
    <div id="agent-line" class="row">
      <span id="emoji" class="badge">🤖</span>
      <strong id="name">—</strong>
      <span id="color-swatch" class="badge"></span>
    </div>
    <p id="client" class="muted"></p>
    <p id="status" class="muted"></p>
    <div class="row" id="actions">
      <button type="button" class="danger" id="deny">Deny</button>
      <button type="button" class="primary" id="approve">Approve</button>
    </div>
  </div>
  <script type="module">
${MCP_APP_ESM_IMPORT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const els = {
  name: document.getElementById("name"),
  emoji: document.getElementById("emoji"),
  colorSwatch: document.getElementById("color-swatch"),
  client: document.getElementById("client"),
  status: document.getElementById("status"),
  actions: document.getElementById("actions"),
  approve: document.getElementById("approve"),
  deny: document.getElementById("deny"),
};

let requestId = null;
let busy = false;

function render(data) {
  if (!data) {
    els.status.textContent = "No handshake data.";
    return;
  }
  requestId = data.requestId ?? requestId;
  els.name.textContent = data.proposedName ?? data.agentName ?? "External agent";
  els.emoji.textContent = data.proposedEmoji ?? data.emoji ?? "🤖";
  const color = data.proposedColor ?? data.color ?? "#3b82f6";
  els.colorSwatch.textContent = color;
  els.colorSwatch.style.borderColor = color;
  els.client.textContent = data.clientInfo ? "Client: " + data.clientInfo : "";
  const st = data.status ?? "awaiting_user_approval";
  if (st === "approved") {
    els.status.innerHTML = '<span class="status-ok">Approved</span> — agent may use tools.';
    els.actions.style.display = "none";
  } else if (st === "denied") {
    els.status.innerHTML = '<span class="status-err">Denied</span>';
    els.actions.style.display = "none";
  } else if (st === "expired") {
    els.status.textContent = "Request expired. Ask the agent to register again.";
    els.actions.style.display = "none";
  } else {
    els.status.textContent = "Waiting for your decision.";
    els.actions.style.display = "flex";
  }
}

async function resolve(decision) {
  if (!requestId || busy) return;
  busy = true;
  els.approve.disabled = true;
  els.deny.disabled = true;
  els.status.textContent = "Submitting…";
  try {
    const result = await app.callServerTool({
      name: "resolve_handshake",
      arguments: { requestId, decision },
    });
    const body = parsePayload(result);
    render(body ?? { status: decision === "approve" ? "approved" : "denied", requestId });
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
    els.approve.disabled = false;
    els.deny.disabled = false;
    busy = false;
  }
}

const app = new App({ name: "ArchiSlop Handshake", version: "1.0.0" });
app.ontoolresult = (result) => render(parsePayload(result));
els.approve.addEventListener("click", () => resolve("approve"));
els.deny.addEventListener("click", () => resolve("deny"));
app.connect();
  </script>
</body>
</html>`;
