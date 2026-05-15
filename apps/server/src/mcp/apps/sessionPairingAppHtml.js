import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SESSION_BRIDGE_SCRIPT } from './mcpAppSessionBridge.js';

export const sessionPairingAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Pair MCP to room</title>
  <style>${MCP_APP_BASE_CSS}
input.pairing-input {
  font: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 20px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  width: 10em;
  max-width: 100%;
}
.pairing-form { display: flex; flex-direction: column; gap: 10px; }
.next-step { margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.12); border: 1px solid var(--accent); }
.pairing-alert { margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(245,158,11,0.15); border: 1px solid #f59e0b; }
.hidden { display: none !important; }
  </style>
</head>
<body>
  <h1>Join ArchiSlop room</h1>
  <p class="muted" id="subtitle">Bind this MCP connection to the diagram session open in your browser.</p>

  <div id="bound-panel" class="panel" style="display: none;">
    <p><span class="status-ok">Connected</span> to room <code id="bound-session"></code></p>
    <p class="muted">Pairing code: <strong id="bound-code"></strong></p>
    <p id="agent-line" class="muted"></p>
    <div class="next-step" id="next-step"></div>
    <p class="row">
      <a id="web-link-bound" href="#" target="_blank" rel="noopener">Open ArchiSlop canvas</a>
    </p>
  </div>

  <div id="form-panel" class="panel pairing-form">
    <p class="muted">In ArchiSlop, click <strong>Invite agent</strong> and copy the 6-character pairing code, then paste it below.</p>
    <label class="muted" for="code">Pairing code</label>
    <input id="code" class="pairing-input" type="text" maxlength="8" autocomplete="off" placeholder="ABC123" />
    <div class="row">
      <button type="button" class="primary" id="join">Join session</button>
    </div>
  </div>

  <p id="pairing-rotated" class="pairing-alert hidden">Pairing code rotated — paste a fresh code from Invite agent.</p>
  <p id="status" class="muted"></p>
  <p class="row">
    <a id="web-link" href="#" target="_blank" rel="noopener">Open ArchiSlop in browser</a>
    <button type="button" id="preview-canvas" style="display:none">Preview canvas</button>
  </p>

  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SESSION_BRIDGE_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; };
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

const els = {
  subtitle: document.getElementById("subtitle"),
  boundPanel: document.getElementById("bound-panel"),
  formPanel: document.getElementById("form-panel"),
  boundSession: document.getElementById("bound-session"),
  boundCode: document.getElementById("bound-code"),
  agentLine: document.getElementById("agent-line"),
  nextStep: document.getElementById("next-step"),
  webLinkBound: document.getElementById("web-link-bound"),
  code: document.getElementById("code"),
  join: document.getElementById("join"),
  status: document.getElementById("status"),
  webLink: document.getElementById("web-link"),
  previewCanvas: document.getElementById("preview-canvas"),
};

let busy = false;

function setWebLink(url) {
  if (!url) return;
  els.webLink.href = url;
  els.webLinkBound.href = url;
}

function renderBound(data) {
  els.formPanel.style.display = "none";
  els.boundPanel.style.display = "block";
  els.boundSession.textContent = data.sessionId ?? "—";
  els.boundCode.textContent = data.pairingCode ?? "—";
  if (data.agentRegistered) {
    els.previewCanvas.style.display = "inline-block";
    els.agentLine.textContent = "Agent: " + (data.agentName || data.agentId || "registered");
    els.nextStep.innerHTML =
      'You are registered. Call <code>open_diagram_canvas</code> to preview the canvas, then <code>get_session_state</code> before proposing edits.';
  } else {
    els.agentLine.textContent = "";
    els.nextStep.innerHTML = 'Next: call <code>register_agent</code> with your name — the human approves in this host or the web UI.';
  }
  setWebLink(data.webCanvasUrl);
  els.status.textContent = "";
  els.subtitle.textContent = "This MCP connection is bound to an ArchiSlop room.";
}

function showForm(hint) {
  els.boundPanel.style.display = "none";
  els.formPanel.style.display = "flex";
  els.subtitle.textContent = hint || "Paste the pairing code from Invite agent in the ArchiSlop web UI.";
}

async function refreshBinding() {
  try {
    const result = await app.callServerTool({ name: "get_mcp_binding", arguments: {} });
    const body = parsePayload(result);
    if (body?.bound) {
      renderBound(body);
      return body;
    }
    if (body?.webCanvasUrl) setWebLink(body.webCanvasUrl);
    return body;
  } catch (e) {
    els.status.textContent = "Could not read binding: " + (e?.message ?? String(e));
    return null;
  }
}

async function submitJoin() {
  if (busy) return;
  const raw = els.code.value.trim();
  if (!raw) {
    els.status.textContent = "Enter a pairing code.";
    return;
  }
  busy = true;
  els.join.disabled = true;
  els.status.textContent = "Joining…";
  try {
    const result = await app.callServerTool({
      name: "join_session",
      arguments: { pairingCode: raw },
    });
    handleToolResult(result);
  } catch (e) {
    els.status.innerHTML = '<span class="status-err">' + esc(e?.message ?? String(e)) + "</span>";
  } finally {
    els.join.disabled = false;
    busy = false;
  }
}

function handleToolResult(result) {
  if (result?.isError) {
    const msg = result.content?.find((c) => c.type === "text")?.text ?? "Join failed.";
    els.status.innerHTML = '<span class="status-err">' + esc(msg) + "</span>";
    showForm();
    return;
  }
  const body = parsePayload(result);
  if (!body) {
    els.status.textContent = "Unexpected response.";
    return;
  }
  if (body.status === "joined" || body.bound) {
    renderBound(body.bound ? body : body);
    return;
  }
  if (body.status === "needs_pairing_code") {
    showForm(body.message);
    if (body.webCanvasUrl) setWebLink(body.webCanvasUrl);
    els.status.textContent = "";
    return;
  }
  els.status.textContent = body.message || body.raw || JSON.stringify(body);
}

const app = new App({ name: "ArchiSlop Session Pairing", version: "1.0.0" });
app.ontoolresult = (result) => handleToolResult(result);
els.previewCanvas.addEventListener("click", async () => {
  try { await app.callServerTool({ name: "open_diagram_canvas", arguments: {} }); } catch (e) { /* host opens App */ }
});
els.join.addEventListener("click", () => submitJoin());
els.code.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitJoin();
});

let bridge = null;
app.connect().then(async () => {
  const binding = await refreshBinding();
  if (!binding?.bound) showForm(binding?.inviteHint);
  bridge = createSessionEventBridge({
    onEvent: (e) => {
      if (e.type === "pairing_rotated") {
        document.getElementById("pairing-rotated").classList.remove("hidden");
        showForm("Pairing code expired — paste a new code.");
      }
    },
  });
  await bridge.start();
});
window.addEventListener("beforeunload", () => bridge?.stop());
  </script>
</body>
</html>`;
