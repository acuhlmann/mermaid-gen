/**
 * The one route decision the God window needs.
 *
 * The app has no router: `App.jsx` renders the ArchiSlop tree, and inside it
 * `ensureUrlBackedSession()` rewrites the address bar to `/sessions/{id}`. A God pane mounted anywhere
 * under that tree would have its URL replaced the moment the session hook ran, so the branch happens
 * above the tree instead — one path test in `mountArchislopApp`, before anything can touch history.
 *
 * `BASE_URL` is honored because deploys can sit under a subpath (`VITE_BASE_PATH`), and a bare
 * `=== '/god'` would then never match on the real deployment while passing every local test.
 */

const GOD_ROUTE_SEGMENT = 'god';

function normalizeBasePath(baseUrl) {
  const raw = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

/** The pane answers on the route itself and nothing below it; `/god/anything` is not a second view. */
export function isGodWindowPath(
  locationLike = typeof window !== 'undefined' ? window.location : null,
  baseUrl = (typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : '') ?? ''
) {
  if (!locationLike) return false;
  const relative = (locationLike.pathname || '/').slice(normalizeBasePath(baseUrl).length);
  const segments = relative.split('/').filter(Boolean);
  return segments.length === 1 && segments[0] === GOD_ROUTE_SEGMENT;
}
