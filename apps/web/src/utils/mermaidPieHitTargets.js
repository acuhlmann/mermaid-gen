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
 * @param {string | undefined} source the diagram DSL, used only to name the wedges
 * @returns {string[]} section labels in render order, empty when the source will not parse
 */
function pieSliceLabels(source) {
  try {
    const doc = source ? parsePieDoc(source) : null;
    if (!doc?.slices?.length) return [];
    return [...doc.slices]
      .slice()
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((slice) => String(slice.label ?? ''));
  } catch {
    // A pie the parser rejects is still wedges on screen. Index identity is the fix; naming is a
    // nicety, and losing it must not cost the user a clickable chart.
    return [];
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

  const labels = pieSliceLabels(source);
  let slice = 0;
  const stamped = svgMarkup.replace(PIE_WEDGE_RE, (wedge) => {
    const id = `${PIE_HIT_ID_TAG}${slice}`;
    const label = labels[slice];
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
