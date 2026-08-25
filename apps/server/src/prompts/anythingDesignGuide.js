/**
 * Craft/design rule pack for Anything-mode HTML documents.
 *
 * Same pattern as the Mermaid rule packs in mermaidSyntaxGuard.js: short,
 * high-signal, injectable into prompts without blowing the token budget.
 * This pack covers CRAFT (visual and interaction quality), not safety — the
 * sandbox contract lives in anythingSystemPrompt.js and is enforced by the
 * policy lint + sandboxed iframe regardless of what the model does.
 */

export const ANYTHING_DESIGN_GUIDE = `Design craft rules (make it feel intentional, not generated):

Typography:
- Pick ONE font stack (system-ui, -apple-system, "Segoe UI", sans-serif works everywhere offline) and a modular scale: body 16px, then ~1.25x steps (20/25/31/39). Never more than 3-4 distinct sizes per page.
- line-height ~1.5 for body text, ~1.1-1.2 for headings. Max line length ~70ch for readable paragraphs.
- Use font-weight and color for hierarchy before reaching for more sizes. Tabular numbers (font-variant-numeric: tabular-nums) for counters, scores, and stats.

Spacing rhythm:
- Choose a base unit (8px) and space everything in multiples (4 for tight, 8/16/24/32/48). Random one-off margins read as sloppy.
- Group related things with LESS space, separate sections with MORE (proximity is the strongest grouping signal). Padding inside a card >= gap between cards.
- Let the layout breathe: generous padding on the page root (24-48px), never text touching an edge.

Color and contrast:
- Build from a small palette: one background, one surface, one text color, one accent, one muted text — 5-6 tokens max, defined once as CSS custom properties on :root.
- Body text contrast >= 4.5:1 against its background; large headings >= 3:1. Never mid-gray text on mid-gray surfaces.
- Use the accent sparingly (primary action, active state, key number). If everything is colorful, nothing is.
- Don't signal with color alone — pair it with an icon, label, or weight change.

Motion:
- Ease everything: transition: 150-250ms with ease-out for entrances/hovers, ease-in for exits. Nothing snaps.
- Animate transform and opacity (compositor-friendly), not width/height/top/left.
- Motion must mean something: state change, feedback, guidance. Respect prefers-reduced-motion with a @media block that disables non-essential animation.
- Continuous ambient animation (pulses, drifts) belongs in the background at low amplitude — it must never compete with content.

States:
- Empty state: if the page starts with no data/selection, SAY so and point at the first action ("Pick a planet to compare") — never render a blank region.
- Loading/thinking states for anything that takes >150ms: skeleton or spinner built in CSS.
- Interactive affordances must look interactive: cursor: pointer, visible hover AND focus-visible states, active/pressed feedback. Keyboard focus must never be invisible.
- Handle the edges inside your JS: zero items, one item, many items, extreme values — the page should degrade gracefully, not throw.

Libraries (the @lib: markers from the sandbox contract — when to reach for one):
- Default to vanilla. A page with no marker renders instantly; every library you opt into is real weight. Import a library because the page NEEDS its engine, never for one call you could write yourself.
- @lib:d3 earns its import for data joins over changing data, real scales and axes (time, log, band), force/hierarchy layouts (network graphs, trees, treemaps, packing), and geo projections. It does NOT earn it for a counter widget, a static bar chart (a few divs or hand-written SVG rects do that), simple tweens (CSS transitions), or basic math.
- @lib:matter earns its import when things should fall, collide, swing, stack, or be dragged with believable physics — games, toys, simulations (Russ territory). It does NOT earn it for scripted motion on a fixed path — CSS animation or a small requestAnimationFrame loop is lighter and easier to control.
- Use the library's idiom once imported: with d3, bind data and let joins update the DOM instead of innerHTML rebuilds; with matter, let the engine own positions and only read them out to render — don't fight the physics with manual coordinates.

Runtime-safe JS (the runtime check executes your page — these throw and burn a repair turn):
- querySelector / getElementById can return null. Guard before .classList, .textContent, or any property access — or run init inside DOMContentLoaded after the nodes you query exist in <body>.
- getTotalLength() lives on SVGGeometryElement — <path>, <rect>, <circle>, <ellipse>, <line>, <polygon>, <polyline> all have it. What throws is calling it on a node that is not a geometry element at all: a <g> wrapper, the <svg> root, a <text>, or a plain <div>. Grab the shape you are stroking, not its container.
- With @lib:d3, variables from d3.select(...) are selections — chain .append / .attr on them. Never reassign a selection to a DOM node, datum, or array and then call .append (that is what produces "append is not a function").
- With @lib:d3 force layouts, every link source/target must resolve to a node — give each node a string id (e.g. {id: 'api-gateway'}) and use those same ids in links ({source: 'api-gateway', target: 'auth'}), with .force('link', d3.forceLink(links).id(d => d.id)). Mismatched names, numeric indices, or undefined ids throw "node not found" at runtime.
- With @lib:d3 drag, define dragstarted/dragged/dragended BEFORE .call(d3.drag()...) — every handler name in .on('start'|'drag'|'end', fn) must already exist. A const/let handler declared later throws "Cannot access … before initialization"; omitting the function entirely throws "… is not defined".
- Declare const/let before first use in the same script — node.attr(...), arrowEls.forEach(...), or any read of a binding on a line above its declaration throws a TDZ ReferenceError at runtime.
- With @lib:matter, read body.isSleeping on each body — Matter.Sleeping exposes set/update helpers, not isSleeping(). Checking sleep state via Matter.Sleeping.isSleeping(...) throws "is not a function".`;
