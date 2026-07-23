/**
 * Reset control for draggable floating windows.
 *
 * Dragged a window off-screen, or a device fold/rotate stranded one where you
 * can't reach it? `resetFloatingWindow(id)` clears its remembered position so it
 * snaps back to its default corner; `resetAllFloatingWindows()` tidies the whole
 * desk at once. `useDraggablePosition` subscribes and re-places on the next tick.
 *
 * The per-window and global counters are summed when read, so a global "tidy up"
 * bumps every window's reset version without having to enumerate them.
 */

const STORAGE_PREFIX = 'floating-window:';

/** @type {Map<string, number>} */
const versionById = new Map();

let globalVersion = 0;

/** @type {Set<() => void>} */
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

/**
 * @param {string} storageKey
 */
function clearStoredPosition(storageKey) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
  } catch {
    // Storage blocked — the in-memory reset below still re-places the window.
  }
}

/**
 * Forget one window's stored position and ask it to re-place at its default.
 * @param {string} storageKey Matches the FloatingWindow id / storageKey.
 */
export function resetFloatingWindow(storageKey) {
  if (!storageKey) return;
  clearStoredPosition(storageKey);
  versionById.set(storageKey, (versionById.get(storageKey) ?? 0) + 1);
  notify();
}

/** Forget every window's stored position (tidy the whole desk). */
export function resetAllFloatingWindows() {
  if (typeof window !== 'undefined') {
    try {
      const store = window.sessionStorage;
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => store.removeItem(key));
    } catch {
      // Ignore — the counter bump still re-places live windows.
    }
  }
  globalVersion += 1;
  notify();
}

/**
 * Monotonic reset version for a window. Changes whenever this window (or all
 * windows) is reset, so consumers can re-place on change.
 * @param {string} storageKey
 * @returns {number}
 */
export function getResetVersion(storageKey) {
  return (versionById.get(storageKey) ?? 0) + globalVersion;
}

/** @param {() => void} listener */
export function subscribeFloatingWindowReset(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @internal Reset between tests. */
export function resetFloatingWindowControlForTests() {
  versionById.clear();
  globalVersion = 0;
  notify();
}
