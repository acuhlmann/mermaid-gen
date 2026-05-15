/** Shared CSS + inline script for Mermaid/infographic previews in MCP Apps. */

export const MCP_APP_PREVIEW_BOX_CSS = `
.preview-box {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px;
  min-height: 80px;
  background: var(--panel);
  overflow: auto;
  max-height: min(420px, 55vh);
}
.preview-box svg { max-width: 100%; height: auto; }
.preview-box .err { color: var(--danger); font-size: 12px; }
.tabs { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.tabs button { padding: 4px 10px; font-size: 12px; }
.tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
`;

export const MCP_APP_DIAGRAM_PREVIEW_SCRIPT = `
const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
const MERMAID_LOAD_MS = 12000;
const MERMAID_RENDER_MS = 15000;
let mermaidApi = null;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error((label || "Operation") + " timed out after " + ms + "ms")), ms);
    }),
  ]);
}

function mermaidPreviewFallback(message) {
  return (
    '<span class="err">' + message + "</span>" +
    '<p class="muted" style="margin:8px 0 0;font-size:12px">Use the <strong>Unified diff</strong> or <strong>Source</strong> tab, or approve in the <strong>ArchiSlop web</strong> Insights pane (proposal card).</p>'
  );
}

async function getMermaid() {
  if (mermaidApi) return mermaidApi;
  const mod = await withTimeout(import(MERMAID_CDN), MERMAID_LOAD_MS, "Mermaid library load");
  mermaidApi = mod;
  const m = mermaidApi.default ?? mermaidApi;
  m.initialize({ startOnLoad: false, securityLevel: "strict", theme: "dark" });
  return m;
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;");
}

function sanitizeSvgMarkup(svg) {
  if (!svg) return "";
  let out = String(svg);
  out = out.replace(/<script[\\s\\S]*?<\\/script>/gi, "");
  out = out.replace(/\\s+on\\w+\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)/gi, "");
  return out;
}

/** Mermaid style lines do not support comma-separated node lists (unlike class). */
function prepareMermaidForRender(source) {
  if (!source || !/^(\\s*)(flowchart|graph)\\b/m.test(source)) return source;
  const propRe = /\\b(fill|stroke|stroke-width|color|stroke-dasharray)\\s*:/i;
  const lines = source.split("\\n");
  let changed = false;
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^\\s*style\\s+/i.test(trimmed)) {
      out.push(line);
      continue;
    }
    const bodyMatch = trimmed.match(/^\\s*style\\s+(.+)$/i);
    if (!bodyMatch) {
      out.push(line);
      continue;
    }
    const rest = bodyMatch[1];
    const propMatch = propRe.exec(rest);
    if (!propMatch) {
      out.push(line);
      continue;
    }
    const idPart = rest.slice(0, propMatch.index).trim();
    const propPart = rest.slice(propMatch.index).trim();
    if (!idPart.includes(",")) {
      out.push(line);
      continue;
    }
    const ids = idPart.split(/\\s*,\\s*/).filter(Boolean);
    if (ids.length < 2) {
      out.push(line);
      continue;
    }
    const indent = line.match(/^\\s*/)?.[0] ?? "";
    for (const id of ids) out.push(indent + "style " + id + " " + propPart);
    changed = true;
  }
  return changed ? out.join("\\n") : source;
}

async function renderMermaidPreview(el, source) {
  if (!source?.trim()) {
    el.innerHTML = '<span class="muted">(empty)</span>';
    return;
  }
  try {
    const m = await getMermaid();
    const id = "pv-" + Math.random().toString(36).slice(2, 10);
    const prepared = prepareMermaidForRender(source);
    const { svg } = await withTimeout(m.render(id, prepared), MERMAID_RENDER_MS, "Mermaid render");
    el.innerHTML = sanitizeSvgMarkup(svg);
  } catch (e) {
    el.innerHTML = mermaidPreviewFallback(esc(e?.message ?? "Render failed"));
  }
}

function renderInfographicPreview(el, source) {
  const text = source?.trim() ? source : "(empty)";
  const clipped = text.length > 2400 ? text.slice(0, 2400) + "…" : text;
  el.innerHTML = "<pre style='margin:0;font-size:11px;white-space:pre-wrap;word-break:break-word'>" + esc(clipped) + "</pre>";
}
`;
