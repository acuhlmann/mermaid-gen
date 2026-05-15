/**
 * Shared Mermaid.js init for ArchiSlop renders (main canvas + embedded previews).
 *
 * `htmlLabels: false` keeps flowchart labels as SVG `<text>` instead of HTML inside
 * `<foreignObject>`, so pan/zoom via CSS transform stays sharp instead of pixelated.
 */
export const ARCHISLOP_MERMAID_BASE_INIT = {
  startOnLoad: false,
  securityLevel: 'loose',
  maxTextSize: 90000,
  htmlLabels: false
};

export const ARCHISLOP_MERMAID_CANVAS_INIT = {
  ...ARCHISLOP_MERMAID_BASE_INIT,
  deterministicIds: true,
  deterministicIDSeed: 'archislop'
};

export const ARCHISLOP_MERMAID_PREVIEW_INIT = {
  ...ARCHISLOP_MERMAID_BASE_INIT,
  deterministicIds: true,
  deterministicIDSeed: 'archislop-insights-embed'
};
