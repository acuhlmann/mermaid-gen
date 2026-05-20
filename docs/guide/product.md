# Product & web UI

## Product vision

- One always-visible user prompt captures the human's drawing intent; **Go** applies it via the **intent** path (default LangChain agent + diagram tools), grounded in the user's own wording.
- **Refine**, **Innovate**, and **Go Mad** reuse the same tools but run under a **transform** agent with mode-specific prompts and sampling (hotter for bolder modes).
- **Critique** / **Explain** run read-only analysis into an insights pane; **Fix** turns critique into a diagram edit by reusing the **intent** path (the web app sends a long structured prompt as if it were a user request); **Show Thinking** streams agent telemetry into the same pane (SSE).
- Optional focus on a diagram node or edge narrows transforms, explanations, and critique-driven fixes to that subgraph.
- Switching between **Diagram** and **Infographic** modes preserves both canvases independently; the active content type is forwarded in every agent call so the right agent and validator handles the request.

## Web UI (what you see)

| Area | Role |
| --- | --- |
| **Canvas** | Live Mermaid SVG or AntV Infographic render; click nodes/edges to set **focus** for scoped transforms and critique. |
| **Monaco editor** | Source for the active slot; syncs to the server on edit. Syntax errors trigger debounced **auto-fix** (Mermaid and Infographic). |
| **Prompt bar + radial menu** | **Go**, **Refine**, **Innovate**, **Go Mad**, **Critique**, **Explain**, **Style** (Mermaid only). On narrow viewports the same actions live in a **radial menu** over the canvas. |
| **Insights / Thinking pane** | Streaming tokens with **generative micro-viz** (hex swatches, color ramps, icon replace chips), plan cards, patch sparkbars, tool stepper, and critique output. **Show Thinking** mirrors AG-UI phases; critique **Fix** uses checkboxes (A2UI); style tweak lines render as **Visual tweaks** cards (`style_edits` artifact). |
| **Agent presence bar** | External agents that completed handshake; emoji reactions and focus highlights from the room. |
| **Handshakes & proposals** | Dialog when an MCP guest requests join; proposal cards when a guest submits an edit (accept / reject / request changes). |
| **Invite agent** | Pairing code, QR, **Add to Cursor** / **Install in VS Code** deeplinks, rotate code. |
| **Slopitect** (cosmetic) | Companion avatar, run HUD, streaks, and session achievements — feedback on agent runs, not a separate backend. |

Built-in agents never bypass validation; external agents never auto-apply (proposals only).
