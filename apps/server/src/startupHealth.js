/**
 * The `/api/health` handler that answers during the startup window — the gap
 * between `app.listen()` and `attachRoutes()` finishing.
 *
 * A sibling module rather than a closure inside `bootstrapServer.js`
 * (ADR-0005): what this route returns is a wire contract with two consumers
 * that never meet, and the whole of a bug that no local boot can see.
 *
 * ## The two consumers, and why they disagree about a status code
 *
 * - **Cloud Run's startup probe.** `.github/workflows/deploy-cloud-run.yml`
 *   probes `httpGet.path=/api/health` and its own comment says the point is
 *   that the probe "confirms /api/health, not just an open TCP socket". Cloud
 *   Run treats any 2xx as started and releases the queued cold-start request
 *   the moment it sees one.
 * - **The browser.** `apps/web/src/utils/coldStartGate.js` polls this endpoint
 *   and treats a non-`ok` response, or `runtimeReady: false`, as "still
 *   waking" — it keeps the static shell's waking copy up and retries with
 *   backoff for up to 90s.
 *
 * Answering **200** while the runtime is still loading satisfies the second
 * and defeats the first: the probe passes on what is effectively the open
 * socket, Cloud Run marks the revision serving, and the request that triggered
 * the cold start is forwarded into an Express app that has no static handler,
 * no SPA fallback and no API routes yet — a bare `Cannot GET /`. The shell
 * never loads, so the cold-start gate that exists to cover exactly this window
 * never runs. With `--min-instances=0` that is every visit after an idle
 * period, not an edge case.
 *
 * **503** satisfies both. The probe holds traffic until the app is whole —
 * `failureThreshold=24 × periodSeconds=10` gives the same 240s Cloud Run
 * allowed for the plain socket bind before the split — and `coldStartGate`
 * already reads `!response.ok` as "still waking", so nothing on the client
 * changes. The body keeps `status`/`runtimeReady` either way, so a curl still
 * tells you which phase the server is in.
 */

/**
 * @param {() => boolean} isReady — whether `attachRoutes` has finished.
 * @returns {import('express').RequestHandler}
 */
export function createStartupHealthRoute(isReady) {
  return (_req, res, next) => {
    if (isReady()) {
      // The real handler in `loadServerApp.js` is registered later in the
      // stack; once it exists it owns this route.
      next();
      return;
    }
    res.status(503).json({ status: 'starting', runtimeReady: false });
  };
}
