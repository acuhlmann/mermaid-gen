import { createSessionId, normalizeSessionId } from '../state/diagramSession.js';

export const MODEL_PROFILE_STORAGE_KEY = 'archislop:model-profile';
export const CONTENT_MODE_STORAGE_KEY = 'archislop:content-mode';
export const SESSION_ROUTE_SEGMENT = 'sessions';

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeBasePath(baseUrl) {
  const raw = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function relativePathname(pathname) {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  const normalizedPath = pathname || '/';
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    return normalizedPath.slice(basePath.length) || '/';
  }
  return normalizedPath;
}

/** Read the session id out of `/sessions/{id}` in the current URL, or null. */
export function readSessionIdFromLocation(
  locationLike = typeof window !== 'undefined' ? window.location : null
) {
  if (!locationLike) return null;
  const segments = relativePathname(locationLike.pathname).split('/').filter(Boolean);
  if (segments[0] !== SESSION_ROUTE_SEGMENT) return null;
  return normalizeSessionId(decodePathSegment(segments[1] ?? ''));
}

/** Build the canonical pathname for a session id, honoring Vite's BASE_URL. */
export function sessionPathFor(sessionId) {
  const basePath = normalizeBasePath(import.meta.env.BASE_URL);
  return `${basePath}/${SESSION_ROUTE_SEGMENT}/${encodeURIComponent(sessionId)}`;
}

/**
 * Ensure the URL contains `/sessions/{id}`. If the URL already had one, we adopt it; otherwise we
 * mint a fresh id and rewrite history. Returns `{ sessionId, fromUrl }` where `fromUrl` is true
 * if the id came from the URL (so the server is expected to know it already).
 */
export function ensureUrlBackedSession() {
  const fallbackSessionId = normalizeSessionId(createSessionId()) ?? `session-${Date.now()}`;
  if (typeof window === 'undefined') return { sessionId: fallbackSessionId, fromUrl: false };

  const urlSessionId = readSessionIdFromLocation(window.location);
  const sessionId = urlSessionId ?? fallbackSessionId;
  const fromUrl = Boolean(urlSessionId);
  const nextPath = sessionPathFor(sessionId);
  if (window.location.pathname !== nextPath) {
    window.history.replaceState(
      {},
      '',
      `${nextPath}${window.location.search}${window.location.hash}`
    );
  }
  return { sessionId, fromUrl };
}

/** Default UI tier is Fast unless the user chose Quality and we persisted it. */
export function readStoredModelProfile() {
  if (typeof window === 'undefined') return 'fast';
  const raw = window.localStorage.getItem(MODEL_PROFILE_STORAGE_KEY);
  return raw === 'quality' ? 'quality' : 'fast';
}

/** Default content mode is Diagram (Mermaid). Other modes are opt-in and persisted. */
export function readStoredContentMode() {
  if (typeof window === 'undefined') return 'mermaid';
  const raw = window.localStorage.getItem(CONTENT_MODE_STORAGE_KEY);
  if (raw === 'infographic' || raw === 'metaphor3d') return raw;
  return 'mermaid';
}
