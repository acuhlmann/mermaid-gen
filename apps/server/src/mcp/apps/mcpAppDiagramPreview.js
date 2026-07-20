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
const INFOGRAPHIC_CDN = "https://esm.sh/@antv/infographic@0.2.19";
const INFOGRAPHIC_LOAD_MS = 20000;
const INFOGRAPHIC_RENDER_MS = 15000;
let mermaidApi = null;
let infographicApiPromise = null;
const infographicInstances = new WeakMap();

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

function infographicDslFallback(el, source, message) {
  const text = source?.trim() ? source : "(empty)";
  const clipped = text.length > 2400 ? text.slice(0, 2400) + "…" : text;
  const note = message
    ? '<p class="err" style="margin:0 0 6px">' + esc(message) + ' — showing DSL.</p>'
    : '';
  el.innerHTML = note + "<pre style='margin:0;font-size:11px;white-space:pre-wrap;word-break:break-word'>" + esc(clipped) + "</pre>";
}

async function getInfographicApi() {
  if (!infographicApiPromise) {
    infographicApiPromise = withTimeout(import(INFOGRAPHIC_CDN), INFOGRAPHIC_LOAD_MS, "Infographic library load")
      .catch((err) => { infographicApiPromise = null; throw err; });
  }
  return infographicApiPromise;
}

function disposeInfographicInstance(el) {
  const prev = infographicInstances.get(el);
  if (!prev) return;
  try { prev.destroy(); } catch { /* noop */ }
  infographicInstances.delete(el);
}

async function renderInfographicPreview(el, source) {
  if (!source?.trim()) {
    disposeInfographicInstance(el);
    el.innerHTML = '<span class="muted">(empty)</span>';
    return;
  }
  let api;
  try {
    api = await getInfographicApi();
  } catch (e) {
    infographicDslFallback(el, source, esc(e?.message ?? "AntV failed to load"));
    return;
  }
  const Infographic = api?.Infographic;
  const parseSyntax = api?.parseSyntax;
  if (typeof Infographic !== "function") {
    infographicDslFallback(el, source, "AntV bundle missing Infographic export");
    return;
  }
  try {
    const parsed = typeof parseSyntax === "function" ? parseSyntax(source) : null;
    if (parsed?.errors?.length) {
      const head = parsed.errors.slice(0, 3).map((p) => p?.message).filter(Boolean).join(" · ");
      infographicDslFallback(el, source, "DSL parse error: " + (head || "unknown"));
      return;
    }
  } catch { /* parseSyntax should not throw; fall through to render */ }

  disposeInfographicInstance(el);
  el.innerHTML = "";
  const host = document.createElement("div");
  host.style.width = "100%";
  host.style.minHeight = "200px";
  host.style.height = "280px";
  el.appendChild(host);

  let inst;
  try {
    inst = new Infographic({ container: host, width: "100%", height: "100%", editable: false });
    inst.render(source);
    infographicInstances.set(el, inst);
  } catch (e) {
    disposeInfographicInstance(el);
    infographicDslFallback(el, source, "Render failed: " + esc(e?.message ?? "unknown"));
    return;
  }
  setTimeout(() => {
    if (infographicInstances.get(el) !== inst) return;
    if (host.querySelectorAll("svg").length === 0) {
      infographicDslFallback(el, source, "Infographic produced no visible output");
    }
  }, INFOGRAPHIC_RENDER_MS);
}

function clipSource(source, max) {
  const limit = typeof max === "number" ? max : 12000;
  const text = String(source ?? "").trim();
  if (!text) return "";
  return text.length > limit ? text.slice(0, limit) + "…" : text;
}

function renderSourceFallback(el, source, note) {
  const text = clipSource(source, 12000);
  el.innerHTML =
    (note ? '<p class="muted" style="margin:0 0 6px;font-size:12px">' + esc(note) + "</p>" : "") +
    "<pre style='margin:0;font-size:11px;white-space:pre-wrap;word-break:break-word'>" +
    esc(text || "(empty)") + "</pre>";
}

async function renderJsonSlotPreview(el, source, note) {
  if (!source?.trim()) {
    el.innerHTML = '<span class="muted">(empty)</span>';
    return;
  }
  try {
    const parsed = JSON.parse(source);
    const pretty = JSON.stringify(parsed, null, 2);
    const headline =
      parsed.formTitle ||
      parsed.metaphor ||
      (parsed.spec && typeof parsed.spec.title === "object" ? parsed.spec.title.text : parsed.spec?.title) ||
      "";
    let html = note ? '<p class="muted" style="margin:0 0 6px;font-size:12px">' + esc(note) + "</p>" : "";
    if (headline) {
      html += '<p style="margin:0 0 6px;font-weight:600">' + esc(String(headline)) + "</p>";
    }
    html +=
      "<pre style='margin:0;font-size:11px;white-space:pre-wrap;word-break:break-word'>" +
      esc(clipSource(pretty, 12000)) +
      "</pre>";
    el.innerHTML = html;
  } catch {
    renderSourceFallback(el, source, "Invalid JSON — showing raw source.");
  }
}

async function renderFormsSlotPreview(el, source) {
  await renderJsonSlotPreview(
    el,
    source,
    "Interactive form renders in ArchiSlop web. Source is read-only here."
  );
}

const VEGA_EMBED_CDN = "https://esm.sh/vega-embed@6";
const VEGA_EMBED_LOAD_MS = 20000;
const VEGA_EMBED_RENDER_MS = 15000;

async function renderChartPreview(el, source) {
  if (!source?.trim()) {
    el.innerHTML = '<span class="muted">(empty)</span>';
    return;
  }
  try {
    const wrapper = JSON.parse(source);
    const spec = wrapper?.spec ?? wrapper;
    const mod = await withTimeout(import(VEGA_EMBED_CDN), VEGA_EMBED_LOAD_MS, "Vega-Embed load");
    const embed = mod?.default ?? mod;
    el.innerHTML = "";
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.minHeight = "200px";
    el.appendChild(host);
    await withTimeout(embed(host, spec, { actions: false }), VEGA_EMBED_RENDER_MS, "Chart render");
  } catch (e) {
    await renderJsonSlotPreview(
      el,
      source,
      "Chart preview unavailable (" + esc(e?.message ?? "render failed") + ") — showing JSON."
    );
  }
}

async function renderAnythingPreview(el, source) {
  if (!source?.trim()) {
    el.innerHTML = '<span class="muted">(empty)</span>';
    return;
  }
  el.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("title", "Anything preview");
  iframe.style.width = "100%";
  iframe.style.minHeight = "280px";
  iframe.style.border = "0";
  iframe.srcdoc = source;
  el.appendChild(iframe);
}
`;
