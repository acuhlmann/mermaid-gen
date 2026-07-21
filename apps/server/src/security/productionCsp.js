/**
 * Production Content-Security-Policy for the ArchiSlop single-page app.
 *
 * Keep in sync with third-party runtimes loaded in the browser:
 * - Monaco (bundled workers via `apps/web/src/setupMonaco.js`; legacy CDN fallback)
 * - Mermaid / CopilotKit / A2UI (inline + self-hosted assets)
 */
export function buildProductionContentSecurityPolicy() {
  return [
    "default-src 'self'",
    // blob: required for importScripts(blob:…) inside workers (troika-three-text labels, some Monaco paths).
    "script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://esm.sh",
    // Monaco and other editors create module workers from blob: URLs unless configured otherwise.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net",
    "style-src-elem 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net https://esm.sh",
    // blob: for export previews (svgPngRaster, download links) and in-browser object URLs.
    "img-src 'self' data: blob: https:",
    // Cloud TTS office narration plays MP3 via data: URLs (officeNarration.js); blob: for
    // browsers that promote in-memory media to object URLs.
    "media-src 'self' data: blob:",
    "connect-src 'self' https: wss:",
    "font-src 'self' data: https://cdn.jsdelivr.net"
  ].join('; ');
}
