/** @typedef {'syntax_exhausted' | 'no_patch' | 'stale_revision' | 'timeout' | 'network' | 'generic'} AgentStreamFailureClass */

/**
 * @param {string} message
 * @returns {string | null}
 */
function extractFirstErrorLine(message) {
  const trimmed = (message ?? '').trim();
  if (!trimmed) return null;
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length > 12) return line.length > 140 ? `${line.slice(0, 137)}…` : line;
  }
  return lines[0] ?? null;
}

/**
 * User-facing status for failed intent/transform agent streams.
 * @param {{ operation?: string, code?: string, message?: string }} args
 * @returns {{ failureClass: AgentStreamFailureClass, statusText: string, detail: string | null }}
 */
export function resolveAgentStreamFailureStatus({ code, message }) {
  const msg = String(message ?? '').trim();
  const lower = msg.toLowerCase();

  if (
    code === 'stale_revision' ||
    (lower.includes('stale') && lower.includes('retry')) ||
    lower.includes('refresh state')
  ) {
    return {
      failureClass: 'stale_revision',
      statusText: 'Diagram changed elsewhere — refresh and retry.',
      detail: null
    };
  }

  if (
    code === 'run_budget_exceeded' ||
    lower.includes('time limit') ||
    lower.includes('budget exceeded')
  ) {
    return {
      failureClass: 'timeout',
      statusText: 'Run timed out — try Fast or retry.',
      detail: null
    };
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    (!lower.includes('abort') &&
      (lower.includes('network') ||
        lower.includes('failed to fetch') ||
        lower.includes('stream request failed')))
  ) {
    return {
      failureClass: 'network',
      statusText: 'Connection or stream timed out. Retry.',
      detail: null
    };
  }

  if (
    lower.includes('parse error') ||
    lower.includes('parser rejected') ||
    lower.includes('unknown top-level key') ||
    lower.includes('unknown key in object') ||
    lower.includes('infographic dsl') ||
    lower.includes('syntax fixer') ||
    (lower.includes('syntax') && lower.includes('failed'))
  ) {
    const detail =
      extractFirstErrorLine(msg.replace(/^infographic update failed:\s*/i, '')) ??
      extractFirstErrorLine(msg);
    return {
      failureClass: 'syntax_exhausted',
      statusText: "Couldn't fix diagram syntax.",
      detail
    };
  }

  if (
    code === 'no_mutation_revision' ||
    lower.includes('not updated') ||
    lower.includes('did not apply') ||
    lower.includes('no valid patch')
  ) {
    return {
      failureClass: 'no_patch',
      statusText: 'No diagram patch was applied. Retry or try Quality.',
      detail: null
    };
  }

  return {
    failureClass: 'generic',
    statusText: 'Something failed. You can retry.',
    detail: extractFirstErrorLine(msg)
  };
}
