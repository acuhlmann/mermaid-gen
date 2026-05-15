/**
 * Public origin for MCP invite URLs and deeplinks (must match what external agents can reach).
 * Prefer PUBLIC_BASE_URL in production so invites stay correct behind proxies and load balancers.
 */

const DEFAULT_LOCAL = 'http://localhost:4000';

/**
 * @param {import('express').Request | null | undefined} [req]
 * @returns {string} Origin without trailing slash (e.g. https://mermaid-gen-main-….run.app)
 */
export function resolvePublicBaseUrl(req) {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }

  if (req?.get) {
    const host = req.get('host');
    if (host && !/^localhost(:\d+)?$/i.test(host)) {
      const proto =
        req.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
        (req.secure ? 'https' : req.protocol) ||
        'http';
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  const port = Number(process.env.PORT ?? 4000);
  return `http://localhost:${port}`;
}

/**
 * @param {import('express').Request | null | undefined} [req]
 * @param {string} [path]
 */
export function resolvePublicUrl(req, path = '') {
  const base = resolvePublicBaseUrl(req);
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
