import { MCP_APP_BASE_CSS, MCP_APP_ESM_IMPORT } from './mcpAppStyles.js';
import { MCP_APP_SHELL_CSS, MCP_APP_SHELL_NAV_HTML, MCP_APP_SHELL_SCRIPT } from './mcpAppShell.js';

export const composeInsightAppHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ArchiSlop — Compose insight</title>
  <style>${MCP_APP_BASE_CSS}${MCP_APP_SHELL_CSS}
textarea.compose {
  width: 100%;
  min-height: 120px;
  font: inherit;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  resize: vertical;
}
  </style>
</head>
<body>
  ${MCP_APP_SHELL_NAV_HTML}
  <h1>Post an insight</h1>
  <p class="muted">Comment, critique, or suggestion — appears in the Thinking pane with your badge.</p>
  <label class="muted" for="variant">Variant</label>
  <select id="variant" style="font:inherit;margin-bottom:8px;padding:6px;border-radius:6px">
    <option value="note">Note</option>
    <option value="suggestion">Suggestion</option>
    <option value="critique">Critique</option>
  </select>
  <textarea id="text" class="compose" placeholder="Your observation…"></textarea>
  <div class="row" style="margin-top:8px">
    <button type="button" class="primary" id="post">Post insight</button>
    <label class="muted"><input type="checkbox" id="open-critique" /> Open critique map after critique</label>
  </div>
  <p class="muted" id="status"></p>
  <script type="module">
${MCP_APP_ESM_IMPORT}
${MCP_APP_SHELL_SCRIPT}

function parsePayload(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const els = {
  text: document.getElementById("text"),
  variant: document.getElementById("variant"),
  openCritique: document.getElementById("open-critique"),
  status: document.getElementById("status"),
  post: document.getElementById("post"),
};

els.post.addEventListener("click", async () => {
  const text = els.text.value.trim();
  if (!text) {
    els.status.textContent = "Enter some text.";
    return;
  }
  const variant = els.variant.value;
  els.post.disabled = true;
  els.status.textContent = "Posting…";
  try {
    const result = await app.callServerTool({
      name: "drop_insight",
      arguments: { text, variant },
    });
    const body = parsePayload(result);
    els.status.textContent = "Posted · " + (body?.insightId?.slice(0, 8) ?? "ok");
    els.text.value = "";
    if (variant === "critique" && els.openCritique.checked) {
      await openMcpTool("open_critique_review", {
        text,
        variant: "critique",
        insightId: body?.insightId,
      });
    }
  } catch (e) {
    els.status.textContent = "Failed: " + (e?.message ?? String(e));
  } finally {
    els.post.disabled = false;
  }
});

const app = new App({ name: "ArchiSlop Compose Insight", version: "1.0.0" });
wireAppNav("insights");
app.connect();
  </script>
</body>
</html>`;
