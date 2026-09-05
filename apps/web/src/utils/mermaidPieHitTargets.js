/**
 * Give mermaid `pie` wedges the hit identity the canvas already expects.
 *
 * `docs/canvas-graph-edit.md` lists Mermaid pie as a shipped graph-edit family, and the mutator
 * side is genuinely complete (`mermaidPieEdit.js`: add / delete / rename, all index-addressed).
 * What was never true is the *hit* side: rendered pie markup in the pinned mermaid (`^11.17.2`) is
 *
 *     <g transform="translate(225,225)"><g>
 *       <circle class="pieOuterCircle"></circle>
 *       <path d="…" fill="#ECECFF" class="pieCircle"></path>   × N
 *       <text class="slice">79%</text>                          × N
 *     </g></g>
 *
 * — no `id` on a wedge, and no `g.node` / `g.timeline-node` / `g.cluster` ancestor anywhere, so
 * `DiagramCanvas.resolveTargetUnder`'s `closest('g.node')` never matches, `buildDescriptorFromHit`
 * is never reached, and no slice can be selected. Clicking a pie chart opened nothing. #523.
 *
 * The fix is identity, not plumbing. `mermaidRenderedSliceIndex` in `mermaidSourceLocate.js` has
 * documented the id shape for "Timeline and pie diagrams" — `diagram-<n>-node-<index>` — since well
 * before this file existed, and `logicalIdFromNodeWrap` → `graphEditIdFromDescriptor` →
 * `parseInfographicGraphId` already carries that index to the pie mutator. Timeline satisfies the
 * contract because mermaid stamps `g.timeline-node` itself. Pie never did, so the shape this code
 * was written to read was simply absent.
 *
 * So this pass wraps each wedge in the `g.node` the six selection/highlight/label call sites
 * already query for, and does it **once, at render**, in markup. The alternative — teaching
 * `path.pieCircle` to `DiagramCanvas.jsx`, `diagramGraphEditNodeResolve.js`,
 * `visibleDiagramLabels.js`, `embeddedDiagramFocus.js`, `focusDiagramHighlightIds.js` and
 * `applyDiagramHighlightToSvg.js` — is six files that must move together and be re-verified per
 * behaviour, and it grows the canvas component that ADR-0005 ratchets. #523 named both options;
 * this is option 1, chosen for that reason.
 *
 * The section name goes on a `<title>` child and never a `<text>`: `nodeTitleFromElement` and
 * `visibleDiagramLabels` enumerate `text` elements, so a `<text>` would put an undrawn label on
 * the canvas's label inventory and into the diff highlighters.
 */

import { parsePieDoc } from './mermaidPieEdit.js';

/** Ids the wedge wrappers carry. `mermaidRenderedSliceIndex` reads the trailing number. */
const PIE_HIT_ID_TAG = 'diagram-0-node-';

