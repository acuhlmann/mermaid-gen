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
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://esm.sh",
    // Monaco and other editors create module workers from blob: URLs unless configured otherwise.
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "connect-src 'self' https: wss:",
    "font-src 'self' data: https://cdn.jsdelivr.net"
  ].join('; ');
}
