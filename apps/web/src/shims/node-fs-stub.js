/**
 * Minimal `node:fs` surface for PostCSS (via @antv/infographic) in the browser.
 * `postcss/lib/previous-map.js` only needs `existsSync` and `readFileSync`, and only
 * to follow `sourceMappingURL=` comments. Returning false / empty makes PostCSS
 * silently skip the sourcemap, which is the correct behavior for runtime CSS in
 * the browser anyway.
 */
export function existsSync() {
  return false;
}

export function readFileSync() {
  return '';
}

export default { existsSync, readFileSync };
