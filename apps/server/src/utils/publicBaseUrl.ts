import type { Request } from 'express';

/**
 * Public origin for MCP invite URLs and deeplinks (must match what external agents can reach).
 * Prefer PUBLIC_BASE_URL in production so invites stay correct behind proxies and load balancers.
 *
 * Returns an origin without trailing slash (e.g. https://mermaid-gen-main-….run.app).
 */
export function resolvePublicBaseUrl(req?: Request | null): string {
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

export function resolvePublicUrl(req?: Request | null, path = ''): string {
  const base = resolvePublicBaseUrl(req);
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
