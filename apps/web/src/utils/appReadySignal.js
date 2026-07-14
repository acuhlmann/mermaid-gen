/** Dispatched on `window` once the React shell has hydrated and painted. */
export const APP_READY_EVENT = 'archislop:app-ready';

/**
 * @param {{ timeoutMs?: number }} [options]
 */
export function waitForAppReady({ timeoutMs = 45_000 } = {}) {
  if (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.archislopAppReady === 'true'
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    const onReady = () => {
      clearTimeout(timer);
      resolve();
    };
    window.addEventListener(APP_READY_EVENT, onReady, { once: true });
  });
}

/**
 * Call after the first meaningful paint so the cold-start gate can dismiss.
 */
export function markAppReady() {
  document.documentElement.dataset.archislopAppReady = 'true';
  window.dispatchEvent(new CustomEvent(APP_READY_EVENT));
}
