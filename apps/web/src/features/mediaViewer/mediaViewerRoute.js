/**
 * Standalone local media viewer (no session URL rewriting).
 * Same mount pattern as the God window — see `godRoute.js`.
 */

const MEDIA_VIEWER_SEGMENT = 'media-viewer';

function normalizeBasePath(baseUrl) {
  const raw = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

export function isMediaViewerPath(
  locationLike = typeof window !== 'undefined' ? window.location : null,
  baseUrl = (typeof import.meta !== 'undefined' ? import.meta.env?.BASE_URL : '') ?? ''
) {
  if (!locationLike) return false;
  const relative = (locationLike.pathname || '/').slice(normalizeBasePath(baseUrl).length);
  const segments = relative.split('/').filter(Boolean);
  return segments.length === 1 && segments[0] === MEDIA_VIEWER_SEGMENT;
}