const ALREADY_WRAPPED_RE =
  /<g\b[^>]*class="[^"]*\bnode\b[^"]*"[^>]*>(?:<title>[\s\S]*?<\/title>)?\s*<path\b[^>]*\bpieCircle\b/i;
const PIE_WEDGE_RE = /<path\b[^>]*\bclass="[^"]*\bpieCircle\b[^"]*"[^>]*?(?:\/>|><\/path>)/gi;

/**
 * XML text escaping for a label that came from user DSL. `sanitizeSvgMarkup` has already run by the
 * time this pass is called (it is applied first in renderMermaidSvg), so unescaped markup here would
 * be inserted after the XSS strip rather than by it.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeXmlText(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * @typedef {{ index: number, label: string, value: number }} PieSliceIdentity
 */

/**
 * The source's slices, and the subset of them mermaid actually draws.
 *
 * **DOM position is not source position.** Two rules in the pinned mermaid drop a section before
 * it becomes a `path.pieCircle`, both in `pieDiagram-*.mjs`:
 *
 * - `addSection`: `if (!sections.has(label))` — a repeated label is merged into its first line.
 * - `createPieArcs`: `.filter((d) => (d.value / sum) * 100 >= 1)` — a section under 1% of the
 *   total is not drawn at all. (The legend still lists it, so it is invisible only as a wedge.)
 *
 * `parsePieDoc` keeps every source line, so `"Mice" : 1` ahead of two big sections leaves two
 * wedges whose DOM positions are 0 and 1 and whose *source* indices are 1 and 2 — and the index
 * is the whole identity the pie mutator addresses by. Stamping the DOM position renames or
 * deletes the slice behind the one the user clicked.
 *
 * @param {string | undefined} source the diagram DSL
 * @returns {{ ordered: PieSliceIdentity[], drawn: PieSliceIdentity[] }} source order, and the
 *   wedges mermaid draws in DOM order; both empty when the source will not parse
 */
function pieSliceIdentities(source) {
  try {
    const doc = source ? parsePieDoc(source) : null;
    if (!doc?.slices?.length) return { ordered: [], drawn: [] };
    const ordered = [...doc.slices]
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((slice) => ({
        index: Number(slice.index),
        label: String(slice.label ?? ''),
        value: Number(slice.value) || 0
      }));

    /** @type {Map<string, PieSliceIdentity>} */
    const sections = new Map();
    for (const slice of ordered) {
      if (!sections.has(slice.label)) sections.set(slice.label, slice);
    }
    const kept = [...sections.values()];
    const sum = kept.reduce((acc, slice) => acc + slice.value, 0);
    // `0 / 0` is NaN and `NaN >= 1` is false, so mermaid draws nothing for an all-zero pie. Say
    // so explicitly rather than leaning on that.
    const drawn = sum > 0 ? kept.filter((slice) => (slice.value / sum) * 100 >= 1) : [];
    return { ordered, drawn };
  } catch {
    // A pie the parser rejects is still wedges on screen. Index identity is the fix; naming is a
    // nicety, and losing it must not cost the user a clickable chart.
    return { ordered: [], drawn: [] };
  }
}

/**
 * Wrap every pie wedge in a selectable `g.node` carrying `diagram-0-node-<index>`.
 *
 * Idempotent by detection rather than by state: a wrapper already holding a `pieCircle` means the
 * pass ran, so a re-render of already-stamped markup (a cached SVG string, a preview that renders
 * twice) cannot nest wrappers or shift an index.
 *
 * @param {string | undefined} svgMarkup sanitized SVG from `mermaid.render`
 * @param {string} [source] the diagram DSL, for wedge names
 * @returns {string} the same markup, with pie wedges wrapped; untouched for every other diagram type
 */
export function stampPieSliceHitTargets(svgMarkup, source) {
  if (typeof svgMarkup !== 'string' || !svgMarkup) return svgMarkup;
  if (!svgMarkup.includes('pieCircle')) return svgMarkup;
  if (ALREADY_WRAPPED_RE.test(svgMarkup)) return svgMarkup;

  const { ordered, drawn } = pieSliceIdentities(source);
  const wedgeCount = (svgMarkup.match(PIE_WEDGE_RE) ?? []).length;
  // Trust the drop model only when it predicts exactly what mermaid drew. A mismatch means this
  // file's copy of those two rules has drifted from the pinned renderer (or the source does not
  // parse), and a *guessed* index is worse than an unnamed wedge: it edits a slice the user did
  // not click. So fall back to DOM position, which is what shipped and what keeps the chart
  // selectable at all (#523).
  const drawnByPosition = wedgeCount > 0 && drawn.length === wedgeCount ? drawn : null;

  let slice = 0;
  const stamped = svgMarkup.replace(PIE_WEDGE_RE, (wedge) => {
    const hit = drawnByPosition ? drawnByPosition[slice] : ordered[slice];
    const id = `${PIE_HIT_ID_TAG}${drawnByPosition ? hit.index : slice}`;
    const label = hit?.label;
    const title =
      typeof label === 'string' && label ? `<title>${escapeXmlText(label)}</title>` : '';
    slice += 1;
    return `<g class="node" id="${id}">${title}${wedge}</g>`;
  });
  // Wedges are the only thing this rewrites, so a pass that matched nothing is a markup shape this
  // regex does not know. Return the input rather than a silently different string, and let the
  // failure be "pie is unselectable again" (visible) instead of "the SVG changed" (not).
  return slice > 0 ? stamped : svgMarkup;
}
