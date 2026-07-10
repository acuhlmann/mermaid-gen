/** Shared nav chrome for ArchiSlop MCP Apps. */

export const MCP_APP_SHELL_CSS = `
.app-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.app-nav button {
  font-size: 12px;
  padding: 4px 8px;
}
.app-nav button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
`;

export const MCP_APP_SHELL_SCRIPT = `
async function openMcpTool(name, args) {
  try {
    await app.callServerTool({ name, arguments: args ?? {} });
  } catch (e) {
    console.warn("openMcpTool", name, e);
  }
}

function wireAppNav(active) {
  const nav = document.getElementById("app-nav");
  if (!nav) return;
  const links = [
    { id: "companion", tool: "open_web_companion", label: "Web companion" },
    { id: "welcome", tool: "open_welcome", label: "Home" },
    { id: "events", tool: "open_session_events", label: "Events" },
    { id: "canvas", tool: "open_diagram_canvas", label: "Canvas" },
    { id: "dashboard", tool: "open_session_dashboard", label: "War room" },
    { id: "inbox", tool: "open_my_proposals", label: "My proposals" },
    { id: "insights", tool: "open_insights_feed", label: "Insights" },
  ];
  nav.innerHTML = "";
  for (const link of links) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = link.label;
    if (link.id === active) btn.classList.add("active");
    btn.addEventListener("click", () => openMcpTool(link.tool));
    nav.appendChild(btn);
  }
}
`;

export const MCP_APP_SHELL_NAV_HTML =
  '<nav class="app-nav" id="app-nav" aria-label="ArchiSlop apps"></nav>';
