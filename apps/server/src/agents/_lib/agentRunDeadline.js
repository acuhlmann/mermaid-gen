/**
 * Deadline enforcement for diagram-agent runs.
 *
 * The per-run budget used to be checked only *between* turns, so a model turn that
 * started just under the limit could run arbitrarily far past it — the web client would
 * then kill the SSE stream with a generic client-side timeout, losing the last validator
 * diagnostic. Combining the caller's abort signal with an absolute deadline lets the
 * in-flight LLM call abort at the budget boundary, after which the agent loop can still
 * emit a proper `run_budget_exceeded` error that carries the root cause.
 */

/**
 * Returns a signal that aborts when the caller's `abortSignal` fires OR `budgetMs`
 * elapses (measured from `startedAt`, default now). Node's timeout timers are unref'd,
 * so an expired run does not keep the process alive.
 *
 * @param {{ abortSignal?: AbortSignal | null, budgetMs: number, startedAt?: number }} args
 * @returns {AbortSignal}
 */
export function createRunDeadlineSignal({ abortSignal = null, budgetMs, startedAt = Date.now() }) {
  const remainingMs = Math.max(1, startedAt + budgetMs - Date.now());
  const deadline = AbortSignal.timeout(remainingMs);
  return abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline;
}
