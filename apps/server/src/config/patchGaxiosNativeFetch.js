import { Gaxios, instance as gaxiosInstance } from 'gaxios';

/** @type {typeof fetch | undefined} */
let boundNativeFetch;

/**
 * Gaxios resolves fetch via `window.fetch` or dynamic `import('node-fetch')`.
 * google-auth-library uses `new Gaxios()` (not the package singleton), and our
 * Mermaid validator replaces `globalThis.window` with jsdom (no fetch). Either
 * path yields "fetchImpl is not a function" on Vertex token refresh unless we
 * wire native Node fetch everywhere.
 */
export function patchGaxiosNativeFetch() {
  if (typeof globalThis.fetch !== 'function') return;

  boundNativeFetch = globalThis.fetch.bind(globalThis);

  // Jsdom (Mermaid warm-up) replaces globalThis.window without a fetch impl.
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {};
  }
  globalThis.window.fetch = boundNativeFetch;

  gaxiosInstance.defaults.fetchImplementation = boundNativeFetch;

  if (!Gaxios.prototype.__archislopNativeFetchPatched) {
    const originalDefaultAdapter = Gaxios.prototype._defaultAdapter;
    Gaxios.prototype._defaultAdapter = async function archislopNativeFetchAdapter(config) {
      if (typeof this.defaults.fetchImplementation !== 'function') {
        this.defaults.fetchImplementation = boundNativeFetch;
      }
      if (typeof config.fetchImplementation !== 'function') {
        config = { ...config, fetchImplementation: boundNativeFetch };
      }
      return originalDefaultAdapter.call(this, config);
    };
    Object.defineProperty(Gaxios.prototype, '__archislopNativeFetchPatched', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
  }
}

patchGaxiosNativeFetch();
