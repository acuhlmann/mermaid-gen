import { createInitialDiagramState } from '@archislop/shared';
import {
  BROWSER_SESSION_STORAGE_KEY,
  clearInMemoryBrowserSessionId,
  normalizeSessionId
} from './diagramSession.js';
import {
  CONTENT_MODE_STORAGE_KEY,
  MODEL_PROFILE_STORAGE_KEY
} from '../utils/appSessionLocation.js';
import { STORAGE_KEY as SLOPITECT_PROGRESS_STORAGE_KEY } from './runGamificationStore.js';

export const DIAGRAM_CACHE_STORAGE_KEY = 'archislop:diagram-cache-v2';

function getDiagramCacheKey(sessionId) {
  const normalizedSessionId = normalizeSessionId(sessionId);
  return normalizedSessionId
    ? `${DIAGRAM_CACHE_STORAGE_KEY}:${normalizedSessionId}`
    : DIAGRAM_CACHE_STORAGE_KEY;
}

export function readDiagramCache(sessionId) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getDiagramCacheKey(sessionId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiagramCache(payload, sessionId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getDiagramCacheKey(sessionId), JSON.stringify(payload ?? {}));
  } catch {
    // Ignore localStorage quota/privacy errors.
  }
}

/** Removes persisted diagram/insights cache for every session (prefix `archislop:diagram-cache-v2`). */
export function clearAllDiagramCachesFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === DIAGRAM_CACHE_STORAGE_KEY || k.startsWith(`${DIAGRAM_CACHE_STORAGE_KEY}:`)) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore privacy / access errors.
  }
}

/** User-global keys that survive room rotation / server restarts. */
export const PERSISTENT_ARCHISLOP_STORAGE_KEYS = new Set([
  SLOPITECT_PROGRESS_STORAGE_KEY,
  'archislop:stakeholder-intro-seen',
  'archislop:mode-reveal-seen',
  'archislop:advisor-muted',
  'archislop.uiLocale',
  'archislop:mermaid-vite-reload'
]);

function isSessionScopedArchislopStorageKey(key) {
  if (!key) return false;
  if (key === 'archislop' || key.startsWith('archislop-')) return true;
  if (!key.startsWith('archislop:')) return false;
  return !PERSISTENT_ARCHISLOP_STORAGE_KEYS.has(key);
}

/** Drops every `archislop` / `archislop:*` key (diagram caches, gamification, prefs, etc.). */
export function clearAllArchislopAppStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k === 'archislop' || k.startsWith('archislop:') || k.startsWith('archislop-')) {
        keys.push(k);
      }
    }
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore privacy / access errors.
  }
}

/**
 * Drop session-scoped client payloads after the server reports a room is gone (404/410).
 * Preserves user-global progress (Slopitect level/XP, lifetime cost, achievements, etc.).
 */
export function clearSessionScopedArchislopStorage() {
  if (typeof window === 'undefined') return;
  try {
    clearAllDiagramCachesFromStorage();
    const keys = [
      BROWSER_SESSION_STORAGE_KEY,
      MODEL_PROFILE_STORAGE_KEY,
      CONTENT_MODE_STORAGE_KEY,
      'archislop-stream-debug'
    ];
    for (const k of keys) {
      window.localStorage.removeItem(k);
    }
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (isSessionScopedArchislopStorageKey(k)) {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore privacy / access errors.
  }
}

/**
 * After the server reports the session is gone (404/410), drop all client-side session payloads
 * so a new room id does not resurrect stale diagrams, insights, or backup session headers.
 */
export function wipeClientCachesAfterLostServerSession() {
  clearInMemoryBrowserSessionId();
  clearSessionScopedArchislopStorage();
}

/** True when a persisted per-session cache still has user-visible work to restore. */
export function isDiagramCacheSubstantial(cache) {
  if (!cache || typeof cache !== 'object') return false;
  if (Array.isArray(cache.insightsEntries) && cache.insightsEntries.length > 0) return true;
  if (typeof cache.latestCritique?.text === 'string' && cache.latestCritique.text.trim())
    return true;
  const src = typeof cache.diagramSource === 'string' ? cache.diagramSource.trim() : '';
  if (!src) return false;
  const initial = createInitialDiagramState('mermaid');
  return src !== initial.diagramSource.trim();
}
