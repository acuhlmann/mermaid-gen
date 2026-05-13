/**
 * Minimal `node:url` surface for PostCSS (via @antv/infographic) in the browser.
 * `postcss/lib/map-generator` only needs `pathToFileURL`.
 */
export function pathToFileURL(filepath) {
  const normalized = String(filepath).replace(/\\/g, '/');
  const href = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  return new URL(href);
}
