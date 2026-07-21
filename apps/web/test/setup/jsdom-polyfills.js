/**
 * Browser APIs that jsdom omits but our UI stack expects (R3F / react-use-measure,
 * advisor float layout, radial menu sizing). Install once for every Vitest file so
 * async mounts after a test cannot throw unhandled ResizeObserver errors in CI.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor(_callback) {
      this._callback = _callback;
    }

    observe() {}

    unobserve() {}

    disconnect() {}
  };
}
