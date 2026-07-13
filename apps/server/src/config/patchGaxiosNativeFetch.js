import { instance as gaxiosInstance } from 'gaxios';

/**
 * Gaxios resolves fetch via `window.fetch` or dynamic `import('node-fetch')`.
 * In our Cloud Run image the node-fetch interop can yield a non-function default
 * export, which breaks Vertex metadata token refresh ("fetchImpl is not a function").
 * Node 22 provides native fetch — wire Gaxios to it before Google clients load.
 */
export function patchGaxiosNativeFetch() {
  if (typeof globalThis.fetch !== 'function') return;

  const boundFetch = globalThis.fetch.bind(globalThis);

  if (typeof globalThis.window === 'undefined') {
    globalThis.window = { fetch: boundFetch };
  }

  gaxiosInstance.defaults.fetchImplementation = boundFetch;
}

patchGaxiosNativeFetch();
