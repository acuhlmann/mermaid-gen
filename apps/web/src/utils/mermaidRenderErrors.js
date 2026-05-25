/**
 * Detect Vite dev-server dependency staleness (504 Outdated Optimize Dep) and other
 * browser/module-loader failures that are not Mermaid syntax problems.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isMermaidInfrastructureError(error) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error && 'message' in error
          ? String(error.message)
          : '';
  if (!message) return false;
  return (
    /Outdated Optimize Dep/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /Loading chunk .* failed/i.test(message) ||
    (/\.vite\/deps\//i.test(message) && /504/i.test(message))
  );
}

const VITE_RELOAD_SESSION_KEY = 'archislop:mermaid-vite-reload';

/**
 * In Vite dev, a stale optimized-dep cache requires a full page reload. Returns true when
 * a reload was scheduled (render should abort quietly).
 *
 * @returns {boolean}
 */
export function reloadOnceForStaleViteMermaidDeps() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(VITE_RELOAD_SESSION_KEY)) return false;
    sessionStorage.setItem(VITE_RELOAD_SESSION_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
